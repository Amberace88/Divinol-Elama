"use client";

import { AlertTriangle, CalendarDays, Clock, Flame, Hourglass, Leaf, Megaphone, Percent, Snowflake, Sparkles, Tag, ThumbsUp, Wrench, X } from "lucide-react";
import { fmtMoney } from "@/lib/admin/format";
import {
  BADGE_KEYS,
  BADGE_LABEL_LV,
  PROMO_LABEL_LV,
  PROMO_TYPES,
  promoStatus,
  rigaDayEnd,
  rigaDayStart,
  rigaMonthEnd,
  rigaToday,
  type BadgeKey,
  type PromoType,
} from "@/lib/promo";
import { cn } from "@/lib/utils";
import { Field } from "../client-ui";
import { inputCls } from "../styles";
import { parseDec, type VariantState } from "../products/VariantsEditor";

export type PromoFormValue = {
  promo_type: "" | PromoType;
  promo_percent: string;
  promo_start: string;
  promo_end: string;
  badges: string[];
};

export const BADGE_ICON: Record<BadgeKey, typeof Tag> = {
  new: Sparkles,
  bestseller: Flame,
  recommended: ThumbsUp,
  limited: Hourglass,
  seasonal: Snowflake,
  bio: Leaf,
  pro: Wrench,
};

const BADGE_HINT: Record<BadgeKey, string> = {
  new: "Jauns produkts sortimentā",
  bestseller: "Visvairāk pirktais",
  recommended: "Jūsu ieteikums klientiem",
  limited: "Paliek maz — mudina pirkt",
  seasonal: "Ziemas / vasaras prece",
  bio: "Tikai, ja produkts tiešām ir bio",
  pro: "Servisiem un uzņēmumiem",
};

const TYPE_STYLE: Record<PromoType, { icon: typeof Tag; on: string; hint: string }> = {
  sale: { icon: Tag, on: "border-rose-500 bg-rose-50 text-rose-700 ring-rose-200", hint: "Parasta atlaide uz laiku" },
  clearance: { icon: Megaphone, on: "border-orange-500 bg-orange-50 text-orange-700 ring-orange-200", hint: "Atlikumu iztirgošana" },
  special: { icon: Sparkles, on: "border-amber-400 bg-amber-50 text-amber-800 ring-amber-200", hint: "Izcelts piedāvājums (var bez %)" },
};

const PRESETS = [5, 10, 15, 20, 25, 30, 40, 50];

/**
 * Promotion + badges editor (product editor and bulk promotions). Dates are whole days in Riga time;
 * with `variants` it shows the new prices and warns when a price would fall below the purchase cost.
 */
