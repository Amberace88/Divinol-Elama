import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** Local /media images and *.supabase.co storage are allowed by next.config; anything else is served as-is. */
export function imgUnoptimized(src: string) {
  if (src.startsWith("/")) return false;
  try {
    return !new URL(src).hostname.endsWith(".supabase.co");
  } catch {
    return true;
  }
}

export function Thumb({ src, alt = "", size = 40, className }: { src: string | null | undefined; alt?: string; size?: number; className?: string }) {
  if (!src)
    return (
      <span
        className={cn("grid shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400", className)}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <ImageOff className="h-4 w-4" />
      </span>
    );
  return (
    <Image
      src={src}
      alt={alt}
      width={size * 2}
      height={size * 2}
      unoptimized={imgUnoptimized(src)}
      className={cn("shrink-0 rounded-lg bg-white object-contain ring-1 ring-line", className)}
      style={{ width: size, height: size }}
    />
  );
}
