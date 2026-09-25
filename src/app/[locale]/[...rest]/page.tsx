import { notFound } from "next/navigation";

/** Catches unknown localized paths so they render the localized not-found page (next-intl pattern). */
export default function CatchAllPage() {
  notFound();
}
