import "server-only";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getCategories, getProducts, productText } from "@/lib/catalog";
import { displayPrice, formatMoney, packLabel, pricePerUnit, regularPrice, round2, unitNet, VAT_RATES, variantKey, type PriceContext } from "@/lib/commerce";
import { recommend, type FinderInput, type FinderProduct } from "@/lib/finder";
import { getStoreSettings } from "@/lib/settings";
import { cheapestCombination } from "@/lib/shop/packs";
import { quoteShippingFromSettings, type ShipMethodId } from "@/lib/shop/shipping";
import { searchDocs } from "@/lib/shop/search";
import { createPublicClient } from "@/lib/supabase/server";
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/service";
import { notifyInquiry } from "@/lib/email/notify";
import { deferEmail } from "@/lib/email/send";
import { checkInquirySpam } from "@/lib/spam";
import type { Market, Product, Variant } from "@/lib/types";
import type { ToolDef } from "./anthropic";

/** What the browser sends along with every message: the visitor's cart (prices are re-read from the catalog). */
export type ClientCartLine = { slug: string; key: string; qty: number };

export type ToolContext = {
  locale: Locale;
  market: Market;
  price: PriceContext;
  user: { id: string; email: string | null; name: string | null } | null;
  cart: ClientCartLine[];
};

/** Product card the widget renders under the answer. */
export type ProductCard = {
  slug: string;
  name: string;
  type: string;
  image: string | null;
  url: string;
  from: string | null;
  promo: number | null;
};

/** Things the browser has to do (the server cannot touch the visitor's cart). */
export type ClientAction = {
  type: "add_to_cart";
  item: {
    slug: string;
    key: string;
    sku: string | null;
    name: string;
    pack: string;
    image: string | null;
    size: number | null;
    unit: string;
    price_net: number;
    promo_percent?: number;
  };
  qty: number;
};

export type ToolOutput = { result: unknown; cards?: ProductCard[]; actions?: ClientAction[]; isError?: boolean };

