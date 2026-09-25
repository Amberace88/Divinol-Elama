/** Latvian number-to-words for invoice totals ("Summa vārdiem"). Supports 0 … 999 999 999. */
const ONES = ["nulle", "viens", "divi", "trīs", "četri", "pieci", "seši", "septiņi", "astoņi", "deviņi"];
const TEENS = [
  "desmit",
  "vienpadsmit",
  "divpadsmit",
  "trīspadsmit",
  "četrpadsmit",
  "piecpadsmit",
  "sešpadsmit",
  "septiņpadsmit",
  "astoņpadsmit",
  "deviņpadsmit",
];
const TENS = ["", "", "divdesmit", "trīsdesmit", "četrdesmit", "piecdesmit", "sešdesmit", "septiņdesmit", "astoņdesmit", "deviņdesmit"];

/** Latvian nouns agree with numbers ending in 1 (except 11) in the singular. */
function singular(n: number) {
  return n % 10 === 1 && n % 100 !== 11;
}

function under1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h === 1) parts.push("simts");
  else if (h > 1) parts.push(`${ONES[h]} simti`);
  if (rest >= 20) {
    parts.push(TENS[Math.floor(rest / 10)]);
    if (rest % 10) parts.push(ONES[rest % 10]);
  } else if (rest >= 10) {
    parts.push(TEENS[rest - 10]);
  } else if (rest > 0) {
    parts.push(ONES[rest]);
  }
  return parts.join(" ");
}

export function numberToWordsLv(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return ONES[0];
  if (n > 999_999_999) return String(n);
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  n %= 1_000_000;
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  if (millions) parts.push(millions === 1 ? "miljons" : `${under1000(millions)} ${singular(millions) ? "miljons" : "miljoni"}`);
  if (thousands) parts.push(thousands === 1 ? "tūkstotis" : `${under1000(thousands)} ${singular(thousands) ? "tūkstotis" : "tūkstoši"}`);
  if (rest) parts.push(under1000(rest));
  return parts.join(" ");
}

/** "Simts divdesmit trīs eiro un 45 centi" */
export function amountInWordsLv(amount: number): string {
  const negative = amount < 0;
  const cents = Math.round(Math.abs(amount) * 100);
  const euros = Math.floor(cents / 100);
  const c = cents % 100;
  const words = numberToWordsLv(euros);
  const text = `${negative ? "mīnus " : ""}${words} eiro un ${String(c).padStart(2, "0")} ${singular(c) ? "cents" : "centi"}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
