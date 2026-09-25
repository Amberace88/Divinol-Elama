import { cn } from "@/lib/utils";

/**
 * Small inline SVG flags (emoji flags don't render on Windows).
 * Russian is shown as a neutral language tag rather than a state flag — common practice for Baltic sites.
 */
export type FlagCode = "lv" | "et" | "lt" | "en" | "ru" | "LV" | "EE" | "LT";

function Stripes({ colors, weights }: { colors: string[]; weights?: number[] }) {
  const w = weights ?? colors.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  const tops = w.map((_, i) => (w.slice(0, i).reduce((a, b) => a + b, 0) / total) * 20);
  return (
    <>
      {colors.map((c, i) => (
        <rect key={i} x="0" y={tops[i]} width="30" height={(w[i] / total) * 20 + 0.05} fill={c} />
      ))}
    </>
  );
}

export function Flag({ code, className }: { code: FlagCode; className?: string }) {
  const c = code.toLowerCase();
  const base = cn("inline-block h-[14px] w-[21px] shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/15", className);

  if (c === "ru") {
    return (
      <span aria-hidden className={cn(base, "grid place-items-center bg-slate-200 text-[8.5px] font-extrabold leading-none text-slate-600")}>
        RU
      </span>
    );
  }

  return (
    <svg aria-hidden viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" className={base}>
      {c === "lv" && <Stripes colors={["#9E3039", "#FFFFFF", "#9E3039"]} weights={[2, 1, 2]} />}
      {(c === "et" || c === "ee") && <Stripes colors={["#0072CE", "#000000", "#FFFFFF"]} />}
      {c === "lt" && <Stripes colors={["#FDB913", "#006A44", "#C1272D"]} />}
      {c === "en" && (
        <g transform="translate(-5 0) scale(0.6667)">
          <rect width="60" height="30" fill="#012169" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2.4" />
          <path d="M30,0 V30 M0,15 H60" stroke="#FFFFFF" strokeWidth="10" />
          <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
        </g>
      )}
    </svg>
  );
}