// ───────────────────────── definitions ─────────────────────────

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "search_products",
    description:
      "Search the shop catalogue (only products that are really sold here). Use for any question about products, viscosities (e.g. 5W-30), approvals/specifications (e.g. VW 504.00, MB 229.51, ACEA C3, Dexos2, API SN), product types (ATF, gear oil, grease, hydraulic, antifreeze, 2T…) or article numbers. Returns names, packs with the visitor's prices and availability, and product page links. Several short searches are better than one long query.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search words: viscosity, approval, product name, type or SKU. Can be empty when category is given." },
        category: { type: "string", description: "Optional category slug from the list in the system prompt." },
        limit: { type: "integer", minimum: 1, maximum: 12, description: "Max results (default 6)." },
      },
    },
  },
  {
    name: "get_product",
    description:
      "Full details of one product by slug: description, all approvals and specifications, every pack with price, price per litre, availability and lead time, promotion, TDS/SDS document links.",
    input_schema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] },
  },
  {
    name: "recommend_oil",
    description:
      "The shop's oil selector (same logic as the 'Oil finder' page). Use when the customer describes a vehicle or machine. Car/van/truck engines: vehicle + brand option (+ fuel, year band, DPF). Motorbikes, garden machines and industry: vehicle + application option. Returns ranked products with the reasons (OEM approvals etc.). If you do not know the brand group, ask the customer or use 'other'. Always tell the customer to double-check the approval in the vehicle manual.",
    input_schema: {
      type: "object",
      properties: {
        vehicle: { type: "string", enum: ["car", "van", "truck", "moto", "garden", "industry"] },
        option: {
          type: "string",
          description:
            "car/van brand group: vag (VW, Audi, Škoda, Seat, Cupra), bmw (BMW, Mini), mb (Mercedes-Benz), opel, ford, renault (Renault, Dacia, Nissan), psa (Peugeot, Citroën, DS), fiat, volvo, porsche, toyota (Toyota, Lexus), japan (Honda, Mazda, Mitsubishi, Subaru, Suzuki), hyundai (Hyundai, Kia), other. truck: man, daimler, volvo, scania, daf, iveco, deere, deutz, agco, cat, other. moto: street, sport, heavy, quad, twoStroke. garden: chainsaw, trimmer, mower, chainOil. industry: hydraulic, hydraulicHv, gear, compressor, chain.",
        },
        fuel: { type: "string", enum: ["petrol", "diesel", "hybrid", "lpg"] },
        year: { type: "string", enum: ["old", "mid", "new"], description: "old = before ~2005, mid = ~2005–2014, new = 2015+" },
        dpf: { type: "boolean", description: "Diesel particulate filter / petrol particulate filter present." },
      },
      required: ["vehicle", "option"],
    },
  },
  {
    name: "pack_calculator",
    description: "Cheapest combination of a product's packs to get at least the needed amount (litres or kg), with the total price.",
    input_schema: {
      type: "object",
      properties: { slug: { type: "string" }, amount: { type: "number", description: "Needed litres (or kg for greases)." } },
      required: ["slug", "amount"],
    },
  },
  {
    name: "view_cart",
    description: "The visitor's current cart: lines, prices, totals, how much is missing for free delivery and the delivery options with prices for this cart.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "shipping_options",
    description:
      "Delivery methods, prices and free-delivery threshold for a country (LV, EE, LT) and optionally a set of products. Without items it uses the visitor's cart (or answers in general).",
    input_schema: {
      type: "object",
      properties: {
        market: { type: "string", enum: ["LV", "EE", "LT"], description: "Delivery country (default: the visitor's country)." },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: { slug: { type: "string" }, pack_key: { type: "string" }, qty: { type: "integer", minimum: 1 } },
            required: ["slug", "pack_key", "qty"],
          },
        },
      },
    },
  },
  {
    name: "add_to_cart",
    description:
      "Put a product pack into the visitor's cart (the cart opens on the screen). Only when the customer clearly asked to add/buy it and the pack is known — use pack_key exactly as returned by get_product/search_products.",
    input_schema: {
      type: "object",
      properties: { slug: { type: "string" }, pack_key: { type: "string" }, qty: { type: "integer", minimum: 1, maximum: 99 } },
      required: ["slug", "pack_key", "qty"],
    },
  },
  {
    name: "order_status",
    description:
      "Status of an order. A signed-in customer: without arguments lists their latest orders; with order_number shows that order. A guest must give BOTH the order number (e.g. DIV-2026-00012) and the e-mail used for the order.",
    input_schema: {
      type: "object",
      properties: { order_number: { type: "string" }, email: { type: "string" } },
    },
  },
  {
    name: "contact_shop",
    description:
      "Send a message to the shop's staff (they answer by e-mail/phone on working days). Use for things you cannot do: price offers for large volumes or 200 L drums, freight delivery prices, returns/complaints, invoices, B2B terms, technical questions you are unsure about. Before calling, show the customer a short summary of the message and get an explicit OK; you need their name and e-mail (phone optional).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        message: { type: "string", description: "The request, written for the shop staff in the customer's language, with all relevant details (products, amounts, order number…)." },
      },
      required: ["name", "email", "message"],
    },
  },
];

export const TOOL_STATUS: Record<string, Record<Locale, string>> = {
  search_products: { lv: "Meklēju katalogā…", et: "Otsin kataloogist…", lt: "Ieškau kataloge…", en: "Searching the catalogue…", ru: "Ищу в каталоге…" },
  get_product: { lv: "Atveru produkta datus…", et: "Avan toote andmeid…", lt: "Atidarau produkto duomenis…", en: "Opening product details…", ru: "Открываю данные товара…" },
  recommend_oil: { lv: "Piemeklēju eļļu…", et: "Valin õli…", lt: "Parenku alyvą…", en: "Finding the right oil…", ru: "Подбираю масло…" },
  pack_calculator: { lv: "Rēķinu iepakojumus…", et: "Arvutan pakendeid…", lt: "Skaičiuoju pakuotes…", en: "Calculating packs…", ru: "Считаю упаковки…" },
  view_cart: { lv: "Skatos grozu…", et: "Vaatan ostukorvi…", lt: "Žiūriu krepšelį…", en: "Checking your cart…", ru: "Смотрю корзину…" },
  shipping_options: { lv: "Pārbaudu piegādi…", et: "Kontrollin tarnet…", lt: "Tikrinu pristatymą…", en: "Checking delivery…", ru: "Проверяю доставку…" },
  add_to_cart: { lv: "Ielieku grozā…", et: "Lisan ostukorvi…", lt: "Dedu į krepšelį…", en: "Adding to cart…", ru: "Добавляю в корзину…" },
  order_status: { lv: "Pārbaudu pasūtījumu…", et: "Kontrollin tellimust…", lt: "Tikrinu užsakymą…", en: "Checking the order…", ru: "Проверяю заказ…" },
  contact_shop: { lv: "Sūtu ziņu veikalam…", et: "Saadan sõnumi poele…", lt: "Siunčiu žinutę parduotuvei…", en: "Sending your message…", ru: "Отправляю сообщение…" },
};

