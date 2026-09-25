import { button, esc, escMultiline, h1, h2, itemsTable, kvTable, layout, money, num, p, TextDoc, textFooter, totalsTable, type EmailContext, type RenderedEmail } from "./layout";
import { itemRows, paymentLabel, shippingSummary, totalRows, type OrderEmailData } from "./order-parts";

/**
 * Notifications for the shop team — always Latvian (like the admin panel), compact,
 * with a button into /admin. Rendered with an `lv` EmailContext.
 */

const MARKET: Record<string, string> = { LV: "Latvija", EE: "Igaunija", LT: "Lietuva" };
const LOCALE_NAME: Record<string, string> = { lv: "latviešu", et: "igauņu", lt: "lietuviešu", en: "angļu", ru: "krievu" };

function mailto(email: string) {
  if (!/^[^@\s<>"]+@[^@\s<>"]+$/.test(email)) return esc(email);
  return `<a href="mailto:${esc(email)}" style="color:#1e2d51;font-weight:700;text-decoration:underline;">${esc(email)}</a>`;
}

function tel(phone: string | null | undefined) {
  if (!phone) return "";
  return `<a href="tel:${esc(phone.replace(/[^\d+]/g, ""))}" style="color:#1e2d51;font-weight:700;text-decoration:none;">${esc(phone)}</a>`;
}

export type ShopNewOrderInput = { order: OrderEmailData; adminUrl: string; invoiceNumber: string | null };

/** 2. New order → shop. */
export function renderShopNewOrder(ctx: EmailContext, input: ShopNewOrderInput): RenderedEmail {
  const o = input.order;
  const c = o.customer ?? {};
  const total = money(num(o.total_gross), "lv");
  const ship = shippingSummary(o, ctx);
  const who = c.company_name || c.name || o.email;
  const b2b = c.b2b ? `B2B${num(c.discount_percent) > 0 ? ` · atlaide ${num(c.discount_percent)}%` : ""}` : c.customer_type === "business" ? "Uzņēmums (nav B2B)" : "Privātpersona";

  const customerRows: [string, string][] = [
    ["Klients", esc(c.name ?? "")],
    ["Uzņēmums", esc(c.company_name ?? "")],
    ["Reģ. Nr.", esc(c.reg_no ?? "")],
    ["PVN Nr.", esc(c.vat_no ?? "")],
    ["Tips", esc(b2b + (o.user_id ? "" : " · viesis"))],
    ["E-pasts", mailto(o.email)],
    ["Tālrunis", tel(o.phone)],
    ["Tirgus / valoda", esc(`${MARKET[o.market] ?? o.market} · ${LOCALE_NAME[o.locale] ?? o.locale}`)],
  ];
  const orderRows: [string, string][] = [
    ["Piegāde", `${esc(ship.method)}${ship.detail ? `<br><span style="font-weight:400;">${esc(ship.detail)}</span>` : ""}`],
    ["Apmaksa", esc(paymentLabel(o, ctx) + (input.invoiceNumber ? ` · ${input.invoiceNumber}` : ""))],
  ];

  const body = [
    h1(`Jauns pasūtījums ${o.number}`),
    p(`<strong>${esc(who)}</strong> · ${esc(total)}`, { margin: "0 0 18px" }),
    kvTable([...customerRows, ...orderRows], { labelWidth: 130 }),
    h2(`Preces (${o.items.reduce((s, i) => s + i.qty, 0)} gab.)`),
    itemsTable(itemRows(o, ctx)),
    totalsTable(totalRows(o, ctx)),
    o.notes ? h2("Klienta piezīme") + p(escMultiline(o.notes), { size: 14 }) : "",
    button(input.adminUrl, "Atvērt adminā"),
  ].join("\n");

  const subject = `Jauns pasūtījums ${o.number} — ${total} (${who})`;
  const html = layout(ctx, { title: subject, preheader: `${who} · ${ship.method} · ${paymentLabel(o, ctx)}`, body });

  const doc = new TextDoc();
  doc.line(`Jauns pasūtījums ${o.number} — ${total}`).gap();
  doc.kv([
    ["Klients", c.name ?? ""],
    ["Uzņēmums", c.company_name ?? ""],
    ["Reģ. Nr.", c.reg_no ?? ""],
    ["PVN Nr.", c.vat_no ?? ""],
    ["Tips", b2b + (o.user_id ? "" : " · viesis")],
    ["E-pasts", o.email],
    ["Tālrunis", o.phone ?? ""],
    ["Piegāde", [ship.method, ship.detail].filter(Boolean).join(" — ")],
    ["Apmaksa", paymentLabel(o, ctx) + (input.invoiceNumber ? ` · ${input.invoiceNumber}` : "")],
  ]);
  doc.heading("Preces");
  for (const r of itemRows(o, ctx)) doc.line(`• ${r.name}${r.meta ? ` (${r.meta})` : ""} — ${r.qtyLine} = ${r.total}`);
  doc.gap();
  for (const r of totalRows(o, ctx)) doc.line(r.note ? r.label : `${r.label}: ${r.value}`);
  if (o.notes) doc.heading("Klienta piezīme").line(o.notes);
  doc.gap().line(`Atvērt adminā: ${input.adminUrl}`);
  return { subject, html, text: doc.toString() + "\n" + textFooter(ctx) };
}

const INQUIRY_TYPE: Record<string, string> = {
  contact: "Kontaktforma",
  b2b: "B2B / sadarbības pieteikums",
  quote: "Cenas pieprasījums",
  oil_finder: "Jautājums ekspertam",
};

