/**
 * Oil Finder scoring engine — pure functions over product approvals/specs (no React, no I/O).
 *
 * Products are matched on their OEM approvals + performance claims (`approvals`) and industry
 * specifications (`specs`, e.g. ACEA / API / JASO / DIN). Every match yields a structured reason
 * so the UI can explain *why* a product is recommended.
 */

export type VehicleType = "car" | "van" | "truck" | "moto" | "garden" | "industry";
export type Fuel = "petrol" | "diesel" | "hybrid" | "lpg";
export type YearBand = "old" | "mid" | "new";

export const VEHICLE_TYPES: VehicleType[] = ["car", "van", "truck", "moto", "garden", "industry"];
export const FUELS: Fuel[] = ["petrol", "diesel", "hybrid", "lpg"];
export const YEAR_BANDS: YearBand[] = ["old", "mid", "new"];

/** Minimal product shape the engine needs (a `ProductSummary` satisfies it). */
export type FinderProduct = {
  slug: string;
  category: string;
  name: string;
  type?: string;
  short?: string;
  sae: string | null;
  iso_vg: string | null;
  specs: string[];
  approvals: string[];
};

export type FinderInput = {
  vehicle: VehicleType;
  /** brand id (car/van/truck) or application id (moto/garden/industry) */
  option: string;
  fuel?: Fuel;
  year?: YearBand;
  dpf?: boolean;
};

export type MatchReason =
  | { kind: "oem"; brand: string; items: string[] }
  | { kind: "soft"; brand: string; items: string[] }
  | { kind: "lowSaps"; items: string[] }
  | { kind: "acea"; items: string[] }
  | { kind: "heavyDuty"; items: string[] }
  | { kind: "cng"; items: string[] }
  | { kind: "viscosity"; sae: string }
  | { kind: "jaso"; items: string[] }
  | { kind: "twoStroke"; items: string[] }
  | { kind: "lawnmower"; sae: string }
  | { kind: "chainOil"; bio: boolean }
  | { kind: "hydraulic"; items: string[]; iso: string }
  | { kind: "gear"; iso: string }
  | { kind: "compressor"; iso: string };

export type FinderResult<T extends FinderProduct = FinderProduct> = {
  product: T;
  score: number;
  /** strong OEM approval match for the selected brand */
  oemMatch: boolean;
  reasons: MatchReason[];
  /** approval/spec strings to highlight in the UI */
  highlights: string[];
};

// ───────────── Brands & applications ─────────────

export type BrandDef = { id: string; label: string; strong?: RegExp; soft?: RegExp };

export const CAR_BRANDS: BrandDef[] = [
  { id: "vag", label: "VW / Audi / Škoda / Seat / Cupra", strong: /\bVW\s*(?:5\d{2}|TL)|Volkswagen/i },
  { id: "bmw", label: "BMW / Mini", strong: /\bBMW\b/i },
  { id: "mb", label: "Mercedes-Benz", strong: /\bMB[- ]?(?:Approval\s*)?22[69]/i },
  { id: "opel", label: "Opel / Chevrolet", strong: /dexos|\bGM\b|Opel/i },
  { id: "ford", label: "Ford", strong: /\bFord\b|WSS-M2C/i },
  { id: "renault", label: "Renault / Dacia / Nissan", strong: /\bRN\s?0\d{3}|Renault\s+RN/i, soft: /Nissan|Dacia/i },
  { id: "psa", label: "Peugeot / Citroën / DS", strong: /\bPSA\b|\bB\s?71\s?\d{4}|Citro[eë]n|Peugeot/i },
  { id: "fiat", label: "Fiat / Alfa Romeo / Jeep", strong: /\bFiat\b|9\.55535/i, soft: /Chrysler|MS-6395/i },
  { id: "volvo", label: "Volvo", strong: /\bVCC\b|Volvo\s+(?:RBS|VCC)/i },
  { id: "porsche", label: "Porsche", strong: /Porsche/i },
  { id: "toyota", label: "Toyota / Lexus", strong: /Toyota|Lexus/i, soft: /ILSAC/i },
  { id: "japan", label: "Honda / Mazda / Mitsubishi / Subaru / Suzuki", strong: /Honda|Mazda|Mitsubishi|Subaru|Suzuki/i, soft: /ILSAC/i },
  { id: "hyundai", label: "Hyundai / Kia", strong: /Hyundai|\bKia\b/i, soft: /ILSAC|API\s*SP/i },
  { id: "other", label: "" },
];

