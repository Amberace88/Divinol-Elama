import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { amountInWordsLv } from "./numwords";

/**
 * A4 invoice PDF (Rēķins / Avansa rēķins / Kredītrēķins) rendered with @react-pdf/renderer.
 * Manrope TTF (from @expo-google-fonts/manrope) covers Latvian, Estonian, Lithuanian diacritics and Cyrillic.
 */
const FONT_DIR = path.join(process.cwd(), "node_modules", "@expo-google-fonts", "manrope");
const LOGO_PATH = path.join(process.cwd(), "public", "media", "brand", "elama-logo.png");

let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: "Manrope",
    fonts: [
      { src: path.join(FONT_DIR, "400Regular", "Manrope_400Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "600SemiBold", "Manrope_600SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(FONT_DIR, "700Bold", "Manrope_700Bold.ttf"), fontWeight: 700 },
      { src: path.join(FONT_DIR, "800ExtraBold", "Manrope_800ExtraBold.ttf"), fontWeight: 800 },
    ],
  });
  // Keep words intact (no automatic hyphenation of Latvian words).
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

let logoCache: Buffer | null | undefined;
function logo(): Buffer | null {
  if (logoCache !== undefined) return logoCache;
  try {
    logoCache = fs.readFileSync(LOGO_PATH);
  } catch {
    logoCache = null;
  }
  return logoCache;
}

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

const NAVY = "#1e2d51";
const NAVY_DEEP = "#111a31";
const BRAND = "#ffc10e";
const INK = "#1b1f2a";
const MUTED = "#5b6475";
const LINE = "#e3e7ef";

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

const st = StyleSheet.create({
  page: { fontFamily: "Manrope", fontSize: 9, color: INK, paddingBottom: 64, paddingTop: 36 },
  band: { backgroundColor: NAVY, height: 92, flexDirection: "row", alignItems: "stretch", marginTop: -36 },
  bandLeft: { flex: 1, paddingLeft: 40, justifyContent: "center" },
  logo: { width: 150, height: 28 },
  logoText: { color: "#ffffff", fontSize: 26, fontWeight: 800, letterSpacing: 1 },
  logoSub: { color: "#b3c0dc", fontSize: 7.5, marginTop: 5, letterSpacing: 1.2, textTransform: "uppercase" },
  bandRight: { width: 230, backgroundColor: BRAND, justifyContent: "center", paddingRight: 40, alignItems: "flex-end", position: "relative" },
  bandSlant: { position: "absolute", left: -22, top: 0, width: 44, height: 92, backgroundColor: BRAND, transform: "skewX(-14deg)" },
  title: { fontSize: 18, fontWeight: 800, color: NAVY_DEEP, letterSpacing: -0.3 },
  number: { fontSize: 11, fontWeight: 700, color: NAVY_DEEP, marginTop: 2 },
  accent: { height: 4, backgroundColor: NAVY_DEEP },
  body: { paddingHorizontal: 40, paddingTop: 22 },
  metaRow: { flexDirection: "row", borderWidth: 1, borderColor: LINE, borderRadius: 6, marginBottom: 18 },
  metaCell: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, borderRightWidth: 1, borderRightColor: LINE },
  metaLabel: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  metaValue: { fontSize: 10, fontWeight: 700 },
  parties: { flexDirection: "row", gap: 16, marginBottom: 20 },
  party: { flex: 1, backgroundColor: "#f5f7fb", borderRadius: 6, padding: 12 },
  partyLabel: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5, fontWeight: 700 },
  partyName: { fontSize: 11, fontWeight: 800, marginBottom: 4 },
  partyLine: { fontSize: 8.5, marginBottom: 1.5, color: INK },
  partyKey: { color: MUTED },
  th: { flexDirection: "row", backgroundColor: NAVY, color: "#ffffff", borderTopLeftRadius: 4, borderTopRightRadius: 4, paddingVertical: 6, paddingHorizontal: 6 },
  thText: { fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#ffffff" },
  tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: LINE },
  cNr: { width: 22 },
  cName: { flex: 1, paddingRight: 6 },
  cPack: { width: 60 },
  cQty: { width: 40, textAlign: "right" },
  cPrice: { width: 72, textAlign: "right" },
  cSum: { width: 72, textAlign: "right" },
  sku: { fontSize: 7, color: MUTED, marginTop: 1 },
  totals: { marginTop: 12, marginLeft: "auto", width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: NAVY, borderRadius: 4 },
  grandText: { color: "#ffffff", fontSize: 11, fontWeight: 800 },
  words: { marginTop: 14, fontSize: 8.5 },
  note: { marginTop: 10, padding: 8, borderLeftWidth: 3, borderLeftColor: BRAND, backgroundColor: "#fff9e6", fontSize: 8.5 },
  footer: { position: "absolute", left: 40, right: 40, bottom: 24, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTED },
  void: { position: "absolute", top: 330, left: 90, fontSize: 90, color: "#c2410c", opacity: 0.12, fontWeight: 800, transform: "rotate(-24deg)" },
});