export function PromoEditor({
  value,
  onChange,
  errors = {},
  variants,
  vat = 21,
  compact = false,
  showBadges = true,
}: {
  value: PromoFormValue;
  onChange: (v: Partial<PromoFormValue>) => void;
  errors?: Record<string, string>;
  variants?: VariantState[];
  vat?: number;
  compact?: boolean;
  showBadges?: boolean;
}) {
  const pct = parseDec(value.promo_percent) ?? 0;
  const status = value.promo_type
    ? promoStatus({ type: value.promo_type, percent: pct || null, starts_at: rigaDayStart(value.promo_start), ends_at: rigaDayEnd(value.promo_end) })
    : "none";
  const k = 1 + vat / 100;

  const rows = (variants ?? [])
    .filter((v) => v.is_active)
    .map((v) => {
      const net = parseDec(v.net);
      const cost = parseDec(v.cost);
      if (net == null) return null;
      const promoNet = Math.round(net * (1 - pct / 100) * 100) / 100;
      const label = v.size ? `${v.size.replace(".", ",")} ${v.unit === "kg" ? "kg" : v.unit === "l" ? "L" : "gab."}` : v.sku || "—";
      return {
        key: v.key,
        label,
        gross: Math.round(net * k * 100) / 100,
        promoGross: Math.round(promoNet * k * 100) / 100,
        margin: cost != null && promoNet > 0 ? ((promoNet - cost) / promoNet) * 100 : null,
        below: cost != null && promoNet < cost,
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
  const anyBelow = rows.some((r) => r.below);

  const toggleBadge = (b: BadgeKey) =>
    onChange({ badges: value.badges.includes(b) ? value.badges.filter((x) => x !== b) : [...value.badges, b] });

  const body = (
    <>
      {/* type */}
      <div className={cn("grid gap-2", compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 lg:grid-cols-4")}>
        <button
          type="button"
          onClick={() => onChange({ promo_type: "" })}
          className={cn(
            "flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition",
            !value.promo_type ? "border-navy-700 bg-navy-50 text-navy-800" : "border-line text-muted hover:border-navy-200",
          )}
        >
          <X className="h-4 w-4 shrink-0" />
          <span className="text-[13px] font-bold">Bez akcijas</span>
        </button>
        {PROMO_TYPES.map((t) => {
          const st = TYPE_STYLE[t];
          const Icon = st.icon;
          const on = value.promo_type === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() =>
                onChange({
                  promo_type: t,
                  ...(t !== "special" && !value.promo_percent ? { promo_percent: "10" } : {}),
                  ...(!value.promo_start ? { promo_start: rigaToday() } : {}),
                })
              }
              className={cn("rounded-xl border-2 px-3 py-2.5 text-left transition", on ? cn(st.on, "ring-4") : "border-line hover:border-navy-200")}
            >
              <span className="flex items-center gap-2 text-[13px] font-bold">
                <Icon className="h-4 w-4 shrink-0" /> {PROMO_LABEL_LV[t]}
              </span>
              {!compact && <span className="mt-0.5 block text-[11px] font-medium text-muted">{st.hint}</span>}
            </button>
          );
        })}
      </div>

      {value.promo_type && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <Field label={value.promo_type === "special" ? "Atlaide (nav obligāta)" : "Atlaide"} htmlFor="promo-pct" error={errors.promo_percent}>
              <div className="relative">
                <input
                  id="promo-pct"
                  inputMode="decimal"
                  className={cn(inputCls, "pr-9 text-[16px] font-extrabold tabular-nums")}
                  value={value.promo_percent}
                  onChange={(e) => onChange({ promo_percent: e.target.value })}
                  placeholder="0"
                  aria-invalid={Boolean(errors.promo_percent)}
                />
                <Percent className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              </div>
            </Field>
            <div>
              <p className="mb-1.5 text-[12.5px] font-semibold text-ink/80">Ātrā izvēle</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onChange({ promo_percent: String(n) })}
                    className={cn(
                      "h-9 min-w-12 rounded-lg px-2.5 text-[13px] font-extrabold tabular-nums ring-1 ring-inset transition",
                      pct === n ? "bg-rose-600 text-white ring-rose-600" : "bg-white text-ink ring-line hover:ring-rose-300",
                    )}
                  >
                    −{n}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sākas" htmlFor="promo-start" hint="Tukšs = uzreiz">
              <div className="flex gap-1.5">
                <input id="promo-start" type="date" className={inputCls} value={value.promo_start} onChange={(e) => onChange({ promo_start: e.target.value })} />
                <button type="button" className="h-10 shrink-0 rounded-lg px-2.5 text-[12px] font-bold text-navy-700 ring-1 ring-inset ring-line hover:bg-navy-50" onClick={() => onChange({ promo_start: rigaToday() })}>
                  Šodien
                </button>
              </div>
            </Field>
            <Field label="Beidzas (ieskaitot)" htmlFor="promo-end" hint="Tukšs = bez termiņa" error={errors.promo_ends_at}>
              <input id="promo-end" type="date" className={inputCls} value={value.promo_end} min={value.promo_start || undefined} onChange={(e) => onChange({ promo_end: e.target.value })} aria-invalid={Boolean(errors.promo_ends_at)} />
            </Field>
          </div>
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {[
              ["1 nedēļa", rigaToday(6)],
              ["2 nedēļas", rigaToday(13)],
              ["Līdz mēneša beigām", rigaMonthEnd()],
              ["30 dienas", rigaToday(29)],
            ].map(([l, d]) => (
              <button key={l} type="button" onClick={() => onChange({ promo_start: value.promo_start || rigaToday(), promo_end: d })} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12px] font-bold text-navy-700 ring-1 ring-inset ring-line hover:bg-navy-50">
                <CalendarDays className="h-3.5 w-3.5" /> {l}
              </button>
            ))}
            <button type="button" onClick={() => onChange({ promo_end: "" })} className="h-8 rounded-lg px-2.5 text-[12px] font-bold text-muted ring-1 ring-inset ring-line hover:bg-slate-50">
              Bez termiņa
            </button>
          </div>

          <p
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold",
              status === "active" ? "bg-emerald-50 text-emerald-800" : status === "scheduled" ? "bg-sky-50 text-sky-800" : status === "ended" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800",
            )}
          >
            <Clock className="h-4 w-4 shrink-0" />
            {status === "active"
              ? "Pēc saglabāšanas akcija būs redzama veikalā uzreiz — ar nozīmīti, nosvītroto veco cenu un akcijas cenu grozā."
              : status === "scheduled"
                ? "Akcija ieplānota — veikalā tā parādīsies sākuma dienā automātiski."
                : status === "ended"
                  ? "Akcijas termiņš jau beidzies — veikalā tā netiek rādīta."
                  : "Norādiet atlaidi, lai akcija stātos spēkā."}
          </p>

          {rows.length > 0 && pct > 0 && (
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-[13px]">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Iepakojums</th>
                    <th className="px-3 py-2 text-right">Parastā cena</th>
                    <th className="px-3 py-2 text-right">Akcijas cena</th>
                    <th className="px-3 py-2 text-right">Ietaupa</th>
                    <th className="px-3 py-2 text-right">Peļņa</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className={cn("border-t border-line", r.below && "bg-red-50")}>
                      <td className="px-3 py-2 font-bold text-ink">{r.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted line-through decoration-rose-400">{fmtMoney(r.gross)}</td>
                      <td className="px-3 py-2 text-right font-extrabold tabular-nums text-rose-600">{fmtMoney(r.promoGross)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700">−{fmtMoney(Math.round((r.gross - r.promoGross) * 100) / 100)}</td>
                      <td className={cn("px-3 py-2 text-right font-bold tabular-nums", r.below ? "text-red-700" : r.margin != null && r.margin < 10 ? "text-amber-700" : "text-ink/70")}>
                        {r.margin == null ? "—" : `${Math.round(r.margin)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-line bg-slate-50 px-3 py-1.5 text-[11px] text-muted">Cenas ar PVN {vat}%. Peļņa — no iepirkuma cenas (ja ievadīta pie variantiem).</p>
            </div>
          )}
          {anyBelow && (
            <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-800 ring-1 ring-inset ring-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Ar šo atlaidi cena kādam iepakojumam ir zem iepirkuma cenas — pārdošana būs ar zaudējumiem.
            </p>
          )}
          <p className="text-[11.5px] text-muted">B2B klienti saņem lielāko no savas atlaides un akcijas atlaides (tās nesummējas).</p>
        </div>
      )}

      {showBadges && (
        <div className={cn(value.promo_type || !compact ? "mt-6" : "mt-4")}>
          <p className="mb-2 text-[13px] font-bold text-ink">Nozīmītes produktam</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {BADGE_KEYS.map((b) => {
              const Icon = BADGE_ICON[b];
              const on = value.badges.includes(b);
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleBadge(b)}
                  className={cn("flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition", on ? "border-navy-700 bg-navy-50" : "border-line hover:border-navy-200")}
                >
                  <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", on ? "bg-navy-700 text-brand-300" : "bg-slate-100 text-muted")}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[13px] font-bold text-ink">{BADGE_LABEL_LV[b]}</span>
                    <span className="block text-[11px] leading-snug text-muted">{BADGE_HINT[b]}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11.5px] text-muted">Produkta kartītē redzamas 2 pirmās nozīmītes (akcija vienmēr pirmā), produkta lapā — visas.</p>
        </div>
      )}
    </>
  );

  if (compact) return <div>{body}</div>;
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink">
          <Tag className="h-4 w-4 text-rose-600" /> Akcija un nozīmītes
        </h2>
        {status !== "none" && (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[12px] font-bold",
              status === "active" ? "bg-emerald-100 text-emerald-800" : status === "scheduled" ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600",
            )}
          >
            {status === "active" ? "Aktīva" : status === "scheduled" ? "Ieplānota" : "Beigusies"}
          </span>
        )}
      </div>
      {body}
    </section>
  );
}
