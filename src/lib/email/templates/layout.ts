/**
 * Shared e-mail layout + building blocks (pure — no server-only imports, so templates can be rendered
 * by a preview script too). Table-based, inline styles, 640px max width; tested patterns for
 * Gmail / Outlook / Apple Mail and dark-mode clients.
 */

export type Translate = (key: string, values?: Record<string, string | number>) => string;

export type EmailCompany = {
  name: string;
  reg_no: string;
  vat_no: string;
  address: string;
  warehouse?: string;
  phone: string;
  email: string;
  bank_name?: string;
  iban?: string;
  swift?: string;
  hours?: string;
};

/** Absolute, localized links used in the footer / help card. */
export type EmailLinks = {
  catalog: string;
  oilFinder: string;
  account: string;
  contact: string;
};

/** Everything a template needs besides its own data. */
export type EmailContext = {
  locale: string;
  t: Translate;
  company: EmailCompany;
  /** absolute site base URL for this locale (no trailing slash) */
  siteUrl: string;
  /** absolute URL of the logo (on the navy header band) */
  logoUrl: string;
  /** footer quick links (optional — omitted links are not shown) */
  links?: Partial<EmailLinks>;
};

export type RenderedEmail = { subject: string; html: string; text: string };

// ───────────────────────── tokens ─────────────────────────
export const C = {
  navy: "#1e2d51",
  navyDeep: "#111a31",
  navySoft: "#eef2fa",
  yellow: "#ffc10e",
  yellowSoft: "#fff6d6",
  ink: "#1b1f2a",
  muted: "#5b6475",
  faint: "#8a93a6",
  rule: "#e3e7ef",
  page: "#eef1f6",
  soft: "#f6f8fb",
  white: "#ffffff",
  green: "#16a34a",
  greenSoft: "#e8f7ee",
  red: "#dc2626",
  redSoft: "#fdecec",
} as const;

export const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Manrope, 'Helvetica Neue', Helvetica, Arial, sans-serif";

// ───────────────────────── escaping / formatting ─────────────────────────
const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes any user / DB provided string for HTML text and attribute context. */
export function esc(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/[&<>"']/g, (c) => ESC[c]);
}

/** Escapes and keeps line breaks. */
export function escMultiline(v: unknown): string {
  return esc(v).replace(/\r?\n/g, "<br>");
}

/** Only http(s) URLs may become links. */
export function safeUrl(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

const INTL: Record<string, string> = { lv: "lv-LV", et: "et-EE", lt: "lt-LT", en: "en-IE", ru: "ru-RU" };

export function money(n: number, locale: string) {
  return new Intl.NumberFormat(INTL[locale] ?? "lv-LV", { style: "currency", currency: "EUR" }).format(Number.isFinite(n) ? n : 0);
}

export function fmtDate(value: string | Date | null | undefined, locale: string) {
  if (!value) return "—";
  const dateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = value instanceof Date ? value : new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL[locale] ?? "lv-LV", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: dateOnly ? "UTC" : "Europe/Riga",
  }).format(d);
}

