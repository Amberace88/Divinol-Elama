"use client";

import { Printer } from "lucide-react";
import { btn } from "./styles";

export function PrintButton() {
  return (
    <button type="button" className={btn("primary")} onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> Drukāt
    </button>
  );
}
