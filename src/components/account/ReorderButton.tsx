"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { useCart, type CartItem } from "@/components/providers/CartProvider";

export type ReorderLine = Omit<CartItem, "qty"> & { qty: number };

export function ReorderButton({ lines, unavailable }: { lines: ReorderLine[]; unavailable: number }) {
  const t = useTranslations("account.order");
  const { add, setOpen } = useCart();
  const [busy, setBusy] = useState(false);

  function reorder() {
    if (!lines.length) {
      toast.error(t("reorderNone"));
      return;
    }
    setBusy(true);
    try {
      for (const { qty, ...item } of lines) add(item, qty);
      setOpen(true);
      const count = lines.reduce((s, l) => s + l.qty, 0);
      if (unavailable > 0) toast.warning(t("reorderPartial", { count, missing: unavailable }));
      else toast.success(t("reorderDone", { count }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" onClick={reorder} disabled={busy || !lines.length} title={!lines.length ? t("reorderNone") : undefined}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
      {t("reorder")}
    </Button>
  );
}