export const TRUCK_BRANDS: BrandDef[] = [
  { id: "man", label: "MAN", strong: /\bMAN\s*(?:M\s*)?\d{3,4}/ },
  { id: "daimler", label: "Mercedes-Benz / Daimler Truck", strong: /\bMB[- ]?(?:Approval\s*)?(?:22[78]|235)|Daimler|Detroit|\bDDC\b/i },
  { id: "volvo", label: "Volvo / Renault Trucks", strong: /\bVolvo\b|\bVDS\b|\bR[LX]D\b|RLD[- ]?\d|Mack/i },
  { id: "scania", label: "Scania", strong: /Scania|\bLDF\b/i },
  { id: "daf", label: "DAF", strong: /\bDAF\b/ },
  { id: "iveco", label: "Iveco", strong: /Iveco|18-1804/i },
  { id: "deere", label: "John Deere", strong: /John\s*Deere|\bJDQ/i },
  { id: "deutz", label: "Claas / Deutz", strong: /Deutz|\bDQC\b|Claas/i },
  { id: "agco", label: "Valtra / Fendt / Massey Ferguson", strong: /Valtra|Fendt|Massey|AGCO/i },
  { id: "cat", label: "CAT / Komatsu", strong: /Caterpillar|\bCat\b|\bECF[- ]?\d|Komatsu/i },
  { id: "other", label: "" },
];

export const APPLICATIONS = {
  moto: ["street", "sport", "heavy", "quad", "twoStroke"],
  garden: ["chainsaw", "trimmer", "mower", "chainOil"],
  industry: ["hydraulic", "hydraulicHv", "gear", "compressor", "chain"],
} as const;

export function hasEngineStep(vehicle: VehicleType) {
  return vehicle === "car" || vehicle === "van" || vehicle === "truck";
}

export function brandsFor(vehicle: VehicleType): BrandDef[] {
  if (vehicle === "car" || vehicle === "van") return CAR_BRANDS;
  if (vehicle === "truck") return TRUCK_BRANDS;
  return [];
}

export function optionsFor(vehicle: VehicleType): string[] {
  if (vehicle === "moto" || vehicle === "garden" || vehicle === "industry") return [...APPLICATIONS[vehicle]];
  return brandsFor(vehicle).map((b) => b.id);
}

export function brandLabel(vehicle: VehicleType, id: string) {
  return brandsFor(vehicle).find((b) => b.id === id)?.label ?? "";
}

// ───────────── Category constants ─────────────

export const CATEGORY = {
  car: "motorellas-vieglajiem",
  truck: "kravas-un-lauksaimniecibas-tehnikai",
  moto: "moto-un-darza-tehnikai",
  hydraulic: "hidrauliskas-ellas",
  industrial: "industrialas-ellas",
} as const;

export const FINDER_CATEGORIES: string[] = Object.values(CATEGORY);

// ───────────── Spec parsing helpers ─────────────

const allStrings = (p: FinderProduct) => [...p.approvals, ...p.specs];

/** ACEA classes mentioned anywhere (e.g. "ACEA A3 / B4" → ["A3","B4"], "ACEA C2-12" → ["C2"]). */
export function aceaClasses(p: FinderProduct): string[] {
  const out = new Set<string>();
  for (const s of allStrings(p)) {
    const i = s.search(/ACEA/i);
    if (i < 0) continue;
    for (const m of s.slice(i + 4).matchAll(/\b([ABCE])(\d{1,2})(?:-\d{2})?\b/g)) out.add(`${m[1]}${m[2]}`);
  }
  return [...out];
}

function aceaSources(p: FinderProduct) {
  return allStrings(p).filter((s) => /ACEA/i.test(s));
}

function matching(strings: string[], re: RegExp) {
  return strings.filter((s) => re.test(s));
}

export function isTwoStroke(p: FinderProduct) {
  return p.specs.some((s) => /JASO\s*F[BCD]|API\s*TC\b|ISO-L-EGD|Global\s*G[BCD]/i.test(s)) || /\b2T\b|zweitakt|two[- ]stroke|divtakt/i.test(`${p.slug} ${p.name}`);
}

export function isMoto4T(p: FinderProduct) {
  return p.category === CATEGORY.moto && p.specs.some((s) => /JASO\s*MA/i.test(s)) && !isTwoStroke(p);
}

export function isLawnmowerOil(p: FinderProduct) {
  return p.category === CATEGORY.moto && !isTwoStroke(p) && !p.specs.some((s) => /JASO\s*MA/i.test(s)) && Boolean(p.sae);
}

