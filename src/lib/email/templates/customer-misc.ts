import { button, esc, fmtDate, h1, kvTable, layout, money, p, panel, TextDoc, textFooter, type EmailContext, type RenderedEmail } from "./layout";

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

  const plainRows: [string, string][] = [
    [t("invoiceIssued.document"), `${type} ${inv.number}`],
    [t("common.orderNumber"), input.orderNumber ?? ""],
    [t("invoiceIssued.issued"), fmtDate(inv.issued_at, locale)],
    [t("invoiceIssued.due"), isCredit || !inv.due_at ? "" : fmtDate(inv.due_at, locale)],
    [t("invoiceIssued.amount"), total],
  ];
  const rows: [string, string][] = plainRows.map(([k, v], i) => [k, i === plainRows.length - 1 ? `<span style="font-weight:800;">${esc(v)}</span>` : esc(v)]);
  const bankRows: [string, string][] =
    !isCredit && company.iban
      ? [
          [t("payment.recipient"), esc(company.name)],
          [t("payment.bank"), esc(company.bank_name ?? "")],
          [t("payment.iban"), esc(company.iban)],
          [t("payment.swift"), esc(company.swift ?? "")],
          [t("payment.reference"), esc(inv.number)],
        ]
      : [];

  const body = [
    h1(`${type} ${inv.number}`),
    p(esc(greeting), { margin: "0 0 6px" }),
    p(esc(intro)),
    panel(kvTable(rows, { labelWidth: 150 })),
    bankRows.length ? p(esc(t("invoiceIssued.payWith")), { size: 14, margin: "4px 0 8px" }) + kvTable(bankRows, { labelWidth: 150 }) : "",
    isCredit ? p(esc(t("invoiceIssued.creditNote")), { muted: true, size: 14, margin: "14px 0 0" }) : "",
    inv.reverse_charge ? p(esc(t("totals.reverseCharge")), { muted: true, size: 12, margin: "12px 0 0" }) : "",
    p(esc(input.attached ? t("invoiceIssued.attached") : t("invoiceIssued.noAttachment")), { muted: true, size: 13, margin: "16px 0 0" }),
    input.invoicesUrl ? button(input.invoicesUrl, t("invoiceIssued.cta")) : "",
    p(esc(t("common.questions", { phone: company.phone, email: company.email })), { muted: true, size: 13, margin: "22px 0 0" }),
  ].join("\n");

  const subject = t("invoiceIssued.subject", { type, number: inv.number });
  const html = layout(ctx, { title: subject, preheader: t("invoiceIssued.preheader", { type, number: inv.number, total }), body });

  const doc = new TextDoc();
  doc.line(`${type} ${inv.number}`).gap().line(greeting).line(intro).gap();
  doc.kv(plainRows);
  if (bankRows.length) {
    doc.gap().line(t("invoiceIssued.payWith"));
    doc.kv([
      [t("payment.recipient"), company.name],
      [t("payment.bank"), company.bank_name ?? ""],
      [t("payment.iban"), company.iban ?? ""],
      [t("payment.swift"), company.swift ?? ""],
      [t("payment.reference"), inv.number],
    ]);
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
  const k = input.decision === "approved" ? "b2bApproved" : "b2bRejected";
  const greeting = input.name ? t("common.greeting", { name: input.name }) : t("common.greetingAnon");
  const companyName = input.company || t("b2b.yourCompany");
  const bullets: string[] = [];
  if (input.decision === "approved") {
    bullets.push(t("b2bApproved.prices"));
    if (input.discountPercent > 0) bullets.push(t("b2bApproved.discount", { percent: input.discountPercent }));
    if (input.termsDays > 0) bullets.push(t("b2bApproved.terms", { days: input.termsDays }));
    bullets.push(t("b2bApproved.reverse"));
  }
  const body = [
    h1(t(`${k}.title`)),
    p(esc(greeting), { margin: "0 0 6px" }),
    p(esc(t(`${k}.intro`, { company: companyName }))),
    bullets.length ? panel(bullets.map((b) => p(`&#10003;&nbsp; ${esc(b)}`, { margin: "0 0 6px", size: 14 })).join("")) : "",
    input.decision === "rejected" ? p(esc(t("b2bRejected.text"))) : "",
    button(input.decision === "approved" ? input.catalogUrl : input.contactUrl, t(`${k}.cta`)),
    p(esc(t("common.questions", { phone: company.phone, email: company.email })), { muted: true, size: 13, margin: "22px 0 0" }),
  ].join("\n");
  const subject = t(`${k}.subject`);
  const html = layout(ctx, { title: subject, preheader: t(`${k}.intro`, { company: companyName }), body });

  const doc = new TextDoc();
  doc.line(t(`${k}.title`)).gap().line(greeting).line(t(`${k}.intro`, { company: companyName }));
  if (bullets.length) doc.gap().line(bullets.map((b) => `• ${b}`).join("\n"));
  if (input.decision === "rejected") doc.gap().line(t("b2bRejected.text"));
  doc.gap().line(`${t(`${k}.cta`)}: ${input.decision === "approved" ? input.catalogUrl : input.contactUrl}`);
  doc.gap().line(t("common.questions", { phone: company.phone, email: company.email }));
  return { subject, html, text: doc.toString() + "\n" + textFooter(ctx) };
}
