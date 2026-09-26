import "server-only";
import { after } from "next/server";
import nodemailer, { type Transporter } from "nodemailer";
import { DEFAULT_SETTINGS, getStoreSettings } from "@/lib/settings";

/**
 * Transactional e-mail — two interchangeable transports:
 *  1. SMTP (e.g. the shop's own Google Workspace mailbox with an app password): SMTP_HOST, SMTP_PORT,
 *     SMTP_USER, SMTP_PASSWORD. Used when SMTP_HOST + SMTP_PASSWORD are set.
 *  2. Resend HTTP API (no SDK): RESEND_API_KEY.
 * Never throws: a missing RESEND_API_KEY is logged once and every send is skipped, API/network
 * errors are logged and returned as `{ ok: false }`. Use `deferEmail()` from Server Actions so the
 * work runs after the response (Next.js `after()`), never blocking checkout or admin actions.
 */

const RESEND_URL = "https://api.resend.com/emails";
export const DEFAULT_EMAIL_FROM = "Elama · Divinol <info@divinol.lv>";
const FALLBACK_SHOP_EMAIL = "elama@elama.lv";
const EMAIL_RE = /^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/;

const env = (k: string) => process.env[k]?.trim() || "";

function smtpEnabled() {
  return Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASSWORD"));
}

export function emailTransport(): "smtp" | "resend" | null {
  return smtpEnabled() ? "smtp" : env("RESEND_API_KEY") ? "resend" : null;
}

export function isEmailEnabled() {
  return emailTransport() !== null;
}

