import { Clock, Tag } from "lucide-react";
import { BADGE_KEYS, BADGE_LABEL_LV, PROMO_LABEL_LV, promoStatus, rigaEndDate, type BadgeKey, type ProductPromo } from "@/lib/promo";
import { cn } from "@/lib/utils";

const fmt = (iso: string) => new Intl.DateTimeFormat("lv-LV", { day: "numeric", month: "short", timeZone: "Europe/Riga" }).format(new Date(iso));

/** Compact promo + badge marks for admin tables. */
export function PromoMarks({ promo, badges, className }: { promo?: ProductPromo | null; badges?: string[]; className?: string }) {
  const st = promoStatus(promo);
  const list = (badges ?? []).filter((b): b is BadgeKey => (BADGE_KEYS as readonly string[]).includes(b));
  if (st === "none" && !list.length) return null;
  return (
    <span className={cn("mt-1 flex flex-wrap items-center gap-1", className)}>
      {promo && st !== "none" && (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-extrabold",
            st === "active" ? "bg-rose-600 text-white" : st === "scheduled" ? "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200" : "bg-slate-100 text-slate-500 line-through",
          )}
          title={st === "scheduled" ? "Ieplānota" : st === "ended" ? "Beigusies" : "Aktīva"}
        >
          {st === "scheduled" ? <Clock className="h-3 w-3" /> : <Tag className="h-3 w-3" />}
          {promo.percent ? `−${Number(promo.percent)}% ` : ""}
          {PROMO_LABEL_LV[promo.type]}
          {st === "scheduled" && promo.starts_at && <span className="font-semibold">no {fmt(promo.starts_at)}</span>}
          {st === "active" && promo.ends_at && <span className="font-semibold opacity-90">līdz {fmt(`${rigaEndDate(promo.ends_at)}T12:00:00Z`)}</span>}
        </span>
      )}
      {list.map((b) => (
        <span key={b} className="rounded-md bg-navy-50 px-1.5 py-0.5 text-[10.5px] font-bold text-navy-700 ring-1 ring-inset ring-navy-100">
          {BADGE_LABEL_LV[b]}
        </span>
      ))}
    </span>
  );
}
