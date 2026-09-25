import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/Button";

export function Heritage({
  eyebrow,
  title,
  text,
  cta,
  since,
  imageAlt,
}: {
  eyebrow: string;
  title: string;
  text: string;
  cta: string;
  since: string;
  imageAlt: string;
}) {
  return (
    <section aria-labelledby="home-heritage" className="relative isolate overflow-hidden bg-navy-950 text-white">
      <div className="absolute inset-0 -z-10">
        <Image src="/media/brand/hero-barrels.webp" alt={imageAlt} fill sizes="100vw" className="object-cover opacity-45" />
      </div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy-950/10" />
      <div aria-hidden className="absolute inset-0 -z-10 grid-bg opacity-40" />
      <div className="container-x grid min-h-[560px] items-center gap-10 py-20 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <p className="eyebrow text-brand-300!">{eyebrow}</p>
          <h2 id="home-heritage" className="h-display mt-3 text-3xl sm:text-4xl lg:text-5xl">
            {title}
          </h2>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/70 sm:text-base">{text}</p>
          <Link href="/about" className={buttonClass("primary", "lg", "mt-8")}>
            {cta}
            <ArrowRight className="size-5 transition group-hover/btn:translate-x-0.5" aria-hidden />
          </Link>
        </div>
        <div aria-hidden className="hidden justify-end lg:col-span-6 lg:flex">
          <div className="text-right">
            <p className="text-[10rem] font-extrabold leading-none tracking-[-0.06em] text-transparent [-webkit-text-stroke:2px_rgb(255_193_14/0.85)]">
              1866
            </p>
            <p className="-mt-2 inline-flex rounded-md bg-brand-400 px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-widest text-navy-900">
              {since}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