export function isChainOil(p: FinderProduct) {
  return /kett|chain|ķēž/i.test(`${p.slug} ${p.name} ${p.type ?? ""}`) && p.category !== CATEGORY.moto;
}

const text = (p: FinderProduct) => `${p.slug} ${p.name} ${p.type ?? ""} ${p.short ?? ""} ${p.specs.join(" ")}`;

const LOW_VISC_NEW = ["0W-16", "0W-20", "5W-20", "0W-30", "5W-30"];
const HIGH_VISC_OLD = ["10W-40", "15W-40", "20W-50", "5W-40"];
const HYBRID_VISC = ["0W-16", "0W-20", "5W-20", "0W-30"];

// ───────────── Scoring ─────────────

function scoreBrand(p: FinderProduct, brand: BrandDef | undefined, reasons: MatchReason[], highlights: Set<string>) {
  if (!brand || brand.id === "other") return { score: 0, oem: false };
  const strings = allStrings(p);
  const strong = brand.strong ? matching(strings, brand.strong) : [];
  if (strong.length) {
    reasons.push({ kind: "oem", brand: brand.label, items: strong });
    strong.forEach((s) => highlights.add(s));
    return { score: 60 + Math.min(strong.length - 1, 3) * 4, oem: true };
  }
  const soft = brand.soft ? matching(strings, brand.soft) : [];
  if (soft.length) {
    reasons.push({ kind: "soft", brand: brand.label, items: soft });
    soft.forEach((s) => highlights.add(s));
    return { score: 22, oem: false };
  }
  return { score: -15, oem: false };
}

function scoreCar(p: FinderProduct, input: FinderInput, reasons: MatchReason[], highlights: Set<string>) {
  let score = 0;
  const acea = aceaClasses(p);
  const src = aceaSources(p);
  const has = (...c: string[]) => c.some((x) => acea.includes(x));
  const lowSaps = acea.some((c) => c.startsWith("C"));
  const passengerAcea = acea.some((c) => /^[ABC]/.test(c));
  const needsLowSaps = Boolean(input.dpf) || input.year === "new";

  if (needsLowSaps) {
    if (lowSaps) {
      score += 30;
      reasons.push({ kind: "lowSaps", items: src });
      src.forEach((s) => highlights.add(s));
    } else score -= 35;
  } else if (input.year === "old") {
    if (has("A3", "B4", "B3")) {
      score += 20;
      reasons.push({ kind: "acea", items: src });
      src.forEach((s) => highlights.add(s));
    } else if (has("A5", "B5")) score += 8;
    if (lowSaps) score += 4;
  } else if (passengerAcea) {
    if (has("A3", "B4", "C3")) score += 15;
    reasons.push({ kind: "acea", items: src });
    src.forEach((s) => highlights.add(s));
  }

  const onlyDiesel = acea.length > 0 && acea.every((c) => c.startsWith("B") || c.startsWith("E"));
  const hasDieselClass = acea.some((c) => /^[BCE]/.test(c));
  if (input.fuel === "diesel" && !hasDieselClass) score -= 25;
  if ((input.fuel === "petrol" || input.fuel === "hybrid" || input.fuel === "lpg") && onlyDiesel) score -= 30;
  if (input.fuel === "petrol" && !passengerAcea && acea.some((c) => c.startsWith("E"))) score -= 10;

  const sae = p.sae ?? "";
  if (input.fuel === "hybrid" && HYBRID_VISC.includes(sae)) {
    score += 15;
    reasons.push({ kind: "viscosity", sae });
  } else if (input.fuel === "lpg" && has("A3", "B4")) {
    score += 10;
  }
  if (input.year === "new" && LOW_VISC_NEW.includes(sae)) score += 5;
  if (input.year === "old" && HIGH_VISC_OLD.includes(sae)) {
    score += 8;
    if (!reasons.some((r) => r.kind === "viscosity")) reasons.push({ kind: "viscosity", sae });
  }
  if (acea.length === 0 && p.approvals.length === 0) score -= 20;
  return score;
}

