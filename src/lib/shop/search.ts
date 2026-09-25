/** Tiny client-side product search used by the header search and the catalog. */

export type SearchDoc = {
  slug: string;
  name: string;
  type: string;
  category: string;
  sae: string | null;
  iso_vg: string | null;
  specs: string[];
  approvals: string[];
  skus: string[];
  image: string | null;
  /** cheapest net price */
  price_net: number | null;
};

export function normalize(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(\d+)\s*w\s*-?\s*(\d+)/g, "$1w$2")
    .replace(/[,]/g, ".")
    .replace(/[^a-z0-9а-яё.+/]+/g, " ")
    .trim();
}

/** "5w30", "5W-30", "5w 30" → "5w30" so viscosity queries match regardless of formatting. */
function compact(s: string) {
  return normalize(s).replace(/[\s\-./]+/g, "");
}

type Field = { text: string; compact: string; weight: number };

function fields(d: {
  name: string;
  type: string;
  sae: string | null;
  iso_vg: string | null;
  specs: string[];
  approvals: string[];
  skus: string[];
}): Field[] {
  const raw: [string, number][] = [
    [d.name, 10],
    [d.sae ?? "", 8],
    [d.iso_vg ?? "", 8],
    [d.type, 4],
    [d.skus.join(" "), 6],
    [d.approvals.join(" | "), 5],
    [d.specs.join(" | "), 5],
  ];
  return raw.filter(([t]) => t).map(([t, w]) => ({ text: normalize(t), compact: compact(t), weight: w }));
}

const cache = new WeakMap<object, Field[]>();

/** Score a document against a query; 0 = no match. Every query token must match some field. */
export function scoreDoc(
  doc: { name: string; type: string; sae: string | null; iso_vg: string | null; specs: string[]; approvals: string[]; skus: string[] },
  query: string,
) {
  const q = normalize(query);
  if (!q) return 1;
  let f = cache.get(doc);
  if (!f) {
    f = fields(doc);
    cache.set(doc, f);
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  const qc = compact(query);
  let score = 0;
  // whole-query compact match (e.g. "vw504" in "VW 504.00/507.00", "5w30")
  for (const fl of f) if (qc.length >= 2 && fl.compact.includes(qc)) score += fl.weight * 3;
  const wholeMatch = score > 0;
  for (const tok of tokens) {
    let best = 0;
    const tc = compact(tok);
    for (const fl of f) {
      if (fl.text.split(/\s+/).some((w) => w.startsWith(tok))) best = Math.max(best, fl.weight * 2);
      else if (fl.text.includes(tok) || (tc && fl.compact.includes(tc))) best = Math.max(best, fl.weight);
    }
    if (best === 0 && !wholeMatch) return 0;
    score += best;
  }
  return score;
}

export function searchDocs<T extends Parameters<typeof scoreDoc>[0]>(docs: T[], query: string, limit = 8): T[] {
  if (!normalize(query)) return [];
  return docs
    .map((d) => ({ d, s: scoreDoc(d, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.d);
}
