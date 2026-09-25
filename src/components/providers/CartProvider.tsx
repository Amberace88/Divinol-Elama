"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  slug: string;
  key: string; // variant key (sku or size+unit)
  sku: string | null;
  name: string;
  pack: string;
  image: string | null;
  size: number | null;
  unit: string;
  price_net: number; // snapshot for display; re-validated on the server at checkout
  qty: number;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (slug: string, key: string, qty: number) => void;
  remove: (slug: string, key: string) => void;
  clear: () => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  ready: boolean;
};

const STORAGE_KEY = "divinol-cart-v1";
const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* storage unavailable */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, ready]);

  const add = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    setItems((prev) => {
      const i = prev.findIndex((p) => p.slug === item.slug && p.key === item.key);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], ...item, qty: Math.min(999, next[i].qty + qty) };
        return next;
      }
      return [...prev, { ...item, qty }];
    });
    setOpen(true);
  }, []);

  const setQty = useCallback((slug: string, key: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((p) => !(p.slug === slug && p.key === key))
        : prev.map((p) => (p.slug === slug && p.key === key ? { ...p, qty: Math.min(999, qty) } : p)),
    );
  }, []);

  const remove = useCallback((slug: string, key: string) => {
    setItems((prev) => prev.filter((p) => !(p.slug === slug && p.key === key)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, count: items.reduce((s, i) => s + i.qty, 0), add, setQty, remove, clear, open, setOpen, ready }),
    [items, add, setQty, remove, clear, open, ready],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}
