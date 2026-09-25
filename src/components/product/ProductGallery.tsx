"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

export type GalleryImage = { src: string; alt: string };

export function ProductGallery({
  images,
  index,
  onIndex,
  badge,
}: {
  images: GalleryImage[];
  index: number;
  onIndex: (i: number) => void;
  badge?: React.ReactNode;
}) {
  const t = useTranslations("product");
  const ta = useTranslations("a11y");
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const current = images[index] ?? images[0];
  const n = images.length;
  const go = (d: number) => onIndex((index + d + n) % n);

  return (
    <div className="lg:sticky lg:top-24">
      <div
        className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-3xl border border-line bg-[radial-gradient(110%_80%_at_50%_15%,#ffffff_50%,#eef2f9_100%)] dark:bg-(image:--night-well)"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onMouseLeave={() => setZoom(null)}
        onClick={() => current && setLightbox(true)}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {current && (
            <motion.div
              key={current.src}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <Image
                src={current.src}
                alt={current.alt}
                fill
                priority={index === 0}
                sizes="(min-width:1024px) 560px, 100vw"
                className="object-contain p-8 mix-blend-multiply dark:mix-blend-normal transition-transform duration-200 ease-out sm:p-12"
                style={
                  zoom
                    ? { transform: "scale(1.9)", transformOrigin: `${zoom.x}% ${zoom.y}%` }
                    : { transform: "scale(1)", transformOrigin: "50% 50%" }
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
        {badge && <div className="pointer-events-none absolute left-4 top-4 z-10">{badge}</div>}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLightbox(true);
          }}
          aria-label={t("zoom")}
          className="absolute bottom-4 right-4 z-10 grid size-10 place-items-center rounded-xl bg-surface/90 text-navy-700 shadow-card ring-1 ring-line backdrop-blur transition hover:bg-surface"
        >
          <ZoomIn className="size-5" aria-hidden />
        </button>
        {n > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label={ta("previous")}
              className="absolute left-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-navy-700 opacity-0 shadow-card ring-1 ring-line transition group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label={ta("next")}
              className="absolute right-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-navy-700 opacity-0 shadow-card ring-1 ring-line transition group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        )}
      </div>

      {n > 1 && (
        <ul className="no-scrollbar mt-3 flex gap-2.5 overflow-x-auto pb-1" aria-label={t("gallery")}>
          {images.map((img, i) => (
            <li key={img.src} className="shrink-0">
              <button
                type="button"
                onClick={() => onIndex(i)}
                aria-current={i === index || undefined}
                aria-label={img.alt}
                className={cn(
                  "relative block size-[72px] overflow-hidden rounded-xl border-2 bg-surface transition dark:bg-(image:--night-well) sm:size-20",
                  i === index ? "border-navy-600 shadow-card" : "border-line hover:border-navy-200",
                )}
              >
                <Image src={img.src} alt="" fill sizes="80px" className="object-contain p-1.5 mix-blend-multiply dark:mix-blend-normal" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Lightbox open={lightbox} onClose={() => setLightbox(false)} images={images} index={index} onIndex={onIndex} />
    </div>
  );
}

function Lightbox({
  open,
  onClose,
  images,
  index,
  onIndex,
}: {
  open: boolean;
  onClose: () => void;
  images: GalleryImage[];
  index: number;
  onIndex: (i: number) => void;
}) {
  const ta = useTranslations("a11y");
  const closeRef = useRef<HTMLButtonElement>(null);
  const n = images.length;
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % n);
      if (e.key === "ArrowLeft") onIndex((index - 1 + n) % n);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, onIndex, index, n]);
  const img = images[index];
  return (
    <AnimatePresence>
      {open && img && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={img.alt}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-surface/95 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            key={img.src}
            className="relative h-[80vh] w-[92vw] max-w-4xl"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <Image src={img.src} alt={img.alt} fill sizes="92vw" className="object-contain mix-blend-multiply dark:mix-blend-normal" />
          </motion.div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={ta("close")}
            className="absolute right-4 top-4 grid size-12 place-items-center rounded-full bg-navy-700 text-white shadow-lift transition hover:bg-navy-600"
          >
            <X className="size-6" aria-hidden />
          </button>
          {n > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onIndex((index - 1 + n) % n);
                }}
                aria-label={ta("previous")}
                className="absolute left-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-surface text-navy-700 shadow-lift ring-1 ring-line"
              >
                <ChevronLeft className="size-6" aria-hidden />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onIndex((index + 1) % n);
                }}
                aria-label={ta("next")}
                className="absolute right-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-surface text-navy-700 shadow-lift ring-1 ring-line"
              >
                <ChevronRight className="size-6" aria-hidden />
              </button>
              <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-navy-700 px-3 py-1 text-[12px] font-bold tabular-nums text-white">
                {index + 1} / {n}
              </p>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
