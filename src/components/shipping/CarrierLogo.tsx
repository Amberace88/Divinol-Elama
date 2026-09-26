import { cn } from "@/lib/utils";

/** Official carrier marks (downloaded from each carrier's own website) in public/media/carriers. */
const LOGOS: Record<string, { src: string; bg?: string; square?: boolean }> = {
  omniva: { src: "/media/carriers/omniva.svg", square: true },
  dpd: { src: "/media/carriers/dpd.svg" },
  venipak: { src: "/media/carriers/venipak.svg" },
  latvijas_pasts: { src: "/media/carriers/latvijas_pasts.svg" },
  smartposti: { src: "/media/carriers/smartposti.png" },
  itella: { src: "/media/carriers/smartposti.png" },
  unisend: { src: "/media/carriers/unisend.svg" },
  lp_express: { src: "/media/carriers/unisend.svg" },
  dhl_express: { src: "/media/carriers/dhl_express.svg", bg: "#FFCC00" },
  dhl: { src: "/media/carriers/dhl_express.svg", bg: "#FFCC00" },
};

export function hasCarrierLogo(code: string | null | undefined) {
  return Boolean(code && LOGOS[code]);
}

/**
 * Carrier logo chip. Falls back to a neutral monogram (e.g. for the generic pallet freight carrier).
 * `size`: sm = table rows, md = cards/headers.
 */
export function CarrierLogo({
  code,
  name,
  size = "sm",
  className,
}: {
  code: string | null | undefined;
  name?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const logo = code ? LOGOS[code] : undefined;
  const box = size === "md" ? "h-9 w-[72px] rounded-xl p-1.5" : "h-7 w-14 rounded-lg p-1";
  if (!logo) {
    const initials = (name ?? code ?? "?").replace(/[^A-Za-zĀ-ž ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    return (
      <span aria-hidden className={cn("inline-grid shrink-0 place-items-center bg-slate-100 text-[11px] font-extrabold tracking-wide text-slate-500 ring-1 ring-slate-200", box, className)}>
        {initials || "?"}
      </span>
    );
  }
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center overflow-hidden ring-1 ring-black/10", box, className)}
      style={{ background: logo.bg ?? "#fff" }}
      title={name ?? undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static brand marks, no optimisation needed */}
      <img src={logo.src} alt={name ?? code ?? ""} className={cn("max-h-full max-w-full object-contain", logo.square && "h-full")} loading="lazy" decoding="async" />
    </span>
  );
}
