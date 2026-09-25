/**
 * Pure calculation helpers for the /calculators page (no React, no I/O — unit-testable).
 * All money values are plain numbers in EUR; callers decide whether they are net or gross.
 */

export type Pack = { key: string; size: number; price: number };
export type PackLine = Pack & { qty: number };
export type PackPlan = {
  lines: PackLine[];
  /** litres bought */
  litres: number;
  /** litres left over after covering the requirement */
  leftover: number;
  total: number;
};

const UNITS_PER_L = 100; // work in centilitres so 0.25 L / 0.6 L packs stay exact
const MAX_LITRES = 5000;

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

const toCents = (n: number) => Math.round(n * 100);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Cheapest multiset of packs whose total volume is >= `required` litres (unbounded knapsack, exact DP).
 * Ties are broken by less leftover, then by fewer packs. Returns null when there are no usable packs.
 */
export function cheapestPacks(packs: Pack[], required: number): PackPlan | null {
  const usable = packs.filter((p) => p.size > 0 && p.price >= 0 && Number.isFinite(p.price));
  if (usable.length === 0) return null;
  const need = Math.min(Math.max(required, 0), MAX_LITRES);
  if (need <= 0) return { lines: [], litres: 0, leftover: 0, total: 0 };

  const sizes = usable.map((p) => Math.max(1, Math.round(p.size * UNITS_PER_L)));
  const g = sizes.reduce((a, b) => gcd(a, b));
  const s = sizes.map((x) => x / g);
  const target = Math.ceil((need * UNITS_PER_L) / g - 1e-9);
  const limit = target + Math.max(...s);
  const cost = usable.map((p) => toCents(p.price));

  // dp[t] = min cost (cents) to buy exactly t units; count[t] = packs used; from[t] = last pack index
  const dp = new Float64Array(limit + 1).fill(Infinity);
  const count = new Int32Array(limit + 1);
  const from = new Int16Array(limit + 1).fill(-1);
  dp[0] = 0;
  for (let t = 1; t <= limit; t++) {
    for (let i = 0; i < s.length; i++) {
      const prev = t - s[i];
      if (prev < 0 || dp[prev] === Infinity) continue;
      const c = dp[prev] + cost[i];
      const n = count[prev] + 1;
      if (c < dp[t] || (c === dp[t] && n < count[t])) {
        dp[t] = c;
        count[t] = n;
        from[t] = i;
      }
    }
  }

  let best = -1;
  for (let t = target; t <= limit; t++) {
    if (dp[t] === Infinity) continue;
    if (best < 0 || dp[t] < dp[best] || (dp[t] === dp[best] && (t < best || (t === best && count[t] < count[best])))) best = t;
  }
  if (best < 0) return null;

  const qty = new Map<number, number>();
  for (let t = best; t > 0; t -= s[from[t]]) qty.set(from[t], (qty.get(from[t]) ?? 0) + 1);
  const lines = [...qty.entries()]
    .map(([i, q]) => ({ ...usable[i], qty: q }))
    .sort((a, b) => b.size - a.size);
  const litres = round2(lines.reduce((sum, l) => sum + l.size * l.qty, 0));
  return { lines, litres, leftover: round2(litres - need), total: round2(dp[best] / 100) };
}

/** Cost of covering `required` litres with a single pack size only (e.g. only 1 L bottles). */
export function singlePackCost(pack: Pack, required: number) {
  const qty = required > 0 ? Math.ceil(required / pack.size - 1e-9) : 0;
  return { qty, total: round2(qty * pack.price), litres: round2(qty * pack.size) };
}

/** The reference pack for "vs. small bottles": the 1 L pack, otherwise the smallest one. */
export function referencePack(packs: Pack[]): Pack | null {
  if (packs.length === 0) return null;
  return packs.find((p) => p.size === 1) ?? [...packs].sort((a, b) => a.size - b.size)[0];
}

// ───────────── Fleet ─────────────

