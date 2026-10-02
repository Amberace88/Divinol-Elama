import { buttons, esc, fmtDate, kvTable, layout, money, p, panel, statCards, TextDoc, textFooter, type EmailContext, type RenderedEmail } from "./layout";

export type InvoiceIssuedInput = {
  invoice: { number: string; type: string; issued_at: string; due_at: string | null; total_gross: number; reverse_charge: boolean };
  orderNumber: string | null;
  customerName: string | null;
  attached: boolean;
  /** account invoices page (registered customers) */
  invoicesUrl: string | null;
};

const INVOICE_TYPES = { invoice: 1, proforma: 1, credit_note: 1 } as const;

/** 5. Invoice issued → customer (PDF attached; account link for registered customers). */
export function renderInvoiceIssued(ctx: EmailContext, input: InvoiceIssuedInput): RenderedEmail {
  const { t, locale, company } = ctx;
  const inv = input.invoice;
  const type = t(`invoiceIssued.types.${inv.type in INVOICE_TYPES ? inv.type : "invoice"}`);
  const total = money(inv.total_gross, locale);
  const greeting = input.customerName ? t("common.greeting", { name: input.customerName }) : t("common.greetingAnon");
  const intro = input.orderNumber ? t("invoiceIssued.intro", { type, number: inv.number, order: input.orderNumber }) : t("invoiceIssued.introNoOrder", { type, number: inv.number });
  const isCredit = inv.type === "credit_note";
  const due = isCredit || !inv.due_at ? "" : fmtDate(inv.due_at, locale);

  const plainRows: [string, string][] = [
    [t("invoiceIssued.document"), `${type} ${inv.number}`],
    [t("common.orderNumber"), input.orderNumber ?? ""],
    [t("invoiceIssued.issued"), fmtDate(inv.issued_at, locale)],
    [t("invoiceIssued.due"), due],
    [t("invoiceIssued.amount"), total],
  ];
  const bankPlain: [string, string][] =
    !isCredit && company.iban
      ? [
          [t("payment.recipient"), company.name],
          [t("common.regNo"), company.reg_no],
          [t("payment.bank"), company.bank_name ?? ""],
          [t("payment.iban"), company.iban],
          [t("payment.swift"), company.swift ?? ""],
          [t("payment.reference"), inv.number],
          [t("payment.amount"), total],
        ]
      : [];
  const strongKeys = new Set([t("payment.iban"), t("payment.reference"), t("payment.amount")]);
  const bankRows: [string, string][] = bankPlain.map(([k, v]) => [k, strongKeys.has(k) ? `<span style="font-weight:800;letter-spacing:0.02em;">${esc(v)}</span>` : esc(v)]);

  const body = [
    p(esc(greeting), { margin: "0 0 6px", size: 16 }),
    p(esc(intro), { margin: "0 0 20px" }),
    statCards([
      { label: t("invoiceIssued.issued"), value: fmtDate(inv.issued_at, locale) },
      { label: t("invoiceIssued.due"), value: due },
      { label: t("invoiceIssued.amount"), value: total, strong: true },
    ]),
    panel(kvTable(plainRows.map(([k, v]) => [k, esc(v)]), { labelWidth: 150 }), "info"),
    bankRows.length ? p(`<strong>${esc(t("invoiceIssued.payWith"))}</strong>`, { size: 14, margin: "8px 0 4px" }) + panel(kvTable(bankRows, { labelWidth: 150 })) : "",
    isCredit ? panel(p(esc(t("invoiceIssued.creditNote")), { size: 14, margin: "0" }), "success") : "",
    inv.reverse_charge ? p(esc(t("totals.reverseCharge")), { muted: true, size: 12, margin: "8px 0 0" }) : "",
    p(`${input.attached ? "&#128206;&nbsp; " : ""}${esc(input.attached ? t("invoiceIssued.attached") : t("invoiceIssued.noAttachment"))}`, { muted: true, size: 13, margin: "12px 0 0" }),
    input.invoicesUrl ? buttons([{ href: input.invoicesUrl, label: t("invoiceIssued.cta") }]) : "",
  ].join("\n");

  const subject = t("invoiceIssued.subject", { type, number: inv.number });
  const html = layout(ctx, {
    title: subject,
    preheader: t("invoiceIssued.preheader", { type, number: inv.number, total }),
    hero: { eyebrow: t("invoiceIssued.eyebrow"), title: `${type} ${inv.number}`, intro: `${t("invoiceIssued.amount")}: ${total}${input.orderNumber ? ` · ${t("common.orderNumber")} ${input.orderNumber}` : ""}` },
    body,
  });

  const doc = new TextDoc();
  doc.line(`${type} ${inv.number}`).gap().line(greeting).line(intro).gap();
  doc.kv(plainRows);
  if (bankPlain.length) {
    doc.gap().line(t("invoiceIssued.payWith"));
    doc.kv(bankPlain);
  }
  if (isCredit) doc.gap().line(t("invoiceIssued.creditNote"));
  if (inv.reverse_charge) doc.gap().line(t("totals.reverseCharge"));
  doc.gap().line(input.attached ? t("invoiceIssued.attached") : t("invoiceIssued.noAttachment"));
  if (input.invoicesUrl) doc.gap().line(`${t("invoiceIssued.cta")}: ${input.invoicesUrl}`);
  doc.gap().line(t("common.questions", { phone: company.phone, email: company.email }));
  return { subject, html, text: doc.toString() + "\n" + textFooter(ctx) };
}

