"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Link2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { IMAGE_TYPES, MAX_IMAGE_MB, removeFromBucket, uploadToBucket } from "@/lib/admin/upload";
import { cn } from "@/lib/utils";
import { Spinner } from "../client-ui";
import { btn, inputCls } from "../styles";
import { imgUnoptimized } from "../Thumb";

/** Product gallery: upload to Storage, drag / arrow reorder, delete. The first image is the main one. */
export function ImageManager({
  images,
  onChange,
  folder,
}: {
  images: string[];
  onChange: (next: string[] | ((prev: string[]) => string[])) => void;
  folder: string;
}) {
  const [uploading, setUploading] = useState(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  // Files uploaded in this editing session can be deleted from storage right away when removed.
  const fresh = useRef(new Set<string>());

  async function upload(files: FileList | File[]) {
    const list = [...files].filter((f) => {
      if (!IMAGE_TYPES.includes(f.type)) {
        toast.error(`${f.name}: neatbalstīts formāts (JPG, PNG, WebP, AVIF)`);
        return false;
      }
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
        toast.error(`${f.name}: fails lielāks par ${MAX_IMAGE_MB} MB`);
        return false;
      }
      return true;
    });
    if (!list.length) return;
    setUploading((n) => n + list.length);
    await Promise.all(
      list.map(async (file) => {
        try {
          const { url } = await uploadToBucket("product-images", folder, file);
          fresh.current.add(url);
          onChange((prev) => [...prev, url]);
        } catch (e) {
          toast.error(`${file.name}: ${e instanceof Error ? e.message : "augšupielāde neizdevās"}`);
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  }

  function remove(i: number) {
    const url = images[i];
    onChange(images.filter((_, j) => j !== i));
    if (fresh.current.has(url)) {
      fresh.current.delete(url);
      void removeFromBucket("product-images", url);
    }
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((src, i) => (
          <li
            key={src + i}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragIdx != null) move(dragIdx, i);
              setDragIdx(null);
            }}
            onDragEnd={() => setDragIdx(null)}
            className={cn(
              "group relative aspect-square cursor-grab overflow-hidden rounded-xl border bg-white transition active:cursor-grabbing",
              i === 0 ? "border-brand-400 ring-2 ring-brand-200" : "border-line",
              dragIdx === i && "opacity-40",
            )}
          >
            <Image src={src} alt={`Attēls ${i + 1}`} fill sizes="200px" unoptimized={imgUnoptimized(src)} className="object-contain p-2" />
            {i === 0 && (
              <span className="skew-tag absolute left-2 top-2 bg-brand-400 text-[10px] font-extrabold uppercase text-navy-900">
                <span>Galvenais</span>
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-navy-950/70 to-transparent p-2 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <div className="flex gap-1">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="grid h-7 w-7 place-items-center rounded-md bg-white/90 text-ink hover:bg-white disabled:opacity-40" aria-label="Pārvietot pa kreisi">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === images.length - 1}
                  className="grid h-7 w-7 place-items-center rounded-md bg-white/90 text-ink hover:bg-white disabled:opacity-40"
                  aria-label="Pārvietot pa labi"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <button type="button" onClick={() => remove(i)} className="grid h-7 w-7 place-items-center rounded-md bg-red-600 text-white hover:bg-red-700" aria-label={`Dzēst attēlu ${i + 1}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <li key={`up-${i}`} className="grid aspect-square place-items-center rounded-xl border border-dashed border-navy-200 bg-navy-50/50">
            <Spinner className="h-5 w-5 text-navy-400" />
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDropActive(false);
              if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
            }}
            className={cn(
              "flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-center text-[12px] font-semibold transition",
              dropActive ? "border-brand-400 bg-brand-50 text-navy-700" : "border-line text-muted hover:border-navy-300 hover:bg-navy-50/40 hover:text-navy-700",
            )}
          >
            {dropActive ? <UploadCloud className="h-6 w-6" /> : <ImagePlus className="h-6 w-6" />}
            Pievienot attēlus
            <span className="font-normal text-muted">vai ievelciet šeit</span>
          </button>
        </li>
      </ul>
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void upload(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor="img-url">
          Attēla URL
        </label>
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id="img-url"
            className={cn(inputCls, "h-9 pl-9 text-[13px]")}
            placeholder="…vai ielīmējiet attēla URL (/media/… vai https://…)"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (urlDraft.trim()) {
                  onChange([...images, urlDraft.trim()]);
                  setUrlDraft("");
                }
              }
            }}
          />
        </div>
        <button
          type="button"
          className={btn("outline")}
          disabled={!/^(\/|https?:\/\/)/.test(urlDraft.trim())}
          onClick={() => {
            onChange([...images, urlDraft.trim()]);
            setUrlDraft("");
          }}
        >
          Pievienot
        </button>
      </div>
      <p className="mt-2 text-[12px] text-muted">Pirmais attēls tiek rādīts katalogā. Kārtojiet, velkot vai ar bultiņām. JPG/PNG/WebP/AVIF līdz {MAX_IMAGE_MB} MB.</p>
    </div>
  );
}