function scoreTruck(p: FinderProduct, input: FinderInput, reasons: MatchReason[], highlights: Set<string>) {
  let score = 0;
  const acea = aceaClasses(p);
  const strings = allStrings(p);
  const lowSapsSrc = strings.filter((s) => /ACEA[^,]*\bE(6|9|11)\b|API\s*C[JK]-4/i.test(s));
  const needsLowSaps = Boolean(input.dpf) || input.year === "new";
  const heavySrc = aceaSources(p).filter((s) => /\bE\d/.test(s));

  if (needsLowSaps) {
    if (lowSapsSrc.length) {
      score += 30;
      reasons.push({ kind: "lowSaps", items: lowSapsSrc });
      lowSapsSrc.forEach((s) => highlights.add(s));
    } else score -= 30;
  } else if (heavySrc.length) {
    score += input.year === "old" && acea.some((c) => ["E7", "E4", "E2", "E3"].includes(c)) ? 15 : 10;
    reasons.push({ kind: "heavyDuty", items: heavySrc });
    heavySrc.forEach((s) => highlights.add(s));
  }
  if (input.year === "old" && ["15W-40", "20W-50", "SAE 40", "SAE 50"].includes(p.sae ?? "")) score += 5;
  if (input.year === "new" && ["5W-30", "10W-30", "10W-40"].includes(p.sae ?? "")) score += 4;

  if (input.fuel === "lpg") {
    const cng = matching(strings, /CNG|gas/i);
    if (cng.length) {
      score += 20;
      reasons.push({ kind: "cng", items: cng });
      cng.forEach((s) => highlights.add(s));
    }
  }
  if (!heavySrc.length && !p.approvals.length) score -= 20;
  return score;
}

function scoreMoto(p: FinderProduct, option: string, reasons: MatchReason[], highlights: Set<string>): number | null {
  if (option === "twoStroke") {
    if (!isTwoStroke(p) || p.category !== CATEGORY.moto) return null;
    const items = p.specs.filter((s) => /JASO|API|ISO-L|Global/i.test(s));
    reasons.push({ kind: "twoStroke", items });
    items.forEach((s) => highlights.add(s));
    return 40 + (/synth/i.test(p.slug) ? 5 : 0);
  }
  if (!isMoto4T(p)) return null;
  const jaso = p.specs.filter((s) => /JASO/i.test(s));
  reasons.push({ kind: "jaso", items: jaso });
  jaso.forEach((s) => highlights.add(s));
  const sae = p.sae ?? "";
  const pref: Record<string, Record<string, number>> = {
    street: { "10W-40": 25, "5W-40": 18, "10W-60": 6, "20W-50": 4 },
    sport: { "10W-60": 25, "5W-40": 20, "10W-40": 10 },
    heavy: { "20W-50": 30, "10W-40": 8, "10W-60": 6 },
    quad: { "10W-40": 25, "10W-60": 18, "5W-40": 10 },
  };
  const bonus = pref[option]?.[sae] ?? 0;
  if (bonus >= 18) reasons.push({ kind: "viscosity", sae });
  return 30 + bonus + (/MA-?2/i.test(jaso.join(" ")) ? 3 : 0);
}

function scoreGarden(p: FinderProduct, option: string, reasons: MatchReason[], highlights: Set<string>): number | null {
  const twoT = isTwoStroke(p) && p.category === CATEGORY.moto;
  const chain = isChainOil(p);
  const mower = isLawnmowerOil(p);
  const bio = /bio/i.test(`${p.slug} ${p.name}`);
  const push2T = () => {
    const items = p.specs.filter((s) => /JASO|API|ISO-L|Global/i.test(s));
    reasons.push({ kind: "twoStroke", items });
    items.forEach((s) => highlights.add(s));
  };
  if (option === "chainsaw") {
    if (twoT) {
      push2T();
      return 40 + (/synth/i.test(p.slug) ? 4 : 0);
    }
    if (chain) {
      reasons.push({ kind: "chainOil", bio });
      return 34 + (bio ? 4 : 0);
    }
    return null;
  }
  if (option === "trimmer") {
    if (!twoT) return null;
    push2T();
    return 40 + (/synth/i.test(p.slug) ? 4 : 0) + (/dozator|doser/i.test(`${p.slug} ${p.name}`) ? 2 : 0);
  }
  if (option === "mower") {
    if (!mower) return null;
    reasons.push({ kind: "lawnmower", sae: p.sae ?? "" });
    const items = p.specs.filter((s) => /API/i.test(s));
    items.forEach((s) => highlights.add(s));
    return 40 + (p.sae === "10W-30" ? 3 : 0);
  }
  if (option === "chainOil") {
    if (!chain) return null;
    reasons.push({ kind: "chainOil", bio });
    return 40 + (bio ? 5 : 0);
  }
  return null;
}

