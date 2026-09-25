import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import type { ProductSummary } from "@/lib/catalog";
import { Link } from "@/i18n/navigation";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";

export async function FeaturedProducts({ products }: { products: ProductSummary[] }) {
  const t = await getTranslations("home");
  if (!products.length) return null;
  return (
    <section aria-labelledby="home-featured" className="relative bg-canvas py-20 sm:py-24">
      <div className="container-x">
        <SectionHeading
          id="home-featured"
          eyebrow={t("featuredEyebrow")}
          title={t("featuredTitle")}
          text={t("featuredText")}
          action={
            <Link href="/catalog" className="group inline-flex items-center gap-1.5 text-[14px] font-bold text-navy-600 hover:text-navy-800">
              {t("featuredCta")}
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          }
        />
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:gap-5">
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
