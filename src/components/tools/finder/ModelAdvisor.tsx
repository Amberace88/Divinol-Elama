"use client";

import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Bike, Car, CarFront, Cog, Construction, Droplets, ExternalLink, Gauge, Loader2, Search, ShieldCheck, Snowflake, Tractor, Truck, Van, Wrench, X } from "lucide-react";
import type { ProductSummary } from "@/lib/catalog";
import { searchDocs } from "@/lib/shop/search";
import { CATEGORY } from "@/lib/finder";
import { Link } from "@/i18n/navigation";
import { usePricing } from "@/components/providers/PriceProvider";
import { ProductImage } from "@/components/ui/ProductImage";
import { useMoney } from "@/components/ui/useMoney";
import { minPrice } from "@/components/catalog/filters";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/** Official Zeller+Gmelin lubricant advisor (Olyslager data). Embedded as-is — the data may not be copied or stored. */
const ADVISOR = "https://zellergmelin.lubricantadvisor.com";
/** Languages the Zeller+Gmelin advisor offers (no LV/ET/LT yet → English). */
const advisorLang = (locale: string) => (locale === "ru" ? "ru" : "en");

const EXAMPLES = ["VW Golf", "Škoda Octavia", "Toyota Corolla", "BMW X5", "Mercedes Sprinter", "Volvo FH", "John Deere 6", "Honda CBR"];

type Doc = ProductSummary & { skus: string[] };