// ───────────────────────── helpers ─────────────────────────

function productUrl(slug: string, locale: Locale) {
  try {
    return getPathname({ locale, href: { pathname: "/product/[slug]", params: { slug } } });
  } catch {
    return `/product/${slug}`;
  }
}

function money(n: number, ctx: ToolContext) {
  return formatMoney(n, ctx.locale);
}

function availabilityOf(v: Variant) {
  return v.availability ?? (v.in_stock ? "in_stock" : "on_order");
}

function packView(v: Variant, ctx: ToolContext) {
  const price = displayPrice(v, ctx.price);
  const before = regularPrice(v, ctx.price);
  const perUnit = pricePerUnit(v, ctx.price);
  return {
    pack_key: variantKey(v),
    pack: packLabel(v) || v.unit,
    sku: v.sku,
    price: money(price, ctx),
    ...(before ? { price_before_promo: money(before, ctx) } : {}),
    ...(perUnit ? { per_unit: `${money(perUnit, ctx)}/${v.unit === "kg" ? "kg" : "L"}` } : {}),
    availability: availabilityOf(v),
    ...(availabilityOf(v) !== "in_stock" && v.lead_time_days ? { lead_time_days: v.lead_time_days } : {}),
  };
}

function cardOf(p: Product, ctx: ToolContext): ProductCard {
  const t = productText(p, ctx.locale);
  const prices = p.variants.map((v) => displayPrice(v, ctx.price)).filter((n) => n > 0);
  return {
    slug: p.slug,
    name: t.name,
    type: t.type,
    image: p.images[0] ?? p.variants.find((v) => v.image)?.image ?? null,
    url: productUrl(p.slug, ctx.locale),
    from: prices.length ? money(Math.min(...prices), ctx) : null,
    promo: p.promo_active?.percent ?? null,
  };
}

function briefOf(p: Product, ctx: ToolContext) {
  const t = productText(p, ctx.locale);
  return {
    slug: p.slug,
    name: t.name,
    type: t.type,
    category: p.category,
    sae: p.sae,
    iso_vg: p.iso_vg,
    approvals: [...p.oem_approvals, ...p.performance].slice(0, 14),
    specs: p.specs.slice(0, 8),
    url: productUrl(p.slug, ctx.locale),
    ...(p.promo_active?.percent ? { promo_percent: p.promo_active.percent } : {}),
    packs: p.variants.map((v) => packView(v, ctx)),
  };
}

const priceNote = (ctx: ToolContext) =>
  ctx.price.b2b
    ? `Prices are this B2B customer's prices WITHOUT VAT (incl. their ${ctx.price.discountPercent}% discount where better than a promotion).`
    : `Prices include VAT ${VAT_RATES[ctx.market]}% for ${ctx.market}.`;

function cartLines(products: Product[], lines: { slug: string; key: string; qty: number }[]) {
  return lines
    .map((l) => {
      const p = products.find((x) => x.slug === l.slug);
      const v = p?.variants.find((x) => variantKey(x) === l.key);
      return p && v ? { p, v, qty: Math.max(1, Math.min(999, Math.round(l.qty))) } : null;
    })
    .filter((x): x is { p: Product; v: Variant; qty: number } => x != null);
}

