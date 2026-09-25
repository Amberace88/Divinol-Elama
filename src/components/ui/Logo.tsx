import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className, tagline }: { className?: string; tagline?: string }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <Image src="/media/brand/elama-logo.png" alt="ELAMA" width={826} height={155} priority className="h-6 w-auto sm:h-7" />
      {tagline && (
        <span className="hidden border-l border-white/20 pl-3 text-[10px] font-bold uppercase leading-tight tracking-[0.14em] text-white/60 xl:block">
          {tagline}
        </span>
      )}
    </span>
  );
}