function scoreIndustry(p: FinderProduct, option: string, reasons: MatchReason[], highlights: Set<string>): number | null {
  const iso = p.iso_vg ?? "";
  const t = text(p);
  if (option === "hydraulic" || option === "hydraulicHv") {
    if (p.category !== CATEGORY.hydraulic || !iso) return null;
    const hv = /hvi|HVLP|51524[- ]?(?:3|3\.? ?daļa)|51524 3/i.test(t);
    const items = p.specs.filter((s) => /DIN|VDMA|AFNOR/i.test(s));
    items.forEach((s) => highlights.add(s));
    reasons.push({ kind: "hydraulic", items, iso });
    const base = option === "hydraulicHv" ? (hv ? 45 : 18) : hv ? 25 : 42;
    return base + (/46/.test(iso) ? 2 : 0);
  }
  if (p.category !== CATEGORY.industrial) return null;
  if (option === "gear") {
    if (!/pārnesum|reduktor|gear|getriebe|CLP|51517/i.test(t) || isChainOil(p)) return null;
    reasons.push({ kind: "gear", iso });
    return 45;
  }
  if (option === "compressor") {
    if (!/kompres|compress|VDL|51\s?506/i.test(t)) return null;
    const items = p.specs.filter((s) => /DIN|ISO/i.test(s));
    items.forEach((s) => highlights.add(s));
    reasons.push({ kind: "compressor", iso });
    return 45;
  }
  if (option === "chain") {
    if (!isChainOil(p)) return null;
    const bio = /bio/i.test(`${p.slug} ${p.name}`);
    reasons.push({ kind: "chainOil", bio });
    return 40 + (bio ? 3 : 0);
  }
  return null;
}

/** Score one product. Returns null when the product is not relevant for the selection at all. */
export function scoreProduct<T extends FinderProduct>(p: T, input: FinderInput): FinderResult<T> | null {
  const reasons: MatchReason[] = [];
  const highlights = new Set<string>();
  let score: number | null = 0;
  let oem = false;

  switch (input.vehicle) {
    case "car":
    case "van": {
      const allowed = input.vehicle === "van" ? [CATEGORY.car, CATEGORY.truck] : [CATEGORY.car];
      if (!allowed.includes(p.category as (typeof allowed)[number])) return null;
      const brand = CAR_BRANDS.find((b) => b.id === input.option);
      const b = scoreBrand(p, brand, reasons, highlights);
      oem = b.oem;
      score = 20 + b.score + scoreCar(p, input, reasons, highlights);
      if (p.category === CATEGORY.truck && !oem) score -= 12;
      break;
    }
    case "truck": {
      if (p.category !== CATEGORY.truck) return null;
      const brand = TRUCK_BRANDS.find((b) => b.id === input.option);
      const b = scoreBrand(p, brand, reasons, highlights);
      oem = b.oem;
      score = 20 + b.score + scoreTruck(p, input, reasons, highlights);
      break;
    }
    case "moto":
      score = scoreMoto(p, input.option, reasons, highlights);
      break;
    case "garden":
      score = scoreGarden(p, input.option, reasons, highlights);
      break;
    case "industry":
      score = scoreIndustry(p, input.option, reasons, highlights);
      break;
  }
  if (score == null) return null;
  // Most specific reasons first
  const order: MatchReason["kind"][] = ["oem", "soft", "lowSaps", "cng", "heavyDuty", "acea", "jaso", "twoStroke", "lawnmower", "chainOil", "hydraulic", "gear", "compressor", "viscosity"];
  reasons.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return { product: p, score, oemMatch: oem, reasons, highlights: [...highlights] };
}

/**
 * Rank products for a selection. Only products with a positive score are returned. Engines that need
 * a low-SAPS oil (DPF or 2015+) only get low-SAPS products when any exist, when the selected brand
 * has 3+ approved products only those are listed; with fewer, others need a clearly positive score.
 */
export function recommend<T extends FinderProduct>(products: T[], input: FinderInput, limit = 6): FinderResult<T>[] {
  const scored = products
    .map((p) => scoreProduct(p, input))
    .filter((r): r is FinderResult<T> => r != null && r.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
  let filtered = scored;
  // DPF / 2015+ engines: never suggest a full-SAPS oil when low-SAPS alternatives exist.
  const needsLowSaps = hasEngineStep(input.vehicle) && (Boolean(input.dpf) || input.year === "new");
  const isLowSaps = (r: FinderResult<T>) => r.reasons.some((x) => x.kind === "lowSaps");
  if (needsLowSaps && filtered.some(isLowSaps)) filtered = filtered.filter(isLowSaps);
  const oemCount = filtered.filter((r) => r.oemMatch).length;
  if (oemCount >= 3) filtered = filtered.filter((r) => r.oemMatch);
  else if (oemCount > 0) filtered = filtered.filter((r) => r.oemMatch || r.score >= 35);
  return filtered.slice(0, limit);
}