async function shippingFor(ctx: ToolContext, market: Market, lines: { p: Product; v: Variant; qty: number }[]) {
  const settings = await getStoreSettings();
  const vat = settings.vat[market] ?? VAT_RATES[market];
  const subNet = lines.reduce((s, l) => s + unitNet(l.v, ctx.price) * l.qty, 0);
  const subGross = round2(subNet * (1 + vat / 100));
  const quotes = quoteShippingFromSettings(
    settings.shipping,
    market,
    lines.length ? lines.map((l) => ({ size: l.v.size, unit: l.v.unit, qty: l.qty })) : [{ size: 1, unit: "l", qty: 1 }],
    subGross,
  );
  const threshold = settings.shipping.free_threshold?.[market];
  const name: Record<ShipMethodId, string> = {
    pickup: "Pickup at the warehouse (Ventspils iela 51, Rīga)",
    parcel_locker: "Parcel locker (Omniva)",
    courier: "Courier to the door",
    freight: "Freight (pallet) for 60 L / 200 L drums and 180 kg grease drums — price confirmed by the shop",
  };
  return {
    market,
    free_delivery_from: threshold != null ? money(threshold, ctx) + " (incl. VAT, parcel locker and courier)" : null,
    ...(lines.length && threshold != null ? { missing_for_free_delivery: subGross >= threshold ? money(0, ctx) : money(threshold - subGross, ctx) } : {}),
    methods: quotes
      .filter((q) => q.reason !== "disabled")
      .map((q) => ({
        id: q.id,
        name: name[q.id],
        available: q.available,
        ...(q.available
          ? { price: q.price_net == null ? "on request" : q.free ? "free" : money(ctx.price.b2b ? q.price_net : q.price_net * (1 + vat / 100), ctx) }
          : { not_available_because: q.reason === "market" ? `not offered in ${market}` : q.reason === "size" ? "pack too large / only for drums" : "too heavy" }),
        ...(q.tier ? { size_class: q.tier.label } : {}),
      })),
  };
}

// ───────────────────────── executors ─────────────────────────

