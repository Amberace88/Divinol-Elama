/** Excel-friendly CSV (lv-LV): semicolon separated, comma decimals, UTF-8 BOM. */
type Cell = string | number | boolean | null | undefined;

function cell(v: Cell): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "number") s = Number.isFinite(v) ? String(Math.round(v * 100) / 100).replace(".", ",") : "";
  else if (typeof v === "boolean") s = v ? "jā" : "nē";
  else s = v;
  // Prevent CSV/formula injection in spreadsheet apps.
  if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
}