export function num(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Product image for e-mails: site-relative paths (/media/…webp) go through the Netlify Image CDN as a small
 * PNG (Outlook / older clients do not show WebP). Absolute http(s) URLs are used as they are.
 */
export function emailImageUrl(src: string | null | undefined, ctx: Pick<EmailContext, "logoUrl">, size = 112) {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return safeUrl(src);
  if (!src.startsWith("/") || src.startsWith("//")) return null;
  let origin: string;
  try {
    origin = new URL(ctx.logoUrl).origin;
  } catch {
    return null;
  }
  return `${origin}/.netlify/images?url=${encodeURIComponent(src)}&w=${size}&h=${size}&fit=contain&fm=png`;
}

// ───────────────────────── blocks (HTML) ─────────────────────────
const txt = (size = 15, color: string = C.ink, extra = "") =>
  `font-family:${FONT};font-size:${size}px;line-height:1.6;color:${color};${extra}`;

const TABLE = `role="presentation" cellpadding="0" cellspacing="0" border="0"`;

export function h1(text: string) {
  return `<h1 class="em-text" style="margin:0 0 12px;${txt(24, C.ink, "font-weight:800;line-height:1.25;letter-spacing:-0.01em;")}">${esc(text)}</h1>`;
}

/** Section heading with a short yellow accent. */
export function h2(text: string) {
  return `<table ${TABLE} style="margin:30px 0 12px;"><tr>
<td style="width:4px;background:${C.yellow};border-radius:2px;font-size:0;line-height:0;" bgcolor="${C.yellow}">&nbsp;</td>
<td class="em-text" style="padding-left:10px;${txt(13, C.ink, "font-weight:800;text-transform:uppercase;letter-spacing:0.08em;line-height:1.3;")}">${esc(text)}</td>
</tr></table>`;
}

/** Paragraph; `html` must already be escaped. */
export function p(html: string, opts: { muted?: boolean; size?: number; margin?: string } = {}) {
  return `<p class="${opts.muted ? "em-muted" : "em-text"}" style="margin:${opts.margin ?? "0 0 14px"};${txt(opts.size ?? 15, opts.muted ? C.muted : C.ink)}">${html}</p>`;
}

function buttonCell(url: string, label: string, kind: "primary" | "secondary" | "dark") {
  const bg = kind === "primary" ? C.yellow : kind === "dark" ? C.navy : C.white;
  const fg = kind === "primary" ? C.navy : kind === "dark" ? C.white : C.navy;
  const border = kind === "secondary" ? `border:2px solid ${C.navy};` : `border:2px solid ${bg};`;
  return `<td align="center" bgcolor="${bg}" style="border-radius:10px;background:${bg};${border}mso-padding-alt:12px 22px;">
<a href="${esc(url)}" target="_blank" style="display:inline-block;padding:12px 22px;border-radius:10px;background:${bg};color:${fg};${txt(15, fg, "font-weight:800;line-height:1.2;text-decoration:none;white-space:nowrap;")}">${esc(label)}${kind === "primary" ? "&nbsp;&rarr;" : ""}</a>
</td>`;
}

export function button(href: string, label: string) {
  return buttons([{ href, label }]);
}

/** One or more buttons in a row (first = primary yellow, next = outlined). Wraps on narrow screens. */
export function buttons(list: { href: string | null | undefined; label: string; kind?: "primary" | "secondary" | "dark" }[], margin = "24px 0 8px") {
  const cells = list
    .map((b) => ({ ...b, url: b.href?.startsWith("mailto:") || b.href?.startsWith("tel:") ? b.href : safeUrl(b.href) }))
    .filter((b): b is typeof b & { url: string } => Boolean(b.url))
    .map((b, i) => `<table ${TABLE} align="left" class="em-btn" style="border-collapse:separate;margin:0 10px 10px 0;"><tr>${buttonCell(b.url, b.label, b.kind ?? (i === 0 ? "primary" : "secondary"))}</tr></table>`);
  if (!cells.length) return "";
  return `<table ${TABLE} width="100%" style="margin:${margin};"><tr><td>${cells.join("")}</td></tr></table>`;
}

export function link(href: string | null | undefined, label: string) {
  const url = safeUrl(href);
  if (!url) return esc(label);
  return `<a href="${esc(url)}" target="_blank" style="color:${C.navy};font-weight:700;text-decoration:underline;">${esc(label)}</a>`;
}

export function mailtoLink(email: string | null | undefined, color: string = C.navy) {
  if (!email) return "";
  if (!/^[^@\s<>"]+@[^@\s<>"]+$/.test(email)) return esc(email);
  return `<a href="mailto:${esc(email)}" style="color:${color};font-weight:700;text-decoration:underline;">${esc(email)}</a>`;
}

export function telLink(phone: string | null | undefined, color: string = C.navy) {
  if (!phone) return "";
  return `<a href="tel:${esc(phone.replace(/[^\d+]/g, ""))}" style="color:${color};font-weight:700;text-decoration:none;white-space:nowrap;">${esc(phone)}</a>`;
}

export function divider(margin = "24px 0") {
  return `<table ${TABLE} width="100%" style="margin:${margin};"><tr><td class="em-rule" style="border-top:1px solid ${C.rule};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>`;
}

/** Label / value rows. Values must already be escaped HTML. */
export function kvTable(rows: [string, string][], opts: { labelWidth?: number } = {}) {
  const w = opts.labelWidth ?? 170;
  const trs = rows
    .filter(([, v]) => v !== "")
    .map(
      ([k, v]) =>
        `<tr><td class="em-muted em-rule" valign="top" style="padding:8px 12px 8px 0;width:${w}px;border-bottom:1px solid ${C.rule};${txt(13, C.muted, "line-height:1.5;")}">${esc(k)}</td><td class="em-text em-rule" valign="top" style="padding:8px 0;border-bottom:1px solid ${C.rule};${txt(14, C.ink, "font-weight:600;line-height:1.5;")}">${v}</td></tr>`,
    )
    .join("");
  return `<table ${TABLE} width="100%" class="em-kv">${trs}</table>`;
}

/** Soft panel with a coloured left edge. `html` must be escaped. */
export function panel(html: string, tone: "default" | "success" | "danger" | "info" = "default") {
  const edge = tone === "success" ? C.green : tone === "danger" ? C.red : tone === "info" ? C.navy : C.yellow;
  const bg = tone === "success" ? C.greenSoft : tone === "danger" ? C.redSoft : C.soft;
  return `<table ${TABLE} width="100%" style="margin:8px 0 18px;">
<tr><td class="em-soft" bgcolor="${bg}" style="background:${bg};border-left:4px solid ${edge};border-radius:10px;padding:16px 18px;">${html}</td></tr></table>`;
}

/** Row of highlighted facts (order no. / date / total …). Stacks on phones. */
export function statCards(items: { label: string; value: string; strong?: boolean }[]) {
  const list = items.filter((i) => i.value);
  if (!list.length) return "";
  const w = Math.floor(100 / list.length);
  const cells = list
    .map(
      (i, idx) => `<td class="em-stack" width="${w}%" valign="top" style="padding:0 ${idx < list.length - 1 ? 8 : 0}px 8px 0;">
<table ${TABLE} width="100%"><tr><td class="em-soft" bgcolor="${i.strong ? C.yellowSoft : C.soft}" style="background:${i.strong ? C.yellowSoft : C.soft};border-radius:10px;padding:12px 14px;${i.strong ? `border:1px solid #ffe08a;` : `border:1px solid ${C.rule};`}">
<div class="em-muted" style="${txt(11, C.muted, "font-weight:700;text-transform:uppercase;letter-spacing:0.08em;line-height:1.4;")}">${esc(i.label)}</div>
<div class="em-text" style="${txt(i.strong ? 19 : 16, C.ink, "font-weight:800;line-height:1.35;")}">${esc(i.value)}</div>
</td></tr></table></td>`,
    )
    .join("");
  return `<table ${TABLE} width="100%" style="margin:0 0 10px;"><tr>${cells}</tr></table>`;
}

/** Two information cards side by side (e.g. delivery / payment). Bodies must already be escaped HTML. */
export function infoCards(cards: { title: string; body: string }[]) {
  const list = cards.filter((c) => c.body);
  if (!list.length) return "";
  const w = Math.floor(100 / list.length);
  const cells = list
    .map(
      (c, idx) => `<td class="em-stack" width="${w}%" valign="top" style="padding:0 ${idx < list.length - 1 ? 10 : 0}px 10px 0;">
<table ${TABLE} width="100%" style="height:100%;"><tr><td class="em-rule" valign="top" style="border:1px solid ${C.rule};border-radius:10px;padding:14px 16px;">
<div class="em-muted" style="${txt(11, C.muted, "font-weight:800;text-transform:uppercase;letter-spacing:0.08em;line-height:1.4;margin-bottom:6px;")}">${esc(c.title)}</div>
<div class="em-text" style="${txt(14, C.ink, "line-height:1.55;")}">${c.body}</div>
</td></tr></table></td>`,
    )
    .join("");
  return `<table ${TABLE} width="100%" style="margin:6px 0 4px;"><tr>${cells}</tr></table>`;
}

export type ProgressState = "done" | "current" | "todo";

/** Order progress tracker (4–5 steps). */
export function progress(steps: { label: string; state: ProgressState }[]) {
  const n = steps.length;
  const w = Math.floor(100 / n);
  const line = (on: boolean, hide: boolean) =>
    `<td style="font-size:0;line-height:0;width:50%;"><div style="height:3px;${hide ? "" : `background:${on ? C.yellow : C.rule};`}font-size:0;line-height:0;">&nbsp;</div></td>`;
  const cells = steps
    .map((s, i) => {
      const leftOn = i > 0 && steps[i - 1].state === "done";
      const rightOn = s.state === "done";
      const dotBg = s.state === "done" ? C.yellow : s.state === "current" ? C.navy : C.white;
      const dotFg = s.state === "done" ? C.navy : s.state === "current" ? C.white : C.faint;
      const dotBorder = s.state === "todo" ? C.rule : dotBg;
      const mark = s.state === "done" ? "&#10003;" : String(i + 1);
      return `<td width="${w}%" align="center" valign="top" style="padding:0;">
<table ${TABLE} width="100%"><tr>${line(leftOn, i === 0)}
<td width="34" style="padding:0;width:34px;min-width:34px;"><table ${TABLE} width="34" style="width:34px;border-collapse:separate;"><tr><td align="center" valign="middle" width="30" height="30" bgcolor="${dotBg}" style="width:30px;height:30px;border-radius:15px;background:${dotBg};border:2px solid ${dotBorder};${txt(13, dotFg, "font-weight:800;line-height:30px;")}">${mark}</td></tr></table></td>
${line(rightOn, i === n - 1)}</tr></table>
<div class="${s.state === "todo" ? "em-muted" : "em-text"}" style="padding:7px 2px 0;${txt(12, s.state === "todo" ? C.faint : C.ink, `font-weight:${s.state === "current" ? 800 : 700};line-height:1.3;`)}">${esc(s.label)}</div>
</td>`;
    })
    .join("");
  return `<table ${TABLE} width="100%" style="margin:0 0 26px;"><tr>${cells}</tr></table>`;
}

export type ItemRow = { name: string; meta?: string | null; qtyLine: string; total: string; image?: string | null };

/** Item list with optional thumbnails: image | name + pack/SKU + "qty × price" | line total. */
export function itemsTable(rows: ItemRow[]) {
  const withImages = rows.some((r) => r.image);
  const trs = rows
    .map(
      (r) => `<tr>
${
  withImages
    ? `<td class="em-rule" valign="top" width="68" style="padding:12px 14px 12px 0;border-bottom:1px solid ${C.rule};width:68px;">
<table ${TABLE}><tr><td align="center" valign="middle" width="64" height="64" bgcolor="${C.white}" style="width:64px;height:64px;border:1px solid ${C.rule};border-radius:10px;background:${C.white};">${
        r.image ? `<img src="${esc(r.image)}" width="52" alt="" style="display:block;width:52px;max-width:52px;height:auto;max-height:56px;border:0;margin:0 auto;">` : `<span style="${txt(20, C.rule, "font-weight:800;")}">&#9679;</span>`
      }</td></tr></table></td>`
    : ""
}
<td class="em-rule" valign="middle" style="padding:12px 12px 12px 0;border-bottom:1px solid ${C.rule};">
<div class="em-text" style="${txt(15, C.ink, "font-weight:700;line-height:1.4;")}">${esc(r.name)}</div>
${r.meta ? `<div class="em-muted" style="${txt(13, C.muted, "line-height:1.5;")}">${esc(r.meta)}</div>` : ""}
<div class="em-muted" style="${txt(13, C.muted, "line-height:1.5;")}">${esc(r.qtyLine)}</div>
</td>
<td class="em-rule em-text" valign="middle" align="right" style="padding:12px 0;border-bottom:1px solid ${C.rule};white-space:nowrap;${txt(15, C.ink, "font-weight:800;line-height:1.4;")}">${esc(r.total)}</td>
</tr>`,
    )
    .join("");
  return `<table ${TABLE} width="100%" style="border-top:1px solid ${C.rule};" class="em-rule">${trs}</table>`;
}

export type TotalRow = { label: string; value: string; strong?: boolean; note?: boolean };

export function totalsTable(rows: TotalRow[]) {
  const trs = rows
    .map((r) => {
      if (r.note) {
        return `<tr><td colspan="2" class="em-muted" style="padding:6px 0 0;${txt(12, C.muted, "line-height:1.5;")}">${esc(r.label)}</td></tr>`;
      }
      const style = r.strong ? txt(19, C.ink, "font-weight:800;") : txt(14, C.muted);
      const pad = r.strong ? "12px 0 2px" : "4px 0";
      const border = r.strong ? `border-top:2px solid ${C.navy};` : "";
      return `<tr><td class="${r.strong ? "em-text" : "em-muted"}" style="padding:${pad};${border}${style}">${esc(r.label)}</td><td class="${r.strong ? "em-text" : "em-muted"}" align="right" style="padding:${pad};${border}white-space:nowrap;${style}">${esc(r.value)}</td></tr>`;
    })
    .join("");
  return `<table ${TABLE} width="100%" style="margin-top:6px;"><tr><td class="em-soft" bgcolor="${C.soft}" style="background:${C.soft};border-radius:10px;padding:12px 16px 14px;">
<table ${TABLE} width="100%">${trs}</table></td></tr></table>`;
}

/** Numbered "what happens next" list. Items must already be escaped HTML. */
export function steps(items: string[]) {
  const list = items.filter(Boolean);
  if (!list.length) return "";
  return `<table ${TABLE} width="100%" style="margin:4px 0 6px;">${list
    .map(
      (s, i) => `<tr><td valign="top" width="34" style="padding:4px 10px 8px 0;width:34px;">
<table ${TABLE}><tr><td align="center" valign="middle" width="24" height="24" bgcolor="${C.navy}" style="width:24px;height:24px;border-radius:12px;background:${C.navy};${txt(12, C.white, "font-weight:800;line-height:24px;")}">${i + 1}</td></tr></table></td>
<td class="em-text" valign="top" style="padding:5px 0 8px;${txt(14, C.ink, "line-height:1.55;")}">${s}</td></tr>`,
    )
    .join("")}</table>`;
}

/** "Need help?" card for customer e-mails. */
export function helpCard(ctx: EmailContext) {
  const { t, company } = ctx;
  const hours = company.hours ? `<div class="em-muted" style="${txt(13, C.muted, "line-height:1.5;margin-top:4px;")}">${esc(t("help.hours", { hours: company.hours }))}</div>` : "";
  return `<table ${TABLE} width="100%" style="margin:30px 0 0;"><tr><td class="em-soft" bgcolor="${C.navySoft}" style="background:${C.navySoft};border-radius:12px;padding:18px 20px;">
<table ${TABLE} width="100%"><tr>
<td class="em-stack" valign="middle" style="padding:0 12px 0 0;">
<div class="em-text" style="${txt(16, C.navy, "font-weight:800;line-height:1.35;")}">${esc(t("help.title"))}</div>
<div class="em-muted" style="${txt(13, C.muted, "line-height:1.5;margin-top:2px;")}">${esc(t("help.text"))}</div>
${hours}
</td>
<td class="em-stack" valign="middle" align="right" style="padding:0;white-space:nowrap;">
<div style="${txt(15, C.navy, "line-height:1.7;")}">&#9742;&nbsp; ${telLink(company.phone)}</div>
<div style="${txt(15, C.navy, "line-height:1.7;")}">&#9993;&nbsp; ${mailtoLink(company.email)}</div>
</td>
</tr></table>
<div class="em-muted" style="${txt(12, C.muted, "line-height:1.5;margin-top:8px;")}">${esc(t("help.reply"))}</div>
</td></tr></table>`;
}

// ───────────────────────── plain text ─────────────────────────
/** Tiny builder for the text/plain alternative. */
export class TextDoc {
  private lines: string[] = [];
  line(s = "") {
    this.lines.push(s);
    return this;
  }
  heading(s: string) {
    if (this.lines.length) this.lines.push("");
    this.lines.push(s.toUpperCase());
    this.lines.push("-".repeat(Math.min(60, s.length)));
    return this;
  }
  kv(rows: [string, string][]) {
    for (const [k, v] of rows) if (v) this.lines.push(`${k}: ${v}`);
    return this;
  }
  gap() {
    this.lines.push("");
    return this;
  }
  toString() {
    return this.lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}

// ───────────────────────── document shell ─────────────────────────
export function companyLines(ctx: EmailContext) {
  const c = ctx.company;
  const addr = c.warehouse || c.address;
  return {
    line1: [c.name, c.reg_no && `${ctx.t("common.regNo")} ${c.reg_no}`, c.vat_no && `${ctx.t("common.vatNo")} ${c.vat_no}`].filter(Boolean).join(" · "),
    line2: [addr, c.phone, c.email].filter(Boolean).join(" · "),
  };
}

export type HeroTone = "default" | "success" | "danger";

export type LayoutOptions = {
  title: string;
  preheader?: string;
  body: string;
  footerNote?: string;
  /** navy header band with eyebrow pill + big title (+ optional intro) */
  hero?: { eyebrow?: string; title: string; intro?: string; tone?: HeroTone };
  /** customer e-mails get the help card + quick links; shop e-mails a compact footer */
  audience?: "customer" | "shop";
};

export function layout(ctx: EmailContext, opts: LayoutOptions) {
  const { t } = ctx;
  const { line1, line2 } = companyLines(ctx);
  const pre = opts.preheader ? esc(opts.preheader) : "";
  const site = ctx.siteUrl.replace(/\/$/, "");
  const siteHost = site.replace(/^https?:\/\//, "");
  const customer = (opts.audience ?? "customer") === "customer";
  const hero = opts.hero;
  const pillBg = hero?.tone === "danger" ? "#ff8a8a" : hero?.tone === "success" ? "#5fe39a" : C.yellow;

  const quick = customer
    ? (
        [
          [ctx.links?.catalog, t("footer.catalog")],
          [ctx.links?.oilFinder, t("footer.oilFinder")],
          [ctx.links?.account, t("footer.account")],
          [ctx.links?.contact, t("footer.contact")],
        ] as [string | undefined, string][]
      )
        .filter(([u]) => safeUrl(u))
        .map(([u, l]) => `<a href="${esc(safeUrl(u)!)}" target="_blank" style="color:${C.navy};font-weight:700;text-decoration:none;">${esc(l)}</a>`)
        .join(`<span style="color:${C.faint};">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>`)
    : "";
  const trust = customer
    ? [t("footer.trust1"), t("footer.trust2"), t("footer.trust3")]
        .map(
          (s) =>
            `<td class="em-stack" align="center" valign="top" width="33%" style="padding:4px 6px;${txt(12, C.muted, "line-height:1.4;font-weight:600;")}"><span style="color:${C.yellow};font-weight:800;">&#10003;</span>&nbsp;${esc(s)}</td>`,
        )
        .join("")
    : "";

  return `<!DOCTYPE html>
<html lang="${esc(ctx.locale)}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(opts.title)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>table,td,div,h1,h2,p,a,span{font-family:Arial,sans-serif !important;}</style><![endif]-->
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
  @media only screen and (max-width:620px) {
    .em-pad { padding-left:20px !important; padding-right:20px !important; }
    .em-outer { padding:0 !important; }
    .em-radius-top, .em-radius-bottom { border-radius:0 !important; }
    .em-stack { display:block !important; width:100% !important; padding-right:0 !important; text-align:left !important; }
    .em-hide { display:none !important; }
    .em-hero-title { font-size:24px !important; }
    .em-kv td { display:block !important; width:auto !important; border-bottom:0 !important; padding:2px 0 !important; }
    .em-kv tr td:last-child { padding-bottom:10px !important; border-bottom:1px solid ${C.rule} !important; }
  }
  @media (prefers-color-scheme: dark) {
    .em-page { background:#0b1120 !important; }
    .em-card { background:#141b2d !important; }
    .em-text, .em-text a { color:#e9edf5 !important; }
    .em-muted { color:#a7b0c2 !important; }
    .em-rule { border-color:#2a3350 !important; }
    .em-soft { background:#1b2439 !important; }
  }
  [data-ogsc] .em-page { background:#0b1120 !important; }
  [data-ogsc] .em-card { background:#141b2d !important; }
  [data-ogsc] .em-text { color:#e9edf5 !important; }
  [data-ogsc] .em-muted { color:#a7b0c2 !important; }
  [data-ogsb] .em-soft { background:#1b2439 !important; }
</style>
</head>
<body class="em-page" style="margin:0;padding:0;background:${C.page};">
${pre ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${pre}${"&#8199;&#65279;&#847; ".repeat(40)}</div>` : ""}
<table ${TABLE} class="em-page" width="100%" bgcolor="${C.page}" style="background:${C.page};">
<tr><td class="em-outer" align="center" style="padding:28px 12px;">
<!--[if mso]><table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table ${TABLE} width="100%" style="max-width:640px;margin:0 auto;">
  <tr><td class="em-pad em-radius-top" bgcolor="${C.navy}" style="background:${C.navy};padding:22px 36px ${hero ? "0" : "22px"};border-radius:14px 14px 0 0;">
    <table ${TABLE} width="100%"><tr>
      <td valign="middle"><a href="${esc(site)}" target="_blank" style="text-decoration:none;"><img src="${esc(ctx.logoUrl)}" width="150" height="28" alt="${esc(t("common.logoAlt"))}" style="display:block;width:150px;height:28px;border:0;color:${C.white};${txt(16, C.white, "font-weight:800;")}"></a></td>
      <td class="em-hide" valign="middle" align="right" style="${txt(12, "#c9d2e6", "line-height:1.4;font-weight:600;")}">${esc(t("common.tagline"))}</td>
    </tr></table>
    ${
      hero
        ? `<table ${TABLE} width="100%"><tr><td style="padding:30px 0 30px;">
      ${hero.eyebrow ? `<table ${TABLE} style="border-collapse:separate;margin:0 0 12px;"><tr><td bgcolor="${pillBg}" style="background:${pillBg};border-radius:20px;padding:5px 12px;${txt(11, C.navyDeep, "font-weight:800;text-transform:uppercase;letter-spacing:0.1em;line-height:1.2;")}">${esc(hero.eyebrow)}</td></tr></table>` : ""}
      <h1 class="em-hero-title" style="margin:0;${txt(28, C.white, "font-weight:800;line-height:1.2;letter-spacing:-0.015em;")}">${esc(hero.title)}</h1>
      ${hero.intro ? `<p style="margin:10px 0 0;${txt(15, "#d5dcec", "line-height:1.6;")}">${esc(hero.intro)}</p>` : ""}
    </td></tr></table>`
        : ""
    }
  </td></tr>
  <tr><td bgcolor="${C.yellow}" style="background:${C.yellow};height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td class="em-card em-pad" bgcolor="${C.white}" style="background:${C.white};padding:32px 36px 34px;">
${opts.body}
${customer ? helpCard(ctx) : ""}
  </td></tr>
  <tr><td class="em-card em-pad em-radius-bottom em-rule" bgcolor="${C.white}" style="background:${C.white};padding:0 36px ${trust ? "24px" : "8px"};border-radius:0 0 14px 14px;">
    ${trust ? `${divider("0 0 16px")}<table ${TABLE} width="100%" style="margin:0 0 4px;"><tr>${trust}</tr></table>` : ""}
  </td></tr>
</table>
<table ${TABLE} width="100%" style="max-width:640px;margin:0 auto;">
  <tr><td class="em-pad" align="center" style="padding:20px 36px 6px;">
    ${quick ? `<p style="margin:0 0 14px;${txt(13, C.navy, "line-height:1.6;")}">${quick}</p>` : ""}
    <p class="em-muted" style="margin:0 0 3px;${txt(12, C.muted, "line-height:1.6;")}">${esc(line1)}</p>
    <p class="em-muted" style="margin:0;${txt(12, C.muted, "line-height:1.6;")}">${esc(line2)}</p>
    <p class="em-muted" style="margin:10px 0 0;${txt(12, C.faint, "line-height:1.6;")}"><a href="${esc(site)}" target="_blank" style="color:${C.muted};font-weight:700;text-decoration:underline;">${esc(siteHost)}</a>${opts.footerNote ? ` · ${esc(opts.footerNote)}` : ""}</p>
  </td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

/** Plain-text footer matching the HTML one. */
export function textFooter(ctx: EmailContext, note?: string) {
  const { line1, line2 } = companyLines(ctx);
  const hours = ctx.company.hours ? ctx.t("help.hours", { hours: ctx.company.hours }) : "";
  return ["", "—", line1, line2, hours, ctx.siteUrl.replace(/\/$/, ""), note ?? ""].filter(Boolean).join("\n");
}
