import { AVAILABILITIES, parseDecimal, type Availability } from "./inventory";

/** Price & stock CSV: tolerant parser for files coming back from Excel / accounting systems (client + server safe). */

export const INVENTORY_CSV_HEADER = ["SKU", "Produkts", "Iepakojums", "Cena bez PVN", "Cena ar PVN (LV)", "Atlikums", "Statuss", "ID"] as const;

export type CsvColumn = "sku" | "id" | "name" | "pack" | "net" | "gross" | "stock" | "status";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Order matters: first match wins.
const HEADER_KEYS: [CsvColumn, string[]][] = [
  ["id", ["id", "variantid", "variantaid"]],
  ["sku", ["sku", "artikuls", "artikulanr", "kods", "code", "itemcode"]],
  ["gross", ["cenaarpvn", "arpvn", "gross", "pricegross", "grossprice", "cenaarpvnlv"]],
  ["net", ["cenabezpvn", "bezpvn", "net", "pricenet", "netprice", "cenaneto"]],
  ["stock", ["atlikums", "stock", "daudzums", "qty", "quantity", "noliktava"]],
  ["status", ["statuss", "status", "pieejamiba", "availability"]],
  ["name", ["produkts", "nosaukums", "name", "product", "productname"]],
  ["pack", ["iepakojums", "pack", "izmers", "size"]],
];

function columnOf(header: string): CsvColumn | null {
  const h = norm(header);
  if (!h) return null;
  for (const [col, keys] of HEADER_KEYS) if (keys.some((k) => h === k || h.startsWith(k))) return col;
  return null;
}

function detectDelimiter(firstLine: string) {
  const counts = { ";": 0, ",": 0, "\t": 0 } as Record<string, number>;
  let q = false;
  for (const ch of firstLine) {
    if (ch === '"') q = !q;
    else if (!q && ch in counts) counts[ch]++;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[1] ?? 0) > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ";";
}

/** RFC 4180-ish parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const d = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === d) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const STATUS_WORDS: Record<string, Availability> = {
  instock: "in_stock",
  noliktava: "in_stock",
  irnoliktava: "in_stock",
  pieejams: "in_stock",
  zemsatlikums: "in_stock",
  lowstock: "in_stock",
  onorder: "on_order",
  pecpasutijuma: "on_order",
  backorder: "on_order",
  onbackorder: "on_order",
  outofstock: "out_of_stock",
  navnoliktava: "out_of_stock",
  navpieejams: "out_of_stock",
  discontinued: "discontinued",
  iznemtsnoparobas: "discontinued",
  iznemts: "discontinued",
  izbeigts: "discontinued",
};

export function parseStatus(s: string): Availability | null | "invalid" {
  const t = s.trim();
  if (!t) return null;
  if ((AVAILABILITIES as readonly string[]).includes(t)) return t as Availability;
  return STATUS_WORDS[norm(t)] ?? "invalid";
}

export type CsvRecord = {
  line: number;
  sku: string | null;
  id: string | null;
  name: string | null;
  net: number | null;
  gross: number | null;
  stock: number | null;
  status: Availability | null;
  errors: string[];
};

export type ParsedInventoryCsv = { columns: CsvColumn[]; records: CsvRecord[]; fatal: string | null };

export function parseInventoryCsv(text: string): ParsedInventoryCsv {
  const rows = parseCsv(text);
  if (rows.length < 2) return { columns: [], records: [], fatal: "Failā nav datu rindu (vajadzīga galvene un vismaz viena rinda)." };
  const header = rows[0].map(columnOf);
  const columns = [...new Set(header.filter(Boolean) as CsvColumn[])];
  const idx = (c: CsvColumn) => header.indexOf(c);
  if (idx("sku") < 0 && idx("id") < 0) return { columns, records: [], fatal: "Nav atrasta kolonna “SKU” (vai “ID”)." };
  if (idx("net") < 0 && idx("gross") < 0 && idx("stock") < 0 && idx("status") < 0)
    return { columns, records: [], fatal: "Nav atrasta neviena maināma kolonna (cena, atlikums vai statuss)." };

  const get = (r: string[], c: CsvColumn) => {
    const i = idx(c);
    return i >= 0 ? (r[i] ?? "").trim().replace(/^'(?=[=+\-@])/, "") : "";
  };

  const records: CsvRecord[] = rows.slice(1).map((r, i) => {
    const errors: string[] = [];
    const num = (c: CsvColumn, label: string, int = false) => {
      const raw = get(r, c);
      const n = parseDecimal(raw);
      if (n == null) return null;
      if (Number.isNaN(n) || n < 0 || n > 1_000_000 || (int && !Number.isInteger(n))) {
        errors.push(`${label}: nederīga vērtība “${raw}”`);
        return null;
      }
      return n;
    };
    const st = parseStatus(get(r, "status"));
    if (st === "invalid") errors.push(`Statuss: nezināma vērtība “${get(r, "status")}”`);
    return {
      line: i + 2,
      sku: get(r, "sku") || null,
      id: get(r, "id") || null,
      name: get(r, "name") || null,
      net: num("net", "Cena bez PVN"),
      gross: num("gross", "Cena ar PVN"),
      stock: num("stock", "Atlikums", true),
      status: st === "invalid" ? null : st,
      errors,
    };
  });
  return { columns, records, fatal: null };
}