function InvoiceDoc({ inv }: { inv: InvoiceData }) {
  const sign = inv.type === "credit_note" ? -1 : 1;
  const seller = inv.seller ?? {};
  const buyer = inv.buyer ?? {};
  const buyerName = s(buyer.company_name) || s(buyer.name) || s(buyer.email) || "—";
  const vatRate = Number(inv.vat_rate) || 0;
  const total = Number(inv.total_gross) * sign;
  const logoBuf = logo();
  const title = TITLES[inv.type] ?? "Rēķins";
  const notes = s(inv.notes) || s(inv.default_notes);

  const sellerRows: [string, string][] = (
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

  const buyerRows: [string, string][] = (
    [
      ["Kontaktpersona", s(buyer.company_name) && s(buyer.name) ? s(buyer.name) : ""],
      ["Reģ. nr.", s(buyer.reg_no)],
      ["PVN nr.", s(buyer.vat_no)],
      ["Adrese", addressLines(buyer.address).join(", ") || s(buyer.legal_address)],
      ["E-pasts", s(buyer.email)],
      ["Tālr.", s(buyer.phone)],
    ] as [string, string][]
  ).filter(([, v]) => v);

  return (
    <Document title={`${title} ${inv.number}`} author={s(seller.name) || "SIA Elama"} creator="Divinol / SIA Elama" language="lv">
      <Page size="A4" style={st.page}>
        <View style={st.band}>
          <View style={st.bandLeft}>
            {logoBuf ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
              <Image src={{ data: logoBuf, format: "png" }} style={st.logo} />
            ) : (
              <Text style={st.logoText}>ELAMA</Text>
            )}
            <Text style={st.logoSub}>Oficiālais Divinol pārstāvis Latvijā</Text>
          </View>
          <View style={st.bandRight}>
            <View style={st.bandSlant} />
            <Text style={st.title}>{title}</Text>
            <Text style={st.number}>Nr. {inv.number}</Text>
          </View>
        </View>
        <View style={st.accent} />

        {inv.status === "void" && <Text style={st.void}>ANULĒTS</Text>}

        <View style={st.body}>
          <View style={st.metaRow}>
            <View style={st.metaCell}>
              <Text style={st.metaLabel}>Izrakstīšanas datums</Text>
              <Text style={st.metaValue}>{date(inv.issued_at)}</Text>
            </View>
            <View style={st.metaCell}>
              <Text style={st.metaLabel}>{inv.type === "credit_note" ? "Datums" : "Apmaksāt līdz"}</Text>
              <Text style={st.metaValue}>{inv.type === "credit_note" ? date(inv.issued_at) : date(inv.due_at)}</Text>
            </View>
            <View style={st.metaCell}>
              <Text style={st.metaLabel}>Pasūtījums</Text>
              <Text style={st.metaValue}>{inv.order_number ?? "—"}</Text>
            </View>
            <View style={[st.metaCell, { borderRightWidth: 0 }]}>
              <Text style={st.metaLabel}>Kopā apmaksai</Text>
              <Text style={[st.metaValue, { color: NAVY }]}>{money(total)}</Text>
            </View>
          </View>

          <View style={st.parties}>
            <View style={st.party}>
              <Text style={st.partyLabel}>Pārdevējs</Text>
              <Text style={st.partyName}>{s(seller.name) || "SIA Elama"}</Text>
              {sellerRows.map(([k, v]) => (
                <Text key={k} style={st.partyLine}>
                  <Text style={st.partyKey}>{k}: </Text>
                  {v}
                </Text>
              ))}
            </View>
            <View style={st.party}>
              <Text style={st.partyLabel}>Pircējs</Text>
              <Text style={st.partyName}>{buyerName}</Text>
              {buyerRows.map(([k, v]) => (
                <Text key={k} style={st.partyLine}>
                  <Text style={st.partyKey}>{k}: </Text>
                  {v}
                </Text>
              ))}
            </View>
          </View>

          <View style={st.th}>
            <Text style={[st.thText, st.cNr]}>Nr.</Text>
            <Text style={[st.thText, st.cName]}>Nosaukums</Text>
            <Text style={[st.thText, st.cPack]}>Iepakojums</Text>
            <Text style={[st.thText, st.cQty]}>Daudz.</Text>
            <Text style={[st.thText, st.cPrice]}>Cena bez PVN</Text>
            <Text style={[st.thText, st.cSum]}>Summa</Text>
          </View>
          {(inv.lines ?? []).map((l, i) => (
            <View key={i} style={[st.tr, i % 2 === 1 ? { backgroundColor: "#fafbfd" } : {}]} wrap={false}>
              <Text style={st.cNr}>{i + 1}.</Text>
              <View style={st.cName}>
                <Text style={{ fontWeight: 600 }}>{l.name}</Text>
                {l.sku ? <Text style={st.sku}>Art. {l.sku}</Text> : null}
              </View>
              <Text style={st.cPack}>{l.pack || "—"}</Text>
              <Text style={st.cQty}>{qtyFmt(Number(l.qty))}</Text>
              <Text style={st.cPrice}>{unitMoney(Number(l.unit_net) * sign)}</Text>
              <Text style={[st.cSum, { fontWeight: 700 }]}>{money(Number(l.line_net) * sign)}</Text>
            </View>
          ))}

          <View style={st.totals} wrap={false}>
            <View style={st.totalRow}>
              <Text style={{ color: MUTED }}>Summa bez PVN</Text>
              <Text>{money(Number(inv.subtotal_net) * sign)}</Text>
            </View>
            <View style={st.totalRow}>
              <Text style={{ color: MUTED }}>PVN {clean(nf.format(vatRate).replace(/,00$/, ""))}%</Text>
              <Text>{money(Number(inv.vat_amount) * sign)}</Text>
            </View>
            <View style={st.grand}>
              <Text style={st.grandText}>Kopā EUR</Text>
              <Text style={st.grandText}>{money(total)}</Text>
            </View>
          </View>

          <Text style={st.words}>
            <Text style={{ color: MUTED }}>Summa vārdiem: </Text>
            <Text style={{ fontWeight: 700 }}>{amountInWordsLv(total)}</Text>
          </Text>

          {inv.reverse_charge && (
            <Text style={st.note}>Reverse charge — PVN likuma 143. pants / Article 196 of Directive 2006/112/EC</Text>
          )}
          {inv.type === "proforma" && (
            <Text style={[st.note, { borderLeftColor: NAVY, backgroundColor: "#eef2f9" }]}>
              Lūdzam apmaksāt līdz {date(inv.due_at)}, maksājuma mērķī norādot avansa rēķina numuru {inv.number}.
            </Text>
          )}
          {inv.type === "invoice" && s(seller.iban) ? (
            <Text style={{ marginTop: 10, fontSize: 8.5 }}>
              Lūdzam apmaksāt līdz {date(inv.due_at)}, maksājuma mērķī norādot rēķina numuru {inv.number}.
            </Text>
          ) : null}
          {notes ? <Text style={{ marginTop: 10, fontSize: 8.5, color: MUTED }}>{notes}</Text> : null}
        </View>

        <View style={st.footer} fixed>
          <Text>Rēķins sagatavots elektroniski un ir derīgs bez paraksta.</Text>
          <Text render={({ pageNumber, totalPages }) => `${inv.number} · ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(inv: InvoiceData): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<InvoiceDoc inv={inv} />);
}