export function ModelAdvisor({ products }: { products: ProductSummary[] }) {
  const t = useTranslations("finder.model");
  const locale = useLocale();
  const lang = advisorLang(locale);
  const home = `${ADVISOR}/${lang}`;

  const [src, setSrc] = useState(home);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const frameRef = useRef<HTMLDivElement>(null);

  const open = (url: string) => {
    if (url !== src) {
      setLoading(true);
      setSrc(url);
    }
    const el = frameRef.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const search = (text: string) => {
    const s = text.trim();
    open(s ? `${ADVISOR}/${lang}/search/${encodeURIComponent(s)}` : home);
  };

  const components: { icon: typeof Cog; key: string }[] = [
    { icon: Gauge, key: "engine" },
    { icon: Cog, key: "gearbox" },
    { icon: Wrench, key: "axle" },
    { icon: Droplets, key: "brakes" },
    { icon: Snowflake, key: "cooling" },
    { icon: ShieldCheck, key: "intervals" },
  ];
  const categories: { icon: typeof Car; key: string }[] = [
    { icon: Car, key: "cars" },
    { icon: CarFront, key: "classic" },
    { icon: Van, key: "vans" },
    { icon: Bike, key: "moto" },
    { icon: Truck, key: "trucks" },
    { icon: Tractor, key: "agri" },
    { icon: Construction, key: "construction" },
  ];

  return (
    <div className="grid gap-6">
      {/* search header */}
      <div className="relative isolate overflow-hidden rounded-3xl bg-navy-800 p-6 text-white shadow-lift sm:p-8">
        <div aria-hidden className="grid-bg absolute inset-0 -z-10 opacity-50" />
        <div aria-hidden className="absolute -top-24 -right-20 -z-10 size-72 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <p className="eyebrow text-brand-300">{t("eyebrow")}</p>
            <h2 className="h-display mt-1 text-2xl sm:text-[1.9rem]">{t("title")}</h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-6 text-white/70">{t("text")}</p>
            <form
              className="mt-5 flex flex-col gap-2 sm:flex-row"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                search(q);
              }}
            >
              <label className="relative flex-1">
                <span className="sr-only">{t("searchLabel")}</span>
                <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-navy-400" aria-hidden />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="h-14 w-full rounded-xl border-0 bg-white pr-10 pl-12 text-[15px] font-semibold text-navy-900 shadow-card outline-none ring-4 ring-transparent transition placeholder:font-medium placeholder:text-navy-300 focus:ring-brand-400/60"
                  autoComplete="off"
                  enterKeyHint="search"
                />
                {q && (
                  <button type="button" onClick={() => setQ("")} className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center rounded-full text-navy-400 hover:bg-navy-50" aria-label={t("clear")}>
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </label>
              <button type="submit" className={buttonClass("primary", "lg", "shrink-0")}>
                {t("searchCta")}
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[12px] font-semibold text-white/50">{t("examples")}</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setQ(ex);
                    search(ex);
                  }}
                  className="rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-bold text-white/85 ring-1 ring-white/10 transition hover:bg-white/20 hover:text-white"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/50">{t("coversTitle")}</p>
            <ul className="grid grid-cols-2 gap-2">
              {components.map((c) => (
                <li key={c.key} className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2 text-[13px] font-semibold text-white/85 ring-1 ring-white/10">
                  <c.icon className="size-4 shrink-0 text-brand-400" aria-hidden />
                  {t(`covers.${c.key}`)}
                </li>
              ))}
            </ul>
            <ul className="flex flex-wrap gap-1.5" aria-label={t("categoriesTitle")}>
              {categories.map((c) => (
                <li key={c.key} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1 text-[11.5px] font-semibold text-white/60">
                  <c.icon className="size-3.5" aria-hidden />
                  {t(`categories.${c.key}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* official advisor */}
        <div ref={frameRef} className="scroll-mt-28 overflow-hidden rounded-3xl border border-line bg-surface shadow-lift">
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-canvas/60 px-4 py-3 sm:px-5">
            <span className="grid size-8 place-items-center rounded-lg bg-[#e30613] text-[13px] font-black text-white" aria-hidden>
              Z
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-extrabold text-navy-700">{t("frameTitle")}</p>
              <p className="truncate text-[11.5px] text-muted">{t("frameSource")}</p>
            </div>
            {src !== home && (
              <button type="button" onClick={() => open(home)} className="text-[12.5px] font-bold text-navy-600 hover:text-navy-800">
                {t("restart")}
              </button>
            )}
            <a href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-navy-600 hover:text-navy-800">
              {t("openFull")}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
          {lang !== locale && <p className="border-b border-line bg-brand-50/70 px-5 py-2 text-[12px] font-medium text-navy-700 dark:bg-brand-400/10">{t("langNote")}</p>}
          <div className="relative h-[78vh] min-h-[640px] max-h-[1100px] bg-white">
            <iframe
              key="advisor"
              src={src}
              title={t("frameTitle")}
              className="absolute inset-0 size-full"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setLoading(false)}
            />
            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 grid place-items-center bg-white/80 backdrop-blur-[2px]"
                >
                  <span className="inline-flex items-center gap-2 rounded-full bg-navy-700 px-4 py-2 text-[13px] font-bold text-white shadow-lift">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {t("loading")}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <ShopBridge products={products} />
      </div>
    </div>
  );
}

/** "Found the recommended product?" — searches OUR catalogue by name or Zeller+Gmelin article code and links to the shop. */
function ShopBridge({ products }: { products: ProductSummary[] }) {
  const t = useTranslations("finder.model");
  const pricing = usePricing();
  const money = useMoney();
  const [q, setQ] = useState("");

  const docs = useMemo<Doc[]>(() => products.map((p) => ({ ...p, skus: p.variants.map((v) => v.sku).filter((x): x is string => Boolean(x)) })), [products]);
  const popular = useMemo(() => {
    const pick = docs.filter((p) => p.featured && p.category === CATEGORY.car);
    return (pick.length ? pick : docs.filter((p) => p.featured)).slice(0, 5);
  }, [docs]);

  const results = useMemo(() => {
    const raw = q.trim();
    if (!raw) return null;
    // Zeller+Gmelin article code (e.g. "49180-A011") → our SKU prefix "49180"
    const code = /^(\d{5})/.exec(raw.replace(/\s+/g, ""))?.[1];
    if (code) {
      const byCode = docs.filter((p) => p.skus.some((s) => s.startsWith(code)));
      if (byCode.length) return byCode.slice(0, 6);
    }
    return searchDocs(docs, raw.replace(/^divinol\s+/i, ""), 6);
  }, [q, docs]);

  const list = results ?? popular;

  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
        <div className="border-b border-line bg-canvas/60 px-5 py-4">
          <p className="eyebrow">{t("bridgeEyebrow")}</p>
          <h3 className="mt-1 text-[17px] font-extrabold tracking-tight text-navy-700">{t("bridgeTitle")}</h3>
          <p className="mt-1 text-[13px] leading-5 text-muted">{t("bridgeText")}</p>
          <label className="relative mt-3 block">
            <span className="sr-only">{t("bridgeTitle")}</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy-300" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("bridgePlaceholder")} className="input h-11 pl-9" autoComplete="off" />
          </label>
        </div>
        <p className="px-5 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-navy-400">{results ? t("bridgeResults", { count: results.length }) : t("bridgePopular")}</p>
        <ul className="grid gap-1 p-2">
          <AnimatePresence initial={false} mode="popLayout">
            {list.map((p) => {
              const price = minPrice(p, pricing);
              return (
                <motion.li key={p.slug} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18 }}>
                  <Link
                    href={{ pathname: "/product/[slug]", params: { slug: p.slug } }}
                    className="group flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-navy-50/70 dark:hover:bg-white/5"
                  >
                    <ProductImage src={p.image} alt="" sizes="56px" className="relative size-14 shrink-0 rounded-xl bg-canvas" imgClassName="p-1.5" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[13.5px] font-bold leading-snug text-ink group-hover:text-navy-600">{p.name}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-[12px]">
                        {(p.sae || p.iso_vg) && <span className="font-bold text-navy-500">{p.sae ?? p.iso_vg}</span>}
                        {Number.isFinite(price) && (
                          <span className="font-extrabold text-navy-700 tabular-nums">
                            {p.variants.length > 1 ? `${t("from")} ` : ""}
                            {money(price)}
                          </span>
                        )}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-navy-300 transition group-hover:translate-x-0.5 group-hover:text-navy-600" aria-hidden />
                  </Link>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {results && results.length === 0 && (
            <li className="rounded-2xl border border-dashed border-line p-4 text-[13px] leading-5 text-muted">
              {t("bridgeEmpty")}{" "}
              <a href="#expert" className="font-bold text-navy-700 hover:underline">
                {t("bridgeAsk")}
              </a>
            </li>
          )}
        </ul>
        <div className={cn("border-t border-line px-5 py-3 text-[12px] leading-5 text-muted")}>{t("bridgeHint")}</div>
      </div>
    </aside>
  );
}
