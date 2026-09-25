"use server";

import { z } from "zod";
import { packLabelOf } from "../format";
import {
  AVAILABILITIES,
  AVAILABILITY_LABEL,
  grossOf,
  netOf,
  r4,
  type Availability,
  type HistoryMovement,
  type HistoryPrice,
  type InventoryChange,
  type InventoryRow,
} from "../inventory";
import { parseInventoryCsv } from "../inventory-csv";
import { ActionError, adminAction, must, revalidateCatalog, UUID_RE } from "../server";
import type { requireAdmin } from "../auth";
import { getStoreSettings } from "@/lib/settings";

type Supa = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

async function lvVat() {
  const s = await getStoreSettings();
  const v = Number(s.vat.LV);
  return Number.isFinite(v) && v >= 0 && v < 100 ? v : 21;
}

const uuid = z.string().regex(UUID_RE, "Nederīgs ID");

const changeSchema = z
  .object({
    variant_id: uuid,
    price_net: z.number({ error: "Nederīga cena" }).min(0, "Cena nevar būt negatīva").max(1_000_000, "Cena ir pārāk liela").optional(),
    stock: z.number({ error: "Nederīgs atlikums" }).int("Atlikumam jābūt veselam skaitlim").min(0, "Atlikums nevar būt negatīvs").max(10_000_000).nullable().optional(),
    stock_delta: z.number().int("Izmaiņai jābūt veselam skaitlim").min(-1_000_000).max(1_000_000).optional(),
    availability: z.enum(AVAILABILITIES, { error: "Nederīgs statuss" }).optional(),
    lead_time_days: z.number().int().min(0, "Termiņš nevar būt negatīvs").max(365, "Maksimums 365 dienas").nullable().optional(),
    low_stock_threshold: z.number().int().min(0, "Slieksnis nevar būt negatīvs").max(100_000).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((c) => Object.keys(c).some((k) => k !== "variant_id" && k !== "note"), "Nav ko mainīt");

type ApplyResult = { changed: number; rows: InventoryRow[] };

function rpcError(e: unknown): never {
  const msg = (e as { message?: string })?.message ?? "";
  const m = msg.match(/(variant_not_found|invalid_price|invalid_stock):?(.*)/);
  if (m) {
    const who = m[2]?.trim();
    if (m[1] === "variant_not_found") throw new ActionError("Variants nav atrasts — iespējams, tas ir dzēsts. Pārlādējiet lapu.");
    if (m[1] === "invalid_price") throw new ActionError(`Nederīga cena${who ? ` (${who})` : ""}`);
    throw new ActionError(`Nederīgs atlikums${who ? ` (${who})` : ""}`);
  }
  throw e;
}

async function apply(
  supabase: Supa,
  changes: InventoryChange[],
  reason: "manual" | "bulk" | "import",
  note?: string | null,
): Promise<ApplyResult> {
  const { data, error } = await supabase.rpc("admin_inventory_apply", { p_changes: changes, p_reason: reason, p_note: note ?? null });
  if (error) rpcError(error);
  const res = (data ?? { changed: 0, rows: [] }) as ApplyResult;
  return {
    changed: res.changed,
    rows: res.rows.map((r) => ({ ...r, price_net: Number(r.price_net) })),
  };
}

/** Inline edit of a single variant (price / stock / status / threshold / lead time). */
export async function saveVariantInventory(change: InventoryChange) {
  return adminAction(async ({ supabase }) => {
    const c = changeSchema.parse(change);
    const res = await apply(supabase, [c], "manual");
    revalidateCatalog();
    return res.rows[0] ?? null;
  });
}

/** Bulk change over many variants — one transaction, logged with reason "bulk". */
export async function bulkSaveInventory(changes: InventoryChange[], note?: string) {
  return adminAction(
    async ({ supabase }) => {
      const list = z.array(changeSchema).min(1, "Nav atlasītu variantu").max(2000).parse(changes);
      const res = await apply(supabase, list, "bulk", note ? note.slice(0, 500) : null);
      revalidateCatalog();
      return res;
    },
    (d) => (d.changed ? `Atjaunināti ${d.changed} varianti` : "Izmaiņu nav — vērtības jau bija tādas pašas"),
  );
}

// ───────────────────────── history ─────────────────────────
type MovementDb = Omit<HistoryMovement, "order" | "by"> & {
  orders: { id: string; number: string } | null;
  profiles: { full_name: string | null; email: string } | null;
};
type PriceDb = Omit<HistoryPrice, "by" | "old_net" | "new_net"> & {
  old_net: number | string | null;
  new_net: number | string;
  profiles: { full_name: string | null; email: string } | null;
};

export async function getVariantHistory(variantId: string) {
  return adminAction(async ({ supabase }) => {
    uuid.parse(variantId);
    const [mv, ph] = await Promise.all([
      supabase
        .from("stock_movements")
        .select("id, delta, stock_before, stock_after, availability_before, availability_after, reason, note, created_at, orders(id, number), profiles(full_name, email)")
        .eq("variant_id", variantId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(60),
      supabase
        .from("price_history")
        .select("id, old_net, new_net, reason, created_at, profiles(full_name, email)")
        .eq("variant_id", variantId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(40),
    ]);
    const by = (p: { full_name: string | null; email: string } | null) => (p ? p.full_name || p.email : null);
    const movements: HistoryMovement[] = ((must(mv) ?? []) as unknown as MovementDb[]).map(({ orders, profiles, ...m }) => ({
      ...m,
      order: orders,
      by: by(profiles),
    }));
    const prices: HistoryPrice[] = ((must(ph) ?? []) as unknown as PriceDb[]).map(({ profiles, ...p }) => ({
      ...p,
      old_net: p.old_net == null ? null : Number(p.old_net),
      new_net: Number(p.new_net),
      by: by(profiles),
    }));
    return { movements, prices };
  });
}

// ───────────────────────── CSV import ─────────────────────────
const MAX_CSV = 2_000_000;

type DbVariant = {
  id: string;
  sku: string | null;
  size: number | string | null;
  unit: string;
  price_net: number | string;
  stock: number | null;
  availability: Availability;
  products: { i18n: Record<string, { name?: string }> | null; slug: string } | null;
};

export type ImportField = { field: "price" | "stock" | "status"; from: string; to: string };
export type ImportDiffRow = { line: number; variant_id: string; sku: string | null; name: string; pack: string; fields: ImportField[] };
export type ImportPreview = {
  total: number;
  unchanged: number;
  diff: ImportDiffRow[];
  errors: { line: number; message: string }[];
  columns: string[];
};

async function loadVariants(supabase: Supa) {
  const all: DbVariant[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const batch = (must(
      await supabase
        .from("product_variants")
        .select("id, sku, size, unit, price_net, stock, availability, products(i18n, slug)")
        .order("id")
        .range(from, from + 999),
    ) ?? []) as unknown as DbVariant[];
    all.push(...batch);
    if (batch.length < 1000) break;
  }
  return all;
}

const eur = (n: number, digits = 2) =>
  new Intl.NumberFormat("lv-LV", { minimumFractionDigits: 2, maximumFractionDigits: digits }).format(n) + " €";

async function buildImport(
  supabase: Supa,
  text: string,
  vat: number,
): Promise<{ preview: ImportPreview; changes: InventoryChange[] }> {
  if (typeof text !== "string" || !text.trim()) throw new ActionError("Fails ir tukšs");
  if (text.length > MAX_CSV) throw new ActionError("Fails ir pārāk liels (maks. 2 MB)");
  const parsed = parseInventoryCsv(text);
  if (parsed.fatal) throw new ActionError(parsed.fatal);

  const variants = await loadVariants(supabase);
  const bySku = new Map(variants.filter((v) => v.sku).map((v) => [v.sku!.trim().toLowerCase(), v]));
  const byId = new Map(variants.map((v) => [v.id, v]));

  const errors: ImportPreview["errors"] = [];
  const diff: ImportDiffRow[] = [];
  const changes: InventoryChange[] = [];
  const seen = new Set<string>();
  let unchanged = 0;

  for (const rec of parsed.records) {
    const v = (rec.id && UUID_RE.test(rec.id) ? byId.get(rec.id) : undefined) ?? (rec.sku ? bySku.get(rec.sku.toLowerCase()) : undefined);
    if (!v) {
      errors.push({ line: rec.line, message: `Variants nav atrasts (SKU “${rec.sku ?? rec.id ?? "—"}”)` });
      continue;
    }
    if (rec.errors.length) {
      for (const m of rec.errors) errors.push({ line: rec.line, message: `${v.sku ?? rec.sku ?? ""}: ${m}` });
      continue;
    }
    if (seen.has(v.id)) {
      errors.push({ line: rec.line, message: `SKU “${v.sku ?? v.id}” failā atkārtojas — ņemta vērā pirmā rinda` });
      continue;
    }
    seen.add(v.id);

    const curNet = Number(v.price_net);
    const curGross = grossOf(curNet, vat);
    const c: InventoryChange = { variant_id: v.id };
    const fields: ImportField[] = [];

    // Gross has priority when it differs from the current gross; otherwise the net column is compared.
    if (rec.gross != null && Math.abs(rec.gross - curGross) >= 0.005) {
      c.price_net = netOf(rec.gross, vat);
    } else if (rec.net != null && Math.abs(r4(rec.net) - curNet) >= 0.00005 && (rec.gross == null || Math.abs(grossOf(rec.net, vat) - curGross) >= 0.005)) {
      c.price_net = r4(rec.net);
    }
    if (c.price_net != null && c.price_net !== curNet) {
      fields.push({ field: "price", from: `${eur(curGross)} (${eur(curNet, 4)} bez PVN)`, to: `${eur(grossOf(c.price_net, vat))} (${eur(c.price_net, 4)} bez PVN)` });
    } else delete c.price_net;

    if (rec.stock != null && rec.stock !== v.stock) {
      c.stock = rec.stock;
      fields.push({ field: "stock", from: v.stock == null ? "netiek uzskaitīts" : String(v.stock), to: String(rec.stock) });
    }
    if (rec.status && rec.status !== v.availability) {
      c.availability = rec.status;
      fields.push({ field: "status", from: AVAILABILITY_LABEL[v.availability], to: AVAILABILITY_LABEL[rec.status] });
    }

    if (!fields.length) {
      unchanged++;
      continue;
    }
    changes.push(c);
    diff.push({
      line: rec.line,
      variant_id: v.id,
      sku: v.sku,
      name: v.products?.i18n?.lv?.name ?? v.products?.slug ?? rec.name ?? "—",
      pack: packLabelOf(v.size, v.unit),
      fields,
    });
  }

  return {
    preview: { total: parsed.records.length, unchanged, diff, errors, columns: parsed.columns },
    changes,
  };
}

export async function previewInventoryImport(text: string) {
  return adminAction(async ({ supabase }) => (await buildImport(supabase, text, await lvVat())).preview);
}

/** Re-parses the same file on the server (never trusts a client-side diff) and applies it in one transaction. */
export async function applyInventoryImport(text: string, fileName?: string) {
  return adminAction(
    async ({ supabase }) => {
      const { changes } = await buildImport(supabase, text, await lvVat());
      if (!changes.length) throw new ActionError("Nav izmaiņu, ko piemērot");
      const note = `CSV imports${fileName ? `: ${fileName.slice(0, 120)}` : ""}`;
      const { data, error } = await supabase.rpc("admin_inventory_apply", { p_changes: changes, p_reason: "import", p_note: note });
      if (error) rpcError(error);
      revalidateCatalog();
      return { changed: Number((data as { changed?: number } | null)?.changed ?? 0) };
    },
    (d) => `Importētas izmaiņas: ${d.changed} varianti`,
  );
}
