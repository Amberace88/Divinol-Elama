"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
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
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-12%", "12%"]);
  const yNum = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["30%", "-30%"]);

  return (
    <section ref={ref} aria-labelledby="home-heritage" className="relative isolate overflow-hidden bg-navy-950 text-white">
      <motion.div aria-hidden={false} className="absolute inset-x-0 -inset-y-[14%] -z-10" style={{ y }}>
        <Image src="/media/brand/hero-barrels.webp" alt={imageAlt} fill sizes="100vw" className="object-cover opacity-55" />
      </motion.div>
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
        <motion.div style={{ y: yNum }} aria-hidden className="hidden justify-end lg:col-span-6 lg:flex">
          <div className="text-right">
            <p className="text-[10rem] font-extrabold leading-none tracking-[-0.06em] text-transparent [-webkit-text-stroke:2px_rgb(255_193_14/0.85)]">
              1866
            </p>
            <p className="-mt-2 inline-flex -skew-x-12 rounded-lg bg-brand-400 px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-widest text-navy-900">
              <span className="skew-x-12">{since}</span>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