export type ShopInquiryInput = {
  type: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
  locale?: string | null;
  extra?: Record<string, unknown> | null;
  adminUrl: string;
};

const EXTRA_LABEL: Record<string, string> = {
  product: "Produkts (slug)",
  product_name: "Produkts",
  car: "Automašīna",
  vehicle: "Automašīna",
  volume: "Apjoms",
  products: "Produkti",
  city: "Pilsēta",
  country: "Valsts",
  industry: "Nozare",
};

function extraRows(extra: Record<string, unknown> | null | undefined): [string, string][] {
  if (!extra) return [];
  return Object.entries(extra)
    .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length))
    .slice(0, 30)
    .map(([k, v]) => [EXTRA_LABEL[k] ?? k.replace(/_/g, " "), (Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)).slice(0, 500)]);
}

/** 6a. Contact form / inquiry → shop. */
export function renderShopInquiry(ctx: EmailContext, input: ShopInquiryInput): RenderedEmail {
  const kind = INQUIRY_TYPE[input.type] ?? input.type;
  const extra = extraRows(input.extra);
  const rows: [string, string][] = [
    ["Veids", esc(kind)],
    ["Vārds", esc(input.name)],
    ["Uzņēmums", esc(input.company ?? "")],
    ["E-pasts", mailto(input.email)],
    ["Tālrunis", tel(input.phone)],
    ["Valoda", esc(input.locale ? LOCALE_NAME[input.locale] ?? input.locale : "")],
    ...extra.map(([k, v]) => [k, esc(v)] as [string, string]),
  ];
  const body = [
    h1(kind),
    p(`No <strong>${esc(input.name)}</strong>${input.company ? ` (${esc(input.company)})` : ""}. Atbildiet uz šo e-pastu, lai rakstītu klientam.`, { size: 14 }),
    kvTable(rows, { labelWidth: 130 }),
    input.message ? h2("Ziņa") + p(escMultiline(input.message), { size: 15 }) : "",
    button(input.adminUrl, "Atvērt pieprasījumus"),
  ].join("\n");
  const subject = `${kind}: ${input.name}${input.company ? ` (${input.company})` : ""}`;
  const html = layout(ctx, { title: subject, preheader: (input.message ?? "").slice(0, 120), body });

  const doc = new TextDoc();
  doc.line(kind).gap();
  doc.kv([
    ["Vārds", input.name],
    ["Uzņēmums", input.company ?? ""],
    ["E-pasts", input.email],
    ["Tālrunis", input.phone ?? ""],
    ["Valoda", input.locale ?? ""],
    ...extra,
  ]);
  if (input.message) doc.heading("Ziņa").line(input.message);
  doc.gap().line(`Atvērt pieprasījumus: ${input.adminUrl}`);
  return { subject, html, text: doc.toString() + "\n" + textFooter(ctx) };
}

export type ShopBusinessApplicationInput = {
  source: "account" | "signup";
  name: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  regNo: string | null;
  vatNo: string | null;
  legalAddress: string | null;
  market?: string | null;
  adminUrl: string;
};

/** 6c. B2B (business account) application → shop. */
export function renderShopBusinessApplication(ctx: EmailContext, input: ShopBusinessApplicationInput): RenderedEmail {
  const who = input.company || input.name || input.email;
  const rows: [string, string][] = [
    ["Uzņēmums", esc(input.company ?? "")],
    ["Reģ. Nr.", esc(input.regNo ?? "")],
    ["PVN Nr.", esc(input.vatNo ?? "")],
    ["Jur. adrese", esc(input.legalAddress ?? "")],
    ["Kontaktpersona", esc(input.name ?? "")],
    ["E-pasts", mailto(input.email)],
    ["Tālrunis", tel(input.phone)],
    ["Tirgus", esc(input.market ? MARKET[input.market] ?? input.market : "")],
    ["Avots", esc(input.source === "signup" ? "Reģistrācija kā uzņēmums" : "Pieteikums klienta kontā")],
  ];
  const body = [
    h1("Jauns B2B pieteikums"),
    p(`<strong>${esc(who)}</strong> vēlas B2B cenas un apmaksu ar rēķinu. Pārbaudiet rekvizītus un apstipriniet vai noraidiet pieteikumu.`, { size: 14 }),
    kvTable(rows, { labelWidth: 130 }),
    button(input.adminUrl, "Atvērt klientu"),
  ].join("\n");
  const subject = `B2B pieteikums: ${who}`;
  const html = layout(ctx, { title: subject, preheader: `${who} · ${input.regNo ?? ""}`, body });
  const doc = new TextDoc();
  doc.line("Jauns B2B pieteikums").gap();
  doc.kv([
    ["Uzņēmums", input.company ?? ""],
    ["Reģ. Nr.", input.regNo ?? ""],
    ["PVN Nr.", input.vatNo ?? ""],
    ["Jur. adrese", input.legalAddress ?? ""],
    ["Kontaktpersona", input.name ?? ""],
    ["E-pasts", input.email],
    ["Tālrunis", input.phone ?? ""],
    ["Avots", input.source === "signup" ? "Reģistrācija kā uzņēmums" : "Pieteikums klienta kontā"],
  ]);
  doc.gap().line(`Atvērt klientu: ${input.adminUrl}`);
  return { subject, html, text: doc.toString() + "\n" + textFooter(ctx) };
}