export type B2BDecisionInput = {
  decision: "approved" | "rejected";
  name: string | null;
  company: string | null;
  discountPercent: number;
  termsDays: number;
  catalogUrl: string;
  contactUrl: string;
};

/** 6b. B2B application approved / rejected → customer. */
export function renderB2BDecision(ctx: EmailContext, input: B2BDecisionInput): RenderedEmail {
  const { t, company } = ctx;
  const approved = input.decision === "approved";
  const k = approved ? "b2bApproved" : "b2bRejected";
  const greeting = input.name ? t("common.greeting", { name: input.name }) : t("common.greetingAnon");
  const companyName = input.company || t("b2b.yourCompany");
  const bullets: string[] = [];
  if (approved) {
    bullets.push(t("b2bApproved.prices"));
    if (input.discountPercent > 0) bullets.push(t("b2bApproved.discount", { percent: input.discountPercent }));
    if (input.termsDays > 0) bullets.push(t("b2bApproved.terms", { days: input.termsDays }));
    bullets.push(t("b2bApproved.reverse"));
  }
  const body = [
    p(esc(greeting), { margin: "0 0 18px", size: 16 }),
    approved && (input.discountPercent > 0 || input.termsDays > 0)
      ? statCards([
          { label: "B2B", value: companyName },
          { label: "%", value: input.discountPercent > 0 ? `−${input.discountPercent}%` : "", strong: true },
          { label: t("payment.methods.invoice"), value: input.termsDays > 0 ? `${input.termsDays} d.` : "" },
        ])
      : "",
    bullets.length
      ? panel(bullets.map((b) => p(`<span style="color:#16a34a;font-weight:800;">&#10003;</span>&nbsp; ${esc(b)}`, { margin: "0 0 6px", size: 14 })).join(""), "success")
      : "",
    !approved ? p(esc(t("b2bRejected.text"))) : "",
    buttons([{ href: approved ? input.catalogUrl : input.contactUrl, label: t(`${k}.cta`) }]),
  ].join("\n");
  const subject = t(`${k}.subject`);
  const html = layout(ctx, {
    title: subject,
    preheader: t(`${k}.intro`, { company: companyName }),
    hero: { eyebrow: t(`${k}.eyebrow`), title: t(`${k}.title`), intro: t(`${k}.intro`, { company: companyName }), tone: approved ? "success" : "default" },
    body,
  });

  const doc = new TextDoc();
  doc.line(t(`${k}.title`)).gap().line(greeting).line(t(`${k}.intro`, { company: companyName }));
  if (bullets.length) doc.gap().line(bullets.map((b) => `• ${b}`).join("\n"));
  if (!approved) doc.gap().line(t("b2bRejected.text"));
  doc.gap().line(`${t(`${k}.cta`)}: ${approved ? input.catalogUrl : input.contactUrl}`);
  doc.gap().line(t("common.questions", { phone: company.phone, email: company.email }));
  return { subject, html, text: doc.toString() + "\n" + textFooter(ctx) };
}
