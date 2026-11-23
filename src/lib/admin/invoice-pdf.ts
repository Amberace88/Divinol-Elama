import "server-only";
import fontkit from "@pdf-lib/fontkit";
import { degrees, PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { readPublicFile } from "@/lib/runtime-files";
import { amountInWordsLv } from "./numwords";

/**
 * A4 invoice PDF (Rēķins / Avansa rēķins / Kredītrēķins), drawn with pdf-lib (pure JS — runs on Node and on
 * Cloudflare Workers). Manrope TTF covers Latvian, Estonian, Lithuanian diacritics and Cyrillic.
 */

export type InvoiceLine = { sku?: string | null; name: string; pack?: string | null; qty: number; unit_net: number | string; line_net: number | string };
export type InvoiceData = {
  number: string;
  type: "invoice" | "proforma" | "credit_note" | string;
  status: string;
  issued_at: string;
  due_at: string | null;
  paid_at?: string | null;
  buyer: Record<string, unknown>;
  seller: Record<string, unknown>;
  lines: InvoiceLine[];
  subtotal_net: number | string;
  vat_rate: number | string;
  vat_amount: number | string;
  total_gross: number | string;
  reverse_charge: boolean;
  notes?: string | null;
  order_number?: string | null;
  default_notes?: string | null;
};

// ───────────── design tokens ─────────────
const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const NAVY = hex("#1e2d51");
const NAVY_DEEP = hex("#111a31");
const BRAND = hex("#ffc10e");
const INK = hex("#1b1f2a");
const MUTED = hex("#5b6475");
const LINE = hex("#e3e7ef");
const PANEL = hex("#f5f7fb");
const ZEBRA = hex("#fafbfd");
const WHITE = rgb(1, 1, 1);
const SUB = hex("#b3c0dc");

const W = 595.28;
const H = 841.89;
const M = 40; // side margin
const FOOTER_Y = 24; // footer baseline area from the bottom
const BOTTOM = 70; // content must stay above this (from the bottom)

const TITLES: Record<string, string> = { invoice: "Rēķins", proforma: "Avansa rēķins", credit_note: "Kredītrēķins" };

const clean = (s: string) => s.replace(/[  ]/g, " ");
const nf = new Intl.NumberFormat("lv-LV", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf4 = new Intl.NumberFormat("lv-LV", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const money = (v: number) => clean(`${nf.format(v)} €`);
const unitMoney = (v: number) => clean(`${nf4.format(v)} €`);
const qtyFmt = (v: number) => clean(new Intl.NumberFormat("lv-LV").format(v));

function date(v: string | null | undefined) {
  if (!v) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00Z`) : new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("lv-LV", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Riga" }).format(d);
}

function s(v: unknown): string {
  return typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
}

function addressLines(a: unknown): string[] {
  if (!a) return [];
  if (typeof a === "string") return [a];
  if (typeof a !== "object") return [];
  const o = a as Record<string, unknown>;
  const street = s(o.street) || s(o.address);
  const city = [s(o.postal_code) || s(o.zip), s(o.city)].filter(Boolean).join(" ");
  const countryMap: Record<string, string> = { LV: "Latvija", EE: "Igaunija", LT: "Lietuva" };
  const country = countryMap[s(o.country)] ?? s(o.country);
  return [[street, city].filter(Boolean).join(", "), country].filter(Boolean);
}

// ───────────── fonts & assets (cached per isolate) ─────────────
type Fonts = { r: Uint8Array; sb: Uint8Array; b: Uint8Array; xb: Uint8Array };
let fontBytes: Promise<Fonts> | null = null;
let logoBytes: Promise<Uint8Array | null> | null = null;

function loadFonts(): Promise<Fonts> {
  fontBytes ??= (async () => {
    const f = (n: string) => readPublicFile(`fonts/manrope/Manrope_${n}.ttf`);
    const [r, sb, b, xb] = await Promise.all([f("400Regular"), f("600SemiBold"), f("700Bold"), f("800ExtraBold")]);
    if (!r || !sb || !b || !xb) {
      fontBytes = null;
      throw new Error("invoice fonts missing");
    }
    return { r, sb, b, xb };
  })();
  return fontBytes;
}

// ───────────── drawing helpers (top-based y) ─────────────
type Ctx = { doc: PDFDocument; page: PDFPage; f: { r: PDFFont; sb: PDFFont; b: PDFFont; xb: PDFFont } };

function text(c: Ctx, str: string, x: number, top: number, size: number, font: PDFFont, color: RGB = INK, align: "left" | "right" = "left") {
  const t = clean(str);
  const w = font.widthOfTextAtSize(t, size);
  c.page.drawText(t, { x: align === "right" ? x - w : x, y: H - top - size * 0.8, size, font, color });
  return w;
}

function rect(c: Ctx, x: number, top: number, w: number, h: number, color: RGB, border?: { color: RGB; width: number }) {
  c.page.drawRectangle({
    x,
    y: H - top - h,
    width: w,
    height: h,
    color,
    ...(border ? { borderColor: border.color, borderWidth: border.width } : {}),
  });
}

function hline(c: Ctx, x1: number, x2: number, top: number, color: RGB = LINE, width = 1) {
  c.page.drawLine({ start: { x: x1, y: H - top }, end: { x: x2, y: H - top }, thickness: width, color });
}

/** Word-wraps `str` to lines no wider than `max` (long words are broken). */
function wrap(str: string, font: PDFFont, size: number, max: number): string[] {
  const out: string[] = [];
  for (const para of clean(str).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const tryLine = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(tryLine, size) <= max) {
        line = tryLine;
        continue;
      }
      if (line) out.push(line);
      if (font.widthOfTextAtSize(word, size) <= max) {
        line = word;
      } else {
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) > max) {
            out.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      }
    }
    out.push(line);
  }
  return out.filter((l, i) => l || i === 0);
}

/** "Key: value" lines, key muted, value wrapped under the available width. Returns the height used. */
function keyValueLines(c: Ctx, rows: [string, string][], x: number, top: number, width: number, size: number) {
  const lh = size * 1.45;
  let y = top;
  for (const [k, v] of rows) {
    const key = `${k}: `;
    const kw = c.f.r.widthOfTextAtSize(key, size);
    const lines = wrap(v, c.f.r, size, width - kw);
    text(c, key, x, y, size, c.f.r, MUTED);
    lines.forEach((l, i) => text(c, l, x + kw, y + i * lh, size, c.f.r, INK));
    y += lines.length * lh;
  }
  return y - top;
}

// ───────────── document ─────────────

export async function renderInvoicePdf(inv: InvoiceData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fb = await loadFonts();
  const [r, sb, b, xb] = await Promise.all([
    doc.embedFont(fb.r, { subset: true }),
    doc.embedFont(fb.sb, { subset: true }),
    doc.embedFont(fb.b, { subset: true }),
    doc.embedFont(fb.xb, { subset: true }),
  ]);
  logoBytes ??= readPublicFile("media/brand/elama-logo.png");
  const logoPng = await logoBytes;
  let logo: PDFImage | null = null;
  if (logoPng) {
    try {
      logo = await doc.embedPng(logoPng);
    } catch {
      logo = null;
    }
  }

  const sign = inv.type === "credit_note" ? -1 : 1;
  const seller = inv.seller ?? {};
  const buyer = inv.buyer ?? {};
  const buyerName = s(buyer.company_name) || s(buyer.name) || s(buyer.email) || "—";
  const vatRate = Number(inv.vat_rate) || 0;
  const total = Number(inv.total_gross) * sign;
  const title = TITLES[inv.type] ?? "Rēķins";
  const notes = s(inv.notes) || s(inv.default_notes);

  doc.setTitle(`${title} ${inv.number}`);
  doc.setAuthor(s(seller.name) || "SIA Elama");
  doc.setCreator("Divinol / SIA Elama");
  doc.setLanguage("lv");

  const f = { r, sb, b, xb };
  const pages: PDFPage[] = [];
  const newPage = (): Ctx => {
    const page = doc.addPage([W, H]);
    pages.push(page);
    return { doc, page, f };
  };
  let c = newPage();

  // ── header band ──
  const BAND = 92;
  rect(c, 0, 0, W, BAND, NAVY);
  const RIGHT_W = 230;
  // yellow block with a slanted left edge
  const slant = 22;
  c.page.drawSvgPath(`M ${W - RIGHT_W - slant} 0 L ${W} 0 L ${W} ${BAND} L ${W - RIGHT_W + slant} ${BAND} Z`, { x: 0, y: H, color: BRAND });
  if (logo) {
    const lw = 150;
    const lh = Math.min(28, (logo.height / logo.width) * lw);
    c.page.drawImage(logo, { x: M, y: H - 30 - lh, width: (logo.width / logo.height) * lh, height: lh });
  } else {
    text(c, "ELAMA", M, 28, 26, xb, WHITE);
  }
  text(c, "OFICIĀLAIS DIVINOL PĀRSTĀVIS LATVIJĀ", M, 64, 7.5, r, SUB);
  text(c, title, W - M, 30, 18, xb, NAVY_DEEP, "right");
  text(c, `Nr. ${inv.number}`, W - M, 54, 11, b, NAVY_DEEP, "right");
  rect(c, 0, BAND, W, 4, NAVY_DEEP);

  if (inv.status === "void") {
    c.page.drawText("ANULĒTS", { x: 120, y: 330, size: 90, font: xb, color: hex("#c2410c"), opacity: 0.12, rotate: degrees(24) });
  }

  let y = BAND + 4 + 22;
  const CW = W - 2 * M;

  // ── meta row ──
  const metaH = 38;
  c.page.drawRectangle({ x: M, y: H - y - metaH, width: CW, height: metaH, borderColor: LINE, borderWidth: 1, color: WHITE });
  const meta: [string, string, RGB][] = [
    ["IZRAKSTĪŠANAS DATUMS", date(inv.issued_at), INK],
    [inv.type === "credit_note" ? "DATUMS" : "APMAKSĀT LĪDZ", inv.type === "credit_note" ? date(inv.issued_at) : date(inv.due_at), INK],
    ["PASŪTĪJUMS", inv.order_number ?? "—", INK],
    ["KOPĀ APMAKSAI", money(total), NAVY],
  ];
  const cellW = CW / 4;
  meta.forEach(([label, value, color], i) => {
    const x = M + i * cellW;
    if (i > 0) c.page.drawLine({ start: { x, y: H - y }, end: { x, y: H - y - metaH }, thickness: 1, color: LINE });
    text(c, label, x + 10, y + 8, 7, r, MUTED);
    text(c, value, x + 10, y + 20, 10, b, color);
  });
  y += metaH + 18;

  // ── parties ──
  const sellerRows = (
    [
      ["Reģ. nr.", s(seller.reg_no)],
      ["PVN nr.", s(seller.vat_no)],
      ["Adrese", s(seller.address)],
      ["Banka", s(seller.bank_name)],
      ["IBAN", s(seller.iban)],
      ["SWIFT", s(seller.swift)],
      ["Tālr.", s(seller.phone)],
      ["E-pasts", s(seller.email)],
    ] as [string, string][]
  ).filter(([, v]) => v);
  const buyerRows = (
    [
      ["Kontaktpersona", s(buyer.company_name) && s(buyer.name) ? s(buyer.name) : ""],
      ["Reģ. nr.", s(buyer.reg_no)],
      ["PVN nr.", s(buyer.vat_no)],
      ["Adrese", addressLines(buyer.address).join(", ") || s(buyer.legal_address)],
      ["E-pasts", s(buyer.email)],
      ["Tālr.", s(buyer.phone)],
    ] as [string, string][]
  ).filter(([, v]) => v);

  const GAP = 16;
  const PW = (CW - GAP) / 2;
  const PAD = 12;
  const measureParty = (name: string, rows: [string, string][]) => {
    const nameLines = wrap(name, xb, 11, PW - 2 * PAD).length;
    const rowLines = rows.reduce((n, [k, v]) => n + wrap(v, r, 8.5, PW - 2 * PAD - r.widthOfTextAtSize(`${k}: `, 8.5)).length, 0);
    return PAD + 12 + nameLines * 15 + rowLines * 8.5 * 1.45 + PAD;
  };
  const partyH = Math.max(measureParty(s(seller.name) || "SIA Elama", sellerRows), measureParty(buyerName, buyerRows));
  const drawParty = (x: number, label: string, name: string, rows: [string, string][]) => {
    c.page.drawRectangle({ x, y: H - y - partyH, width: PW, height: partyH, color: PANEL });
    text(c, label, x + PAD, y + PAD, 7, b, MUTED);
    const nameLines = wrap(name, xb, 11, PW - 2 * PAD);
    nameLines.forEach((l, i) => text(c, l, x + PAD, y + PAD + 12 + i * 15, 11, xb, INK));
    keyValueLines(c, rows, x + PAD, y + PAD + 12 + nameLines.length * 15 + 2, PW - 2 * PAD, 8.5);
  };
  drawParty(M, "PĀRDEVĒJS", s(seller.name) || "SIA Elama", sellerRows);
  drawParty(M + PW + GAP, "PIRCĒJS", buyerName, buyerRows);
  y += partyH + 20;

  // ── items table ──
  const cols = { nr: 22, pack: 60, qty: 40, price: 72, sum: 72 };
  const nameW = CW - 12 - cols.nr - cols.pack - cols.qty - cols.price - cols.sum;
  const colX = {
    nr: M + 6,
    name: M + 6 + cols.nr,
    pack: M + 6 + cols.nr + nameW,
    qtyR: M + 6 + cols.nr + nameW + cols.pack + cols.qty,
    priceR: M + 6 + cols.nr + nameW + cols.pack + cols.qty + cols.price,
    sumR: M + CW - 6,
  };
  const header = () => {
    rect(c, M, y, CW, 20, NAVY);
    const t = y + 6.5;
    text(c, "NR.", colX.nr, t, 7.5, b, WHITE);
    text(c, "NOSAUKUMS", colX.name, t, 7.5, b, WHITE);
    text(c, "IEPAKOJUMS", colX.pack, t, 7.5, b, WHITE);
    text(c, "DAUDZ.", colX.qtyR, t, 7.5, b, WHITE, "right");
    text(c, "CENA BEZ PVN", colX.priceR, t, 7.5, b, WHITE, "right");
    text(c, "SUMMA", colX.sumR, t, 7.5, b, WHITE, "right");
    y += 20;
  };
  header();
  (inv.lines ?? []).forEach((l, i) => {
    const nameLines = wrap(l.name, sb, 9, nameW - 6);
    const packLines = wrap(l.pack || "—", r, 9, cols.pack - 4);
    const rowH = 12 + Math.max(nameLines.length * 12 + (l.sku ? 10 : 0), packLines.length * 12);
    if (y + rowH > H - BOTTOM) {
      c = newPage();
      y = 40;
      header();
    }
    if (i % 2 === 1) rect(c, M, y, CW, rowH, ZEBRA);
    const t = y + 6;
    text(c, `${i + 1}.`, colX.nr, t, 9, r);
    nameLines.forEach((ln, k) => text(c, ln, colX.name, t + k * 12, 9, sb));
    if (l.sku) text(c, `Art. ${l.sku}`, colX.name, t + nameLines.length * 12, 7, r, MUTED);
    packLines.forEach((ln, k) => text(c, ln, colX.pack, t + k * 12, 9, r));
    text(c, qtyFmt(Number(l.qty)), colX.qtyR, t, 9, r, INK, "right");
    text(c, unitMoney(Number(l.unit_net) * sign), colX.priceR, t, 9, r, INK, "right");
    text(c, money(Number(l.line_net) * sign), colX.sumR, t, 9, b, INK, "right");
    y += rowH;
    hline(c, M, M + CW, y);
  });

  // ── totals ──
  const TW = 230;
  const tx = M + CW - TW;
  const totalsH = 12 + 2 * 16 + 6 + 28;
  if (y + totalsH > H - BOTTOM) {
    c = newPage();
    y = 40;
  }
  y += 12;
  text(c, "Summa bez PVN", tx, y, 9, r, MUTED);
  text(c, money(Number(inv.subtotal_net) * sign), tx + TW, y, 9, r, INK, "right");
  y += 16;
  text(c, `PVN ${clean(nf.format(vatRate).replace(/,00$/, ""))}%`, tx, y, 9, r, MUTED);
  text(c, money(Number(inv.vat_amount) * sign), tx + TW, y, 9, r, INK, "right");
  y += 16 + 6;
  rect(c, tx, y, TW, 28, NAVY);
  text(c, "Kopā EUR", tx + 10, y + 8.5, 11, xb, WHITE);
  text(c, money(total), tx + TW - 10, y + 8.5, 11, xb, WHITE, "right");
  y += 28 + 14;

  // ── words, notes ──
  const block = (lines: string[], size: number, lh: number) => {
    const need = lines.length * lh;
    if (y + need > H - BOTTOM) {
      c = newPage();
      y = 40;
    }
    return need;
  };
  {
    const label = "Summa vārdiem: ";
    const lw = r.widthOfTextAtSize(label, 8.5);
    const lines = wrap(amountInWordsLv(total), b, 8.5, CW - lw);
    block(lines, 8.5, 12);
    text(c, label, M, y, 8.5, r, MUTED);
    lines.forEach((ln, i) => text(c, ln, M + lw, y + i * 12, 8.5, b));
    y += lines.length * 12;
  }
  const note = (str: string, bar: RGB, bg: RGB, color: RGB = INK) => {
    const lines = wrap(str, r, 8.5, CW - 20);
    const h = 16 + lines.length * 12;
    y += 10;
    block(lines, 8.5, 12);
    rect(c, M, y, CW, h, bg);
    rect(c, M, y, 3, h, bar);
    lines.forEach((ln, i) => text(c, ln, M + 11, y + 8 + i * 12, 8.5, r, color));
    y += h;
  };
  const para = (str: string, color: RGB = INK) => {
    const lines = wrap(str, r, 8.5, CW);
    y += 10;
    block(lines, 8.5, 12);
    lines.forEach((ln, i) => text(c, ln, M, y + i * 12, 8.5, r, color));
    y += lines.length * 12;
  };
  if (inv.reverse_charge) note("Reverse charge — PVN likuma 143. pants / Article 196 of Directive 2006/112/EC", BRAND, hex("#fff9e6"));
  if (inv.type === "proforma") {
    note(`Lūdzam apmaksāt līdz ${date(inv.due_at)}, maksājuma mērķī norādot avansa rēķina numuru ${inv.number}.`, NAVY, hex("#eef2f9"));
  }
  if (inv.type === "invoice" && s(seller.iban)) para(`Lūdzam apmaksāt līdz ${date(inv.due_at)}, maksājuma mērķī norādot rēķina numuru ${inv.number}.`);
  if (notes) para(notes, MUTED);

  // ── footer on every page ──
  pages.forEach((p, i) => {
    const fc: Ctx = { doc, page: p, f };
    hline(fc, M, W - M, H - FOOTER_Y - 18);
    text(fc, "Rēķins sagatavots elektroniski un ir derīgs bez paraksta.", M, H - FOOTER_Y - 10, 7.5, r, MUTED);
    text(fc, `${inv.number} · ${i + 1}/${pages.length}`, W - M, H - FOOTER_Y - 10, 7.5, r, MUTED, "right");
  });

  return Buffer.from(await doc.save());
}
