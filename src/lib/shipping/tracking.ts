import type { ShipmentStatus } from "./types";

/** Client-safe helpers for tracking links and shipment status labels. */

const FALLBACK_TEMPLATES: Record<string, string> = {
  omniva: "https://www.omniva.lv/en/track-and-receive-parcels/?barcode={code}",
  dpd: "https://www.dpdgroup.com/lv/mydpd/my-parcels/track?lang=lv&parcelNumber={code}",
  venipak: "https://venipak.com/lv/en/tracking/?code={code}",
};

export function buildTrackingUrl(template: string | null | undefined, code: string | null | undefined, carrier?: string | null) {
  if (!code) return null;
  const t = template || (carrier ? FALLBACK_TEMPLATES[carrier] : null);
  if (!t || !t.includes("{code}")) return null;
  return t.replace("{code}", encodeURIComponent(code.trim()));
}

/** Best guess of the carrier from the tracking number format (legacy orders without tracking_carrier). */
export function guessCarrier(code: string | null | undefined): string | null {
  const c = (code ?? "").trim();
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(c)) return "omniva"; // UPU S10 (Omniva / postal)
  if (/^\d{14}$/.test(c)) return "dpd";
  if (/^V\d+E\d{7}$/.test(c)) return "venipak";
  return null;
}

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, { label: string; tone: "gray" | "blue" | "yellow" | "green" | "red" | "purple" | "navy" | "orange" }> = {
  draft: { label: "Melnraksts", tone: "gray" },
  created: { label: "Izveidots", tone: "yellow" },
  label_printed: { label: "Uzlīme izdrukāta", tone: "purple" },
  handed_over: { label: "Nodots pārvadātājam", tone: "blue" },
  in_transit: { label: "Ceļā", tone: "navy" },
  delivered: { label: "Piegādāts", tone: "green" },
  returned: { label: "Atgriezts", tone: "orange" },
  cancelled: { label: "Atcelts", tone: "red" },
};

export const SERVICE_TYPE_LABEL: Record<string, string> = {
  locker: "Pakomāts",
  courier: "Kurjers",
  pickup: "Saņemšanas punkts",
  pallet: "Palete / krava",
};

/** Maps a free-text carrier event to our status (keywords in EN / LV / LT / ET). */
export function statusFromText(text: string): ShipmentStatus | null {
  const t = text.toLowerCase();
  if (/(delivered|piegādāt|izsniegt|pristatyt|įteikt|kätte toimetatud|väljastatud|received by)/.test(t)) return "delivered";
  if (/(return|atgriez|grąžin|tagastat)/.test(t)) return "returned";
  if (/(cancel|atcelt|atšaukt|tühistat)/.test(t)) return "cancelled";
  if (/(transit|ceļā|sortēš|terminal|pārvadā|out for delivery|kurjer|arrived|depot|vežam|teel|sorting|in delivery)/.test(t)) return "in_transit";
  if (/(accepted|picked up|pieņemt|priimt|vastu võetud|handed over|nodots)/.test(t)) return "handed_over";
  return null;
}
