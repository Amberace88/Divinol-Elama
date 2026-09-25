import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "./SectionHeading";

export type HomeCategory = { slug: string; icon: string; name: string; description: string; image: string | null; count: number };

export async function CategoryGrid({ categories }: { categories: HomeCategory[] }) {
  const t = await getTranslations("home");
  return (
    <section aria-labelledby="home-categories" className="container-x py-20 sm:py-24">
      <SectionHeading
        id="home-categories"
        eyebrow={t("categoriesEyebrow")}
        title={t("categoriesTitle")}
        text={t("categoriesText")}
        action={
          <Link href="/catalog" className="group inline-flex items-center gap-1.5 text-[14px] font-bold text-navy-600 hover:text-navy-800">
            {t("categoriesCta")}
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
          </Link>
        }
      />
      <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {categories.map((c, i) => (
          <Reveal as="li" key={c.slug} delay={(i % 5) * 0.05} y={18}>
            <Link
              href={{ pathname: "/catalog/[category]", params: { category: c.slug } }}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition duration-200 hover:border-navy-200 hover:shadow-lift"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-[radial-gradient(120%_90%_at_50%_0%,#ffffff_40%,#e9eef7_100%)]">
                {c.image && (
                  <Image
                    src={c.image}
                    alt=""
                    fill
                    sizes="(min-width:1280px) 240px, (min-width:768px) 30vw, 45vw"
                    className="object-contain p-5 mix-blend-multiply transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                )}
                <span className="absolute left-3 top-3 grid size-10 place-items-center rounded-xl bg-navy-700 text-brand-400 shadow-card transition-colors duration-200 group-hover:bg-brand-400 group-hover:text-navy-900">
                  <CategoryIcon name={c.icon} className="size-5" aria-hidden />
                </span>
                
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-[15px] font-extrabold leading-snug tracking-tight text-ink group-hover:text-navy-600">{c.name}</h3>
                <p className="mt-1.5 line-clamp-2 hidden text-[12.5px] leading-relaxed text-muted sm:block">{c.description}</p>
                <p className="mt-auto flex items-center justify-between pt-3 text-[12.5px] font-bold text-navy-500">
                  {t("productsCount", { count: c.count })}
                  <ArrowUpRight className="size-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                </p>
              </div>
            </Link>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
