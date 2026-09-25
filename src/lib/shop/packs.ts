/** Find the cheapest combination of packs that covers at least `needed` litres/kg. */

export type PackOption = { key: string; size: number; price: number };
export type PackCombo = { total: number; cost: number; items: { key: string; size: number; qty: number; price: number }[] };

const SCALE = 20; // 0.05 L resolution
const MAX_UNITS = 2000 * SCALE;

export function cheapestCombination(options: PackOption[], needed: number): PackCombo | null {
  const packs = options.filter((o) => o.size > 0 && o.price > 0);
  if (!packs.length || !(needed > 0)) return null;
  const target = Math.min(MAX_UNITS, Math.ceil(needed * SCALE - 1e-9));
  const sizes = packs.map((p) => Math.max(1, Math.round(p.size * SCALE)));
  const cost = new Float64Array(target + 1).fill(Infinity);
  const count = new Int32Array(target + 1);
  const pick = new Int32Array(target + 1).fill(-1);
  cost[0] = 0;
  for (let x = 1; x <= target; x++) {
    for (let i = 0; i < packs.length; i++) {
      const prev = Math.max(0, x - sizes[i]);
      const c = cost[prev] + packs[i].price;
      const n = count[prev] + 1;
      if (c < cost[x] - 1e-9 || (Math.abs(c - cost[x]) < 1e-9 && n < count[x])) {
        cost[x] = c;
        count[x] = n;
        pick[x] = i;
      }
    }
  }
  const qty = new Map<number, number>();
  let x = target;
  while (x > 0 && pick[x] >= 0) {
    const i = pick[x];
    qty.set(i, (qty.get(i) ?? 0) + 1);
    x = Math.max(0, x - sizes[i]);
  }
  const items = [...qty.entries()]
    .map(([i, q]) => ({ key: packs[i].key, size: packs[i].size, qty: q, price: packs[i].price }))
    .sort((a, b) => b.size - a.size);
  return {
    items,
    total: Math.round(items.reduce((s, it) => s + it.size * it.qty, 0) * 100) / 100,
    cost: Math.round(cost[target] * 100) / 100,
  };
}
