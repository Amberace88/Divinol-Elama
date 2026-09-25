/**
 * Shared e-mail layout + building blocks (pure — no server-only imports, so templates can be rendered
 * by a preview script too). Table-based, inline styles, 600px max width; tested patterns for
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
};

export type RenderedEmail = { subject: string; html: string; text: string };

// ───────────────────────── tokens ─────────────────────────
export const C = {
  navy: "#1e2d51",
  navyDeep: "#111a31",
  yellow: "#ffc10e",
  ink: "#1b1f2a",
  muted: "#5b6475",
  rule: "#e3e7ef",
  page: "#f3f5f9",
  soft: "#f6f8fb",
  white: "#ffffff",
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

// ───────────────────────── blocks (HTML) ─────────────────────────
const txt = (size = 15, color: string = C.ink, extra = "") =>
  `font-family:${FONT};font-size:${size}px;line-height:1.6;color:${color};${extra}`;

export function h1(text: string) {
  return `<h1 class="em-text" style="margin:0 0 12px;${txt(24, C.ink, "font-weight:800;line-height:1.25;letter-spacing:-0.01em;")}">${esc(text)}</h1>`;
}

export function h2(text: string) {
  return `<h2 class="em-text" style="margin:28px 0 10px;${txt(13, C.ink, "font-weight:800;text-transform:uppercase;letter-spacing:0.06em;")}">${esc(text)}</h2>`;
}

/** Paragraph; `html` must already be escaped. */
export function p(html: string, opts: { muted?: boolean; size?: number; margin?: string } = {}) {
  return `<p class="${opts.muted ? "em-muted" : "em-text"}" style="margin:${opts.margin ?? "0 0 14px"};${txt(opts.size ?? 15, opts.muted ? C.muted : C.ink)}">${html}</p>`;
}

export function button(href: string, label: string) {
  const url = safeUrl(href);
  if (!url) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;border-collapse:separate;">
<tr><td align="center" bgcolor="${C.yellow}" style="border-radius:8px;background:${C.yellow};mso-padding-alt:14px 26px;">
<a href="${esc(url)}" target="_blank" style="display:inline-block;padding:14px 26px;border-radius:8px;background:${C.yellow};color:${C.navy};${txt(15, C.navy, "font-weight:800;line-height:1.2;text-decoration:none;")}">${esc(label)}&nbsp;&rarr;</a>
</td></tr></table>`;
}

export function link(href: string | null | undefined, label: string) {
  const url = safeUrl(href);
  if (!url) return esc(label);
  return `<a href="${esc(url)}" target="_blank" style="color:${C.navy};font-weight:700;text-decoration:underline;">${esc(label)}</a>`;
}

export function divider(margin = "24px 0") {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:${margin};"><tr><td class="em-rule" style="border-top:1px solid ${C.rule};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>`;
}

/** Label / value rows. Values must already be escaped HTML. */
export function kvTable(rows: [string, string][], opts: { labelWidth?: number } = {}) {
  const w = opts.labelWidth ?? 170;
  const trs = rows
    .filter(([, v]) => v !== "")
    .map(
      ([k, v]) =>
        `<tr><td class="em-muted" valign="top" style="padding:5px 12px 5px 0;width:${w}px;${txt(14, C.muted)}">${esc(k)}</td><td class="em-text" valign="top" style="padding:5px 0;${txt(14, C.ink, "font-weight:600;")}">${v}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${trs}</table>`;
}

/** Soft panel with a yellow left edge (payment details, tracking…). `html` must be escaped. */
export function panel(html: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px;">
<tr><td class="em-soft" bgcolor="${C.soft}" style="background:${C.soft};border-left:4px solid ${C.yellow};border-radius:8px;padding:16px 18px;">${html}</td></tr></table>`;
}

export type ItemRow = { name: string; meta?: string | null; qtyLine: string; total: string };

/** Two-column (mobile-friendly) item list: name + pack/SKU + "qty × price" | line total. */
export function itemsTable(rows: ItemRow[]) {
  const trs = rows
    .map(
      (r) => `<tr>
<td class="em-rule" valign="top" style="padding:12px 12px 12px 0;border-bottom:1px solid ${C.rule};">
<div class="em-text" style="${txt(15, C.ink, "font-weight:700;line-height:1.4;")}">${esc(r.name)}</div>
${r.meta ? `<div class="em-muted" style="${txt(13, C.muted, "line-height:1.5;")}">${esc(r.meta)}</div>` : ""}
<div class="em-muted" style="${txt(13, C.muted, "line-height:1.5;")}">${esc(r.qtyLine)}</div>
</td>
<td class="em-rule em-text" valign="top" align="right" style="padding:12px 0;border-bottom:1px solid ${C.rule};white-space:nowrap;${txt(15, C.ink, "font-weight:700;line-height:1.4;")}">${esc(r.total)}</td>
</tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.rule};" class="em-rule">${trs}</table>`;
}