let smtp: Transporter | null = null;
function smtpTransport() {
  if (!smtp) {
    const port = Number(env("SMTP_PORT") || 465);
    smtp = nodemailer.createTransport({
      host: env("SMTP_HOST"),
      port,
      secure: port === 465,
      auth: { user: env("SMTP_USER"), pass: env("SMTP_PASSWORD") },
      connectionTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return smtp;
}

/** Configuration summary for the admin (never exposes the key). */
export async function emailStatus() {
  return {
    apiKey: isEmailEnabled(),
    transport: emailTransport(),
    fromConfigured: Boolean(env("EMAIL_FROM")),
    from: emailFrom(),
    replyTo: await replyToAddress(),
    replyToConfigured: Boolean(env("EMAIL_REPLY_TO")),
    notify: await shopNotifyAddress(),
    notifyConfigured: Boolean(env("SHOP_NOTIFY_EMAIL")),
  };
}

export function emailFrom() {
  if (env("EMAIL_FROM")) return env("EMAIL_FROM");
  // Gmail / Workspace SMTP only allows sending as the mailbox itself (or its verified aliases).
  if (smtpEnabled()) return `Elama · Divinol <${env("SMTP_USER")}>`;
  return DEFAULT_EMAIL_FROM;
}

async function shopEmail() {
  try {
    const s = await getStoreSettings();
    return s.company.email?.trim() || DEFAULT_SETTINGS.company.email || FALLBACK_SHOP_EMAIL;
  } catch {
    return DEFAULT_SETTINGS.company.email || FALLBACK_SHOP_EMAIL;
  }
}

export async function replyToAddress() {
  return env("EMAIL_REPLY_TO") || (await shopEmail());
}

/** Where shop notifications go (comma separated list allowed in SHOP_NOTIFY_EMAIL). */
export async function shopNotifyAddress() {
  return env("SHOP_NOTIFY_EMAIL") || (await shopEmail());
}

export function isEmail(v: string | null | undefined): v is string {
  return Boolean(v && EMAIL_RE.test(v.trim()));
}

let warned = false;
function warnDisabled() {
  if (warned) return;
  warned = true;
  console.warn("[email] neither SMTP_* nor RESEND_API_KEY is set — transactional e-mails are skipped.");
}

export type EmailAttachment = { filename: string; content: Buffer | Uint8Array };

export type EmailMessage = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string | string[] | null;
  attachments?: EmailAttachment[];
  /** Resend tags (ASCII letters, digits, _ and - only; sanitised here) */
  tags?: Record<string, string>;
  /** Resend Idempotency-Key (24 h) — same key = the e-mail is sent only once */
  idempotencyKey?: string;
};

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string; skipped?: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tagSafe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256) || "_";

function splitAddresses(v: string | string[] | null | undefined) {
  const list = Array.isArray(v) ? v : (v ?? "").split(/[,;]/);
  return list.map((s) => s.trim()).filter(Boolean);
}

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const transport = emailTransport();
  if (!transport) {
    warnDisabled();
    return { ok: false, skipped: true, error: "not_configured" };
  }
  const to = splitAddresses(msg.to).filter(isEmail).slice(0, 50);
  if (!to.length) return { ok: false, error: "invalid_recipient" };
  const replyTo = splitAddresses(msg.replyTo ?? (await replyToAddress())).filter(isEmail);

  if (transport === "smtp") {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const info = await smtpTransport().sendMail({
          from: emailFrom(),
          to,
          replyTo: replyTo.length ? replyTo : undefined,
          subject: msg.subject.replace(/[\r\n]+/g, " ").slice(0, 250),
          html: msg.html,
          text: msg.text,
          attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content) })),
          headers: msg.idempotencyKey ? { "X-Entity-Ref-ID": msg.idempotencyKey.slice(0, 200) } : undefined,
        });
        return { ok: true, id: info.messageId ?? null };
      } catch (e) {
        if (attempt === 0) {
          await sleep(1500);
          continue;
        }
        console.error("[email] SMTP send failed", e);
        return { ok: false, error: e instanceof Error ? e.message : "smtp_error" };
      }
    }
    return { ok: false, error: "unreachable" };
  }

  const key = env("RESEND_API_KEY");

  const body: Record<string, unknown> = {
    from: emailFrom(),
    to,
    subject: msg.subject.replace(/[\r\n]+/g, " ").slice(0, 250),
    html: msg.html,
    text: msg.text,
  };
  if (replyTo.length) body.reply_to = replyTo;
  if (msg.attachments?.length) {
    body.attachments = msg.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") }));
  }
  if (msg.tags) body.tags = Object.entries(msg.tags).map(([name, value]) => ({ name: tagSafe(name), value: tagSafe(value) }));

  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  if (msg.idempotencyKey) headers["Idempotency-Key"] = msg.idempotencyKey.slice(0, 256);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(RESEND_URL, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000), cache: "no-store" });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, id: data.id ?? null };
      }
      const detail = await res.text().catch(() => "");
      if ((res.status === 429 || res.status >= 500) && attempt === 0) {
        await sleep(1500);
        continue;
      }
      if (res.status === 409) {
        // same Idempotency-Key already used (duplicate trigger) — nothing to do
        console.info(`[email] duplicate skipped (${msg.idempotencyKey ?? "no key"})`);
        return { ok: false, error: "duplicate" };
      }
      let message = `HTTP ${res.status}`;
      try {
        message = (JSON.parse(detail) as { message?: string }).message || message;
      } catch {
        /* keep status */
      }
      console.error(`[email] Resend ${res.status}: ${detail.slice(0, 300)}`);
      return { ok: false, error: message };
    } catch (e) {
      if (attempt === 0) {
        await sleep(1500);
        continue;
      }
      console.error("[email] Resend request failed", e);
      return { ok: false, error: e instanceof Error ? e.message : "network_error" };
    }
  }
  return { ok: false, error: "unreachable" };
}

/**
 * Schedules e-mail work to run after the response. Never throws; when e-mail is not configured the
 * task is not even started (no extra DB reads). Outside a request scope it simply runs detached.
 */
export function deferEmail(label: string, task: () => Promise<unknown>) {
  if (!isEmailEnabled()) {
    warnDisabled();
    return;
  }
  const run = async () => {
    try {
      await task();
    } catch (e) {
      console.error(`[email] ${label} failed`, e);
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}
