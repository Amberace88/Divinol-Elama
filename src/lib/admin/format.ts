/** lv-LV formatting helpers (client + server safe). */
const TZ = "Europe/Riga";

const moneyFmt = new Intl.NumberFormat("lv-LV", { style: "currency", currency: "EUR" });
const moneyCompactFmt = new Intl.NumberFormat("lv-LV", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("lv-LV");
const dateFmt = new Intl.DateTimeFormat("lv-LV", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
const dateTimeFmt = new Intl.DateTimeFormat("lv-LV", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});
const shortDateFmt = new Intl.DateTimeFormat("lv-LV", { day: "numeric", month: "short", timeZone: TZ });
const monthFmt = new Intl.DateTimeFormat("lv-LV", { month: "short", year: "2-digit", timeZone: TZ });

export function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const fmtMoney = (v: unknown) => moneyFmt.format(num(v));
export const fmtMoneyCompact = (v: unknown) => moneyCompactFmt.format(num(v));
export const fmtNumber = (v: unknown, digits?: number) =>
  digits == null ? numFmt.format(num(v)) : new Intl.NumberFormat("lv-LV", { maximumFractionDigits: digits }).format(num(v));

function toDate(v: string | Date | null | undefined) {
  if (!v) return null;
  const d = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00Z`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const fmtDate = (v: string | Date | null | undefined) => {
  const d = toDate(v);
  return d ? dateFmt.format(d) : "—";
};
export const fmtDateTime = (v: string | Date | null | undefined) => {
  const d = toDate(v);
  return d ? dateTimeFmt.format(d) : "—";
};
export const fmtShortDate = (v: string | Date | null | undefined) => {
  const d = toDate(v);
  return d ? shortDateFmt.format(d) : "";
};
export const fmtMonth = (v: string | Date | null | undefined) => {
  const d = toDate(v);
  return d ? monthFmt.format(d) : "";
};

/** Relative time in Latvian ("pirms 5 min"). */
export function fmtRelative(v: string | Date | null | undefined) {
  const d = toDate(v);
  if (!d) return "—";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "tikko";
  if (diff < 3600) return `pirms ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `pirms ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `pirms ${Math.floor(diff / 86400)} d.`;
  return fmtDate(d);
}

/** Percentage change current vs previous. null when previous is 0. */
export function deltaPct(cur: number, prev: number): number | null {
  if (!prev) return cur ? null : 0;
  return ((cur - prev) / prev) * 100;
}

export function fmtPct(v: number | null | undefined, digits = 1) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${new Intl.NumberFormat("lv-LV", { maximumFractionDigits: digits }).format(v)}%`;
}

/** Today's date in Riga as YYYY-MM-DD. */
export function todayRiga() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function packLabelOf(size: number | string | null | undefined, unit: string | null | undefined) {
  if (size == null || size === "") return unit === "pcs" ? "gab." : "";
  const n = Number(size);
  const s = Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
  return unit === "kg" ? `${s} kg` : unit === "l" ? `${s} L` : `${s} gab.`;
}
