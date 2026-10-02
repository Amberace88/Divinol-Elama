import { getTranslations } from "next-intl/server";
import { ArrowRight, Tag } from "lucide-react";
import type { ProductSummary } from "@/lib/catalog";
import { Link } from "@/i18n/navigation";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Reveal } from "@/components/ui/Reveal";

/** "Offers" strip on the home page — shown only while at least one promotion is running. */
export async function PromoProducts({ products }: { products: ProductSummary[] }) {
  const t = await getTranslations("promo");
  if (!products.length) return null;
  const best = Math.max(...products.map((p) => p.promo?.percent ?? 0));
  return (
    <section aria-labelledby="home-promo" className="relative overflow-hidden bg-page py-16 sm:py-20">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(60%_50%_at_15%_0%,rgb(244_63_94/0.10),transparent_70%),radial-gradient(50%_40%_at_95%_10%,rgb(255_193_14/0.14),transparent_70%)]" />
      <div className="container-x relative">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_10px_24px_-12px_rgb(225_29_72/0.9)]">
              <Tag className="size-3.5" strokeWidth={2.75} aria-hidden />
              {t("homeEyebrow")}
              {best > 0 && <span className="tabular-nums">· −{Math.round(best)}%</span>}
            </p>
            <h2 id="home-promo" className="h-display mt-3 text-[28px] leading-tight text-ink sm:text-4xl">
              {t("homeTitle")}
            </h2>
          </div>
          <Link
            href={{ pathname: "/catalog", query: { sale: "1" } }}
            className="group inline-flex items-center gap-1.5 text-[14px] font-bold text-rose-700 hover:text-rose-800"
          >
            {t("homeLink")}
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:gap-5">
          {products.map((p, i) => (
            <Reveal as="li" key={p.slug} delay={(i % 4) * 0.06} y={20}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