export type TotalRow = { label: string; value: string; strong?: boolean; note?: boolean };

export function totalsTable(rows: TotalRow[]) {
  const trs = rows
    .map((r) => {
      if (r.note) {
        return `<tr><td colspan="2" class="em-muted" style="padding:4px 0;${txt(12, C.muted, "line-height:1.5;")}">${esc(r.label)}</td></tr>`;
      }
      const style = r.strong ? txt(18, C.ink, "font-weight:800;") : txt(14, C.muted);
      const pad = r.strong ? "12px 0 4px" : "4px 0";
      const border = r.strong ? `border-top:2px solid ${C.navy};` : "";
      return `<tr><td class="${r.strong ? "em-text" : "em-muted"}" style="padding:${pad};${border}${style}">${esc(r.label)}</td><td class="${r.strong ? "em-text" : "em-muted"}" align="right" style="padding:${pad};${border}white-space:nowrap;${style}">${esc(r.value)}</td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">${trs}</table>`;
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

export function layout(ctx: EmailContext, opts: { title: string; preheader?: string; body: string; footerNote?: string }) {
  const { line1, line2 } = companyLines(ctx);
  const pre = opts.preheader ? esc(opts.preheader) : "";
  const site = ctx.siteUrl.replace(/\/$/, "");
  const siteHost = site.replace(/^https?:\/\//, "");
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
<style>table,td,div,h1,h2,p,a{font-family:Arial,sans-serif !important;}</style><![endif]-->
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
<table role="presentation" class="em-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
<tr><td class="em-outer" align="center" style="padding:28px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">
  <tr><td class="em-pad em-radius-top" bgcolor="${C.navy}" style="background:${C.navy};padding:22px 36px;border-radius:12px 12px 0 0;">
    <a href="${esc(site)}" target="_blank" style="text-decoration:none;"><img src="${esc(ctx.logoUrl)}" width="150" height="28" alt="${esc(ctx.t("common.logoAlt"))}" style="display:block;width:150px;height:28px;border:0;color:${C.white};${txt(16, C.white, "font-weight:800;")}"></a>
  </td></tr>
  <tr><td bgcolor="${C.yellow}" style="background:${C.yellow};height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td class="em-card em-pad" bgcolor="${C.white}" style="background:${C.white};padding:34px 36px 30px;">
${opts.body}
  </td></tr>
  <tr><td class="em-card em-pad em-radius-bottom em-rule" bgcolor="${C.white}" style="background:${C.white};padding:0 36px 26px;border-radius:0 0 12px 12px;">
    ${divider("0 0 18px")}
    <p class="em-muted" style="margin:0 0 4px;${txt(12, C.muted, "line-height:1.6;")}">${esc(line1)}</p>
    <p class="em-muted" style="margin:0;${txt(12, C.muted, "line-height:1.6;")}">${esc(line2)}</p>
    <p class="em-muted" style="margin:10px 0 0;${txt(12, C.muted, "line-height:1.6;")}"><a href="${esc(site)}" target="_blank" style="color:${C.muted};text-decoration:underline;">${esc(siteHost)}</a>${opts.footerNote ? ` · ${esc(opts.footerNote)}` : ""}</p>
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
  return ["", "—", line1, line2, ctx.siteUrl.replace(/\/$/, ""), note ?? ""].filter((s, i) => i < 5 || s).join("\n");
}
