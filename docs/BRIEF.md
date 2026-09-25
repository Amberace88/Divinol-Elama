# Divinol / SIA Elama platform — engineering brief (read fully before coding)

## Product
E-commerce + B2B platform for **SIA Elama**, the official Latvian representative of **Divinol** lubricants
(manufacturer Zeller+Gmelin GmbH & Co. KG, Germany, since 1866). Replaces the old WooCommerce site divinol.lv.
Domains: divinol.lv (lv default, also lt/en/ru) and divinol.ee (et default). Markets: LV, EE, LT.
Customers: private (B2C, prices incl. VAT) and business (B2B: after admin approval they see net prices with a personal
discount and may pay by invoice). The client wants it to look clearly more modern and premium than typical shops:
motion, micro-interactions, calculators, great SEO.

## Stack (versions matter)
- **Next.js 16.3 App Router** (Turbopack). READ `node_modules/next/dist/docs/` for anything you are unsure of.
  Breaking changes vs older Next: `params`/`searchParams`/`cookies()`/`headers()` are async (await them);
  `middleware.ts` is now `src/proxy.ts` (already exists — do not edit); `revalidateTag(tag, profile)` needs a 2nd arg
  (use `{ expire: 0 }` for immediate); global type helpers `PageProps<'/[locale]/...'>` and `LayoutProps<...>` exist.
- React 19, TypeScript strict, **Tailwind CSS v4** (tokens in `src/app/globals.css` via `@theme`; no tailwind.config).
- **next-intl 4** — config in `src/i18n/routing.ts` (localized pathnames!), `src/i18n/request.ts`, `src/i18n/navigation.ts`.
  Always use `Link`, `redirect`, `useRouter`, `usePathname` from `@/i18n/navigation` with the *internal* route keys
  from `routing.pathnames` (e.g. `href="/catalog"`, `href={{ pathname: "/product/[slug]", params: { slug } }}`).
  Every page/layout under `[locale]` must call `setRequestLocale(locale)` first (static rendering).
- Supabase (`@supabase/ssr`): `@/lib/supabase/server` → `createClient()` (session-bound, server), `createPublicClient()`
  (no cookies, cacheable); `@/lib/supabase/client` → `createClient()` (browser). Env in `@/lib/supabase/env`.
  The dev container CANNOT reach Supabase over the network — you cannot run queries locally. Write correct code against
  the schema below and make pages degrade gracefully (empty states, try/catch) when a query fails.
- UI libs available: `motion` (import from `motion/react`), `lucide-react`, `sonner` (toasts, `<Toaster/>` already in
  layout), `recharts`, `@react-pdf/renderer`, `zod`, `clsx` + `tailwind-merge` (`cn` in `@/lib/utils`).
- Fonts: Manrope (latin, latin-ext, cyrillic) exposed as `--font-manrope` → Tailwind `font-sans`.

## Design system
- Brand colors from the old site, modernised: navy `navy-700 #1e2d51` (primary dark surfaces: header, hero, footer),
  deeper `navy-900/950`, **yellow `brand-400 #ffc10e`** for CTAs and accents; neutrals `ink`, `muted`, `line`, `canvas`.
- Visual language: ELAMA logo is a slanted italic mark — echo it with `-skew-x-12` accent bars/tags (`.skew-tag`,
  `.eyebrow` utility classes exist). Rounded-2xl cards (`.card`), soft shadows (`shadow-card`, `shadow-lift`), generous
  whitespace, strong typographic hierarchy (`.h-display`: extrabold, tight tracking). Inputs: `.input` + `.label`.
- Existing primitives: `@/components/ui/Button` (`Button`, `buttonClass(variant,size)` for links; variants
  primary|dark|outline|ghost|light|danger), `@/components/ui/Reveal` (scroll reveal), `@/components/ui/CategoryIcon`,
  `@/components/ui/Logo`. Add new primitives as NEW files; don't rewrite files owned by someone else.
- Motion: tasteful (entrance reveals, hover lifts, animated counters, layout animations); respect reduced motion.
- Mobile-first and fully responsive; accessible (labels, focus rings, aria, contrast).

## Data layer
- Catalog: `@/lib/catalog` → `getProducts()`, `getProduct(slug)`, `getCategories()`, `getCategory(slug)`,
  `productText(p, locale)`, `summarize(p, locale)` (client-safe `ProductSummary`), `CATALOG_TAG`.
  Reads Supabase if it has products, else falls back to the bundled seed (`src/data/products.seed.json`,
  `src/data/categories.ts`). Types in `@/lib/types`.