export async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  switch (name) {
    case "search_products": {
      const products = await getProducts();
      const q = String(input.query ?? "").trim();
      const cat = String(input.category ?? "").trim();
      const limit = Math.max(1, Math.min(12, Number(input.limit) || 6));
      const pool = cat ? products.filter((p) => p.category === cat) : products;
      const docs = pool.map((p) => {
        const t = productText(p, ctx.locale);
        return {
          p,
          name: t.name,
          type: t.type,
          sae: p.sae,
          iso_vg: p.iso_vg,
          specs: p.specs,
          approvals: [...p.oem_approvals, ...p.performance],
          skus: [p.base_sku, ...p.variants.map((v) => v.sku)].filter((x): x is string => Boolean(x)),
        };
      });
      const found = q ? searchDocs(docs, q, limit) : docs.slice(0, limit);
      const list = found.map((d) => d.p);
      return {
        result: { count: list.length, note: priceNote(ctx), products: list.map((p) => briefOf(p, ctx)) },
        cards: list.slice(0, 6).map((p) => cardOf(p, ctx)),
      };
    }

    case "get_product": {
      const products = await getProducts();
      const p = products.find((x) => x.slug === String(input.slug ?? ""));
      if (!p) return { result: { error: "Product not found. Use search_products to find the slug." }, isError: true };
      const t = productText(p, ctx.locale);
      const desc = (t.description || t.short || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1800);
      return {
        result: {
          ...briefOf(p, ctx),
          approvals: [...p.oem_approvals, ...p.performance],
          specs: p.specs,
          short: t.short,
          description: desc,
          documents: { tds: p.tds_url ?? null, sds: p.sds_url ?? null },
          note: priceNote(ctx),
        },
        cards: [cardOf(p, ctx)],
      };
    }

    case "recommend_oil": {
      const products = await getProducts();
      const finderInput: FinderInput = {
        vehicle: input.vehicle as FinderInput["vehicle"],
        option: String(input.option ?? "other"),
        ...(input.fuel ? { fuel: input.fuel as FinderInput["fuel"] } : {}),
        ...(input.year ? { year: input.year as FinderInput["year"] } : {}),
        ...(input.dpf != null ? { dpf: Boolean(input.dpf) } : {}),
      };
      const fp = products.map((p) => {
        const t = productText(p, ctx.locale);
        return {
          slug: p.slug,
          category: p.category,
          name: t.name,
          type: t.type,
          short: t.short,
          sae: p.sae,
          iso_vg: p.iso_vg,
          specs: p.specs,
          approvals: [...p.oem_approvals, ...p.performance],
          _p: p,
        } satisfies FinderProduct & { _p: Product };
      });
      const res = recommend(fp, finderInput, 6);
      return {
        result: {
          input: finderInput,
          note: priceNote(ctx),
          results: res.map((r) => ({
            ...briefOf(r.product._p, ctx),
            oem_match: r.oemMatch,
            reasons: r.reasons,
            highlights: r.highlights,
          })),
        },
        cards: res.map((r) => cardOf(r.product._p, ctx)),
      };
    }

    case "pack_calculator": {
      const p = (await getProducts()).find((x) => x.slug === String(input.slug ?? ""));
      const amount = Number(input.amount);
      if (!p || !(amount > 0)) return { result: { error: "Unknown product or amount." }, isError: true };
      const opts = p.variants
        .filter((v) => v.size && v.unit !== "pcs")
        .map((v) => ({ key: variantKey(v), size: Number(v.size), price: displayPrice(v, ctx.price) }));
      const combo = cheapestCombination(opts, amount);
      if (!combo) return { result: { error: "This product has no packs measured in litres/kg." }, isError: true };
      return {
        result: {
          product: productText(p, ctx.locale).name,
          needed: amount,
          total_amount: combo.total,
          total_price: money(combo.cost, ctx),
          packs: combo.items.map((i) => ({ pack_key: i.key, pack: `${i.size} ${p.variants.find((v) => variantKey(v) === i.key)?.unit === "kg" ? "kg" : "L"}`, qty: i.qty, unit_price: money(i.price, ctx) })),
          note: priceNote(ctx),
        },
      };
    }

    case "view_cart": {
      const products = await getProducts();
      const lines = cartLines(products, ctx.cart);
      if (!lines.length) return { result: { empty: true } };
      const items = lines.map((l) => ({
        slug: l.p.slug,
        name: productText(l.p, ctx.locale).name,
        pack_key: variantKey(l.v),
        pack: packLabel(l.v),
        qty: l.qty,
        unit_price: money(displayPrice(l.v, ctx.price), ctx),
        line_total: money(displayPrice(l.v, ctx.price) * l.qty, ctx),
      }));
      const total = lines.reduce((s, l) => s + displayPrice(l.v, ctx.price) * l.qty, 0);
      return { result: { items, products_total: money(total, ctx), note: priceNote(ctx), delivery: await shippingFor(ctx, ctx.market, lines) } };
    }

    case "shipping_options": {
      const market = (["LV", "EE", "LT"].includes(String(input.market)) ? input.market : ctx.market) as Market;
      const products = await getProducts();
      const raw = Array.isArray(input.items)
        ? (input.items as { slug: string; pack_key: string; qty: number }[]).map((i) => ({ slug: i.slug, key: i.pack_key, qty: i.qty }))
        : ctx.cart;
      return { result: await shippingFor(ctx, market, cartLines(products, raw)) };
    }

    case "add_to_cart": {
      const p = (await getProducts()).find((x) => x.slug === String(input.slug ?? ""));
      const v = p?.variants.find((x) => variantKey(x) === String(input.pack_key ?? ""));
      if (!p || !v) return { result: { error: "Unknown product or pack_key — call get_product first and use pack_key exactly." }, isError: true };
      if (v.availability === "out_of_stock") return { result: { error: "This pack is out of stock and cannot be ordered right now." }, isError: true };
      const qty = Math.max(1, Math.min(99, Math.round(Number(input.qty) || 1)));
      const t = productText(p, ctx.locale);
      const action: ClientAction = {
        type: "add_to_cart",
        qty,
        item: {
          slug: p.slug,
          key: variantKey(v),
          sku: v.sku,
          name: t.name,
          pack: packLabel(v),
          image: v.image ?? p.images[0] ?? null,
          size: v.size,
          unit: v.unit,
          price_net: v.price_net,
          ...(v.promo_percent ? { promo_percent: v.promo_percent } : {}),
        },
      };
      return {
        result: { ok: true, added: `${qty} × ${t.name} ${packLabel(v)}`, unit_price: money(displayPrice(v, ctx.price), ctx), checkout_url: getPathname({ locale: ctx.locale, href: "/checkout" }) },
        actions: [action],
      };
    }

    case "order_status": {
      if (!isServiceRoleConfigured()) return { result: { error: "Order lookup is not available right now — ask the customer to check their account or contact the shop." }, isError: true };
      const db = createServiceClient();
      const number = String(input.order_number ?? "").trim().toUpperCase();
      const email = String(input.email ?? "").trim().toLowerCase();
      const cols = "id, number, status, payment_status, payment_method, shipping_method, total_gross, created_at, tracking_code, tracking_url, tracking_carrier, email, user_id";
      let q = db.from("orders").select(cols).order("created_at", { ascending: false }).limit(5);
      if (number) q = q.eq("number", number);
      if (ctx.user) {
        if (!number) q = q.eq("user_id", ctx.user.id);
      } else if (!number || !email) {
        return { result: { error: "Guest customers must give both the order number and the e-mail used for the order." }, isError: true };
      }
      const { data, error } = await q;
      if (error) return { result: { error: "Lookup failed." }, isError: true };
      const own = (data ?? []).filter(
        (o) => (ctx.user && o.user_id === ctx.user.id) || (email && String(o.email).toLowerCase() === email) || (ctx.user?.email && String(o.email).toLowerCase() === ctx.user.email.toLowerCase()),
      );
      if (!own.length) return { result: { found: false, note: "No order with this number for this customer/e-mail." } };
      const ids = own.map((o) => o.id);
      const { data: ships } = await db.from("shipments").select("order_id, carrier, tracking_number, tracking_status, shipped_at, delivered_at").in("order_id", ids);
      const { data: items } = await db.from("order_items").select("order_id, name, pack_label, qty").in("order_id", ids);
      return {
        result: {
          found: true,
          account_orders_url: ctx.user ? "/account/orders" : null,
          orders: own.map((o) => ({
            number: o.number,
            date: String(o.created_at).slice(0, 10),
            status: o.status,
            payment_status: o.payment_status,
            payment_method: o.payment_method,
            delivery: o.shipping_method,
            total: money(Number(o.total_gross), ctx),
            items: (items ?? []).filter((i) => i.order_id === o.id).map((i) => `${i.qty} × ${i.name} ${i.pack_label ?? ""}`.trim()),
            tracking: o.tracking_code ? { code: o.tracking_code, carrier: o.tracking_carrier, url: o.tracking_url } : null,
            shipments: (ships ?? [])
              .filter((s) => s.order_id === o.id)
              .map((s) => ({ carrier: s.carrier, tracking_number: s.tracking_number, status: s.tracking_status, shipped: s.shipped_at, delivered: s.delivered_at })),
          })),
        },
      };
    }

    case "contact_shop": {
      const name = String(input.name ?? "").trim().slice(0, 200);
      const email = String(input.email ?? "").trim().slice(0, 200);
      const phone = String(input.phone ?? "").trim().slice(0, 50);
      const message = String(input.message ?? "").trim().slice(0, 4000);
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !message) {
        return { result: { error: "Name, a valid e-mail and the message are required." }, isError: true };
      }
      const check = checkInquirySpam({ name, message, phone, email });
      const extra = { source: "ai_assistant", consent: true, consent_at: new Date().toISOString(), ...(check.spam ? { spam_reason: check.reason } : {}) };
      const payload = { type: "contact", name, email, phone: phone || undefined, message: `[AI palīgs] ${message}`, locale: ctx.locale, extra, ...(check.spam ? { spam: true } : {}) };
      const { data, error } = await createPublicClient().rpc("submit_inquiry", { payload });
      if (error) {
        if (/rate_limited/.test(error.message)) return { result: { error: "Too many messages from this e-mail — please try again later." }, isError: true };
        return { result: { error: "Sending failed — give the customer the shop's e-mail and phone instead." }, isError: true };
      }
      const res = (typeof data === "string" ? { id: data, spam: false } : (data ?? {})) as { id?: string; spam?: boolean };
      if (!check.spam && !res.spam) {
        deferEmail("inquiry", () =>
          notifyInquiry({ id: res.id ?? null, type: "contact", name, email, phone: phone || null, company: null, message: `[AI palīgs] ${message}`, locale: ctx.locale, extra }),
        );
      }
      return { result: { ok: true, note: "Message delivered to the shop. They usually reply within one working day." } };
    }
  }
  return { result: { error: `Unknown tool ${name}` }, isError: true };
}

/** Category list for the system prompt. */
export async function categoryLines(locale: Locale) {
  const [cats, products] = await Promise.all([getCategories(), getProducts()]);
  return cats
    .map((c) => {
      const n = products.filter((p) => p.category === c.slug).length;
      const name = c.i18n?.[locale]?.name ?? c.i18n?.lv?.name ?? c.slug;
      return n ? `- ${c.slug}: ${name} (${n} products)` : null;
    })
    .filter(Boolean)
    .join("\n");
}
