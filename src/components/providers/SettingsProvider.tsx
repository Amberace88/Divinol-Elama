"use client";

import { createContext, useContext } from "react";
import type { StoreSettings } from "@/lib/settings";

const Ctx = createContext<StoreSettings | null>(null);

export function SettingsProvider({ settings, children }: { settings: StoreSettings; children: React.ReactNode }) {
  return <Ctx.Provider value={settings}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSettings must be used inside SettingsProvider");
  return s;
}
