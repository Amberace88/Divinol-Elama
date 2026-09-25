"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { packLabel, pricePerUnit } from "@/lib/commerce";
import type { CartItem } from "@/components/providers/CartProvider";
import { useCart } from "@/components/providers/CartProvider";
import { usePricing } from "@/components/providers/PriceProvider";
import { ProductImage } from "@/components/ui/ProductImage";
import { QtyStepper } from "@/components/ui/QtyStepper";
import { useMoney } from "@/components/ui/useMoney";
import { cn } from "@/lib/utils";

export function CartLine({
  item,
  unit,
  total,
  onNavigate,
  compact,
}: {
  item: CartItem;
  unit: number;
  total: number;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const t = useTranslations("cart");
  const tu = useTranslations("units");
  const { setQty, remove, add, setOpen } = useCart();
  const pricing = usePricing();
  const money = useMoney();
  const ppu = pricePerUnit(item, pricing);
  const pack = packLabel(item) || tu("piece");

  const onRemove = () => {
    const snapshot = { ...item };
    remove(item.slug, item.key);
    toast(t("removed"), {
      description: `${snapshot.name} · ${pack}`,
      action: {
        label: t("undo"),
        onClick: () => {
          const { qty, ...rest } = snapshot;
          add(rest, qty);
          if (!compact) setOpen(false);
        },
      },
    });
  };

  return (
    <div className="flex gap-3.5 py-4">
      <Link
        href={{ pathname: "/product/[slug]", params: { slug: item.slug } }}
        onClick={onNavigate}
        className={cn("shrink-0 overflow-hidden rounded-xl border border-line", compact ? "size-20" : "size-24 sm:size-28")}
      >
        <ProductImage src={item.image} alt={item.name} sizes="112px" className="size-full" imgClassName="p-1.5" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href={{ pathname: "/product/[slug]", params: { slug: item.slug } }}
              onClick={onNavigate}
              className="line-clamp-2 text-[14px] font-bold leading-snug text-ink hover:text-navy-600"
            >
              {item.name}
            </Link>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
              <span className="rounded-md bg-navy-50 px-1.5 py-0.5 font-bold text-navy-700">{pack}</span>
              {item.sku && <span>#{item.sku}</span>}
              {ppu != null && (
                <span>
                  {money(ppu)}/{item.unit === "kg" ? tu("kg") : tu("l")}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${t("remove")}: ${item.name}`}
            className="-mr-1.5 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-red-50 hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <QtyStepper value={item.qty} onChange={(n) => setQty(item.slug, item.key, n)} size="sm" />
          <div className="text-right">
            {item.qty > 1 && <p className="text-[11px] tabular-nums text-muted">{item.qty} × {money(unit)}</p>}
            <p className="text-[15px] font-extrabold tabular-nums text-navy-700">{money(total)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