- Commerce math: `@/lib/commerce` (VAT per market, `displayPrice`, `pricePerUnit`, `packLabel`, `formatMoney`,
  `quoteShipping`, `variantKey`). Prices in DB are **net** (excl. VAT), 4 decimals.
- Store settings (company requisites, VAT, shipping config): `@/lib/settings` → `getStoreSettings()`;
  client: `useSettings()` from `@/components/providers/SettingsProvider`.
- Client state: `usePricing()` (market, b2b flag, discount, profile) from `@/components/providers/PriceProvider`;
  `useCart()` from `@/components/providers/CartProvider`.

## Database (Supabase Postgres) — see `supabase/migrations/*.sql`
Tables: `profiles` (role customer|admin, customer_type private|business, company_name, reg_no, vat_no, legal_address,
b2b_status none|pending|approved|rejected, discount_percent, payment_terms_days, market, preferred_locale, admin_notes),
`addresses`, `categories` (slug, icon, image, sort, i18n jsonb {lv:{name,description}}), `products` (slug, base_sku,
category_id, sae, iso_vg, specs[], oem_approvals[], performance[], images[], i18n jsonb {lv:{name,type,short,description,
meta_title,meta_description}}, tds_url, sds_url, is_active, is_featured, sort), `product_variants` (product_id, sku, size,
unit l|kg|pcs, price_net, cost_net, stock, in_stock, image, weight_kg, sort, is_active), `orders` (number DIV-YYYY-00001,
user_id, email, phone, customer jsonb, shipping_address jsonb, billing_address jsonb, market, locale,
status new|confirmed|processing|shipped|completed|cancelled, payment_method bank_transfer|card|invoice|cash_on_pickup,
payment_status unpaid|paid|refunded|partially_refunded, shipping_method pickup|parcel_locker|courier|freight,
shipping_point jsonb, shipping_net, subtotal_net, discount_net, vat_rate, vat_amount, total_gross, reverse_charge, notes,
admin_notes, tracking_code, paid_at), `order_items`, `order_events`, `invoices` (number, order_id, user_id,
type proforma|invoice|credit_note, status issued|paid|void, issued_at, due_at, paid_at, buyer jsonb, seller jsonb,
lines jsonb [{sku,name,pack,qty,unit_net,line_net}], subtotal_net, vat_rate, vat_amount, total_gross, reverse_charge, notes),
`inquiries` (type contact|b2b|quote|oil_finder, status new|in_progress|done|spam), `settings` (key/value jsonb),
`newsletter`. Storage buckets (public): `product-images`, `documents` (admin-only writes).
RLS: public read of active catalog; users read own profile/orders/items/invoices/addresses; admins (`is_admin()`) do all.
RPCs: `place_order(payload jsonb)`, `submit_inquiry(payload jsonb)`, `subscribe_newsletter(p_email, p_locale)`,
`admin_create_invoice(p_order uuid, p_type text, p_due_days int)`, `admin_import_catalog(p_categories jsonb, p_products jsonb)`,
`admin_stats(p_days int)`. If you need new SQL, put it in a NEW migration file `supabase/migrations/00NN_<area>.sql`
(don't edit existing ones) and mention it in your final report — the lead applies it.

## i18n content
Message namespaces are separate JSON files per locale: `src/messages/<locale>/<ns>.json` for ns in
common | shop | pages | account | checkout (merged at runtime, so top-level keys must be unique across files).
Write **lv** (primary, natural professional Latvian) and **en**. Other locales (et, lt, ru) are translated later by the
lead — do not create them. Never hard-code visible UI text in components (admin panel is the exception: Latvian-only).

## Rules
- Only touch the files/folders assigned to you. Shared files you may *read* but not edit: `src/proxy.ts`,
  `src/i18n/*`, `src/lib/*` (except new files in your own subfolder), providers, `src/app/[locale]/layout.tsx`,
  `next.config.ts`, `package.json` (if you truly need a package, `npm i` it and report it).
- Verify with `npx tsc --noEmit` and `npx eslint <your paths>` (fix all errors in your files). Do NOT run `next build`
  or `next dev` (other agents work in the same tree concurrently).
- Don't invent business facts (opening hours, bank details, prices, certifications not in the brief).
- Final report: files created, migrations added, packages installed, anything the lead must wire up. Keep it short.