export type FleetInput = {
  vehicles: number;
  kmPerYear: number;
  intervalKm: number;
  capacityL: number;
  /** oil top-up between changes, litres per 10 000 km */
  topupPer10k: number;
};

export type FleetResult = {
  changesPerVehicle: number;
  changesTotal: number;
  litresChanges: number;
  litresTopup: number;
  litresTotal: number;
};

export function fleetConsumption(i: FleetInput): FleetResult {
  const vehicles = Math.max(0, i.vehicles);
  const changesPerVehicle = i.intervalKm > 0 ? Math.max(0, i.kmPerYear) / i.intervalKm : 0;
  const changesTotal = vehicles * changesPerVehicle;
  const litresChanges = changesTotal * Math.max(0, i.capacityL);
  const litresTopup = (vehicles * Math.max(0, i.kmPerYear) * Math.max(0, i.topupPer10k)) / 10000;
  return {
    changesPerVehicle: round2(changesPerVehicle),
    changesTotal: round2(changesTotal),
    litresChanges: round2(litresChanges),
    litresTopup: round2(litresTopup),
    litresTotal: round2(litresChanges + litresTopup),
  };
}

/**
 * How many packs of `size` litres a year's consumption needs, and the yearly cost of the oil actually used
 * (litres × price per litre — leftovers roll over to the next year, so comparing pack sizes stays fair).
 */
export function packsFor(litres: number, pack: { size: number; price: number }) {
  const qty = litres > 0 ? Math.ceil(litres / pack.size - 1e-9) : 0;
  const perLitre = pack.size > 0 ? pack.price / pack.size : 0;
  return { qty, total: round2(Math.max(0, litres) * perLitre), perLitre: round2(perLitre) };
}

// ───────────── 2-stroke mix ─────────────

export const TWO_STROKE_RATIOS = [25, 40, 50, 100] as const;

/** Oil in millilitres for `fuelL` litres of petrol at 1:`ratio`. */
export function twoStrokeOilMl(fuelL: number, ratio: number) {
  if (!(ratio > 0) || !(fuelL > 0)) return 0;
  return Math.round((fuelL * 1000) / ratio);
}

// ───────────── Screen-wash dilution ─────────────

/** Approximate freeze point (°C) of a −60 °C concentrate diluted to the given volume fraction. */
export const WASHER_TABLE: ReadonlyArray<readonly [fraction: number, freezeC: number]> = [
  [0, 0],
  [0.25, -8],
  [0.33, -12],
  [0.5, -22],
  [0.67, -35],
  [1, -60],
];

export function washerFreezePoint(fraction: number) {
  const f = Math.min(1, Math.max(0, fraction));
  for (let i = 1; i < WASHER_TABLE.length; i++) {
    const [f0, t0] = WASHER_TABLE[i - 1];
    const [f1, t1] = WASHER_TABLE[i];
    if (f <= f1) return t0 + ((f - f0) / (f1 - f0)) * (t1 - t0);
  }
  return WASHER_TABLE[WASHER_TABLE.length - 1][1];
}

/** Concentrate volume fraction needed for a target freeze point (linear interpolation over WASHER_TABLE). */
export function washerFraction(targetC: number) {
  const t = Math.min(0, Math.max(-60, targetC));
  for (let i = 1; i < WASHER_TABLE.length; i++) {
    const [f0, t0] = WASHER_TABLE[i - 1];
    const [f1, t1] = WASHER_TABLE[i];
    if (t >= t1) return f0 + ((t - t0) / (t1 - t0)) * (f1 - f0);
  }
  return 1;
}

export function washerMix(targetC: number, totalL: number) {
  const fraction = washerFraction(targetC);
  const total = Math.max(0, totalL);
  const concentrate = round2(total * fraction);
  const water = round2(total - concentrate);
  /** parts of water per 1 part concentrate */
  const waterParts = fraction > 0 ? round2((1 - fraction) / fraction) : Infinity;
  return { fraction, concentrate, water, waterParts };
}
