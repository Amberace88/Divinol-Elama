import Image from "next/image";
import { Droplets } from "lucide-react";
import { cn } from "@/lib/utils";

/** Product packshot on a soft white stage — product photos have white backgrounds, so we lean into it. */
export function ProductImage({
  src,
  alt,
  sizes,
  priority,
  className,
  imgClassName,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-white", className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-contain mix-blend-multiply", imgClassName)}
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-navy-200">
          <Droplets className="size-12" aria-hidden />
        </div>
      )}
    </div>
  );
}
