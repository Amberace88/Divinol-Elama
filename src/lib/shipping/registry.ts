import "server-only";
import type { Market } from "@/lib/types";
import type { CarrierAdapter } from "./adapter";
import { dpdAdapter } from "./dpd";
import { omnivaAdapter } from "./omniva";
import { smartpostiAdapter } from "./smartposti";
import type { CarrierCapabilities, PickupPoint } from "./types";
import { venipakAdapter } from "./venipak";

/**
 * Carrier registry. Carriers without an adapter (or without credentials) work in manual mode:
 * the admin enters the tracking number, optionally uploads the label PDF, and the system builds the tracking link.
 *
 *  - Unisend / LP Express: API docs (https://api-manosiuntos.post.lt, https://www.post.lt/savitarna/api_doc.html) could not be
 *    reviewed completely (auth + label endpoints) → manual mode.
 *  - Latvijas Pasts, DHL Express, pallet freight: no public self-service API documentation → manual mode.
 */

const manual = (code: string, name: string, note: string): CarrierAdapter => ({
  code,
  name,
  capabilities: () => ({ code, api: false, envVars: [], envSet: [], pickupPoints: false, tracking: false, docs: [], note }),
});

export const ADAPTERS: Record<string, CarrierAdapter> = {
  omniva: omnivaAdapter,
  dpd: dpdAdapter,
  venipak: venipakAdapter,
  smartposti: smartpostiAdapter,
  unisend: manual("unisend", "Unisend", "Manuālais režīms: ievadiet sūtījuma kodu no my.unisend.lv."),
  latvijas_pasts: manual("latvijas_pasts", "Latvijas Pasts", "Manuālais režīms: ievadiet sūtījuma kodu."),
  dhl_express: manual("dhl_express", "DHL Express", "Manuālais režīms (MyDHL+)."),
  freight: manual("freight", "Kravas pārvadātājs", "Manuālais režīms: pavadzīme / CMR no pārvadātāja."),
};

export function getAdapter(code: string): CarrierAdapter {
  return ADAPTERS[code] ?? manual(code, code, "Manuālais režīms.");
}

export function allCapabilities(codes: string[]): Record<string, CarrierCapabilities> {
  return Object.fromEntries(codes.map((c) => [c, getAdapter(c).capabilities()]));
}

/** Locker providers whose pickup-point list can be shown to customers in this deployment. */
export function pickupFeedAvailable(code: string) {
  const a = ADAPTERS[code];
  return Boolean(a?.listPickupPoints && a.capabilities().pickupPoints);
}

export async function listPickupPoints(code: string, country: Market): Promise<PickupPoint[]> {
  const a = ADAPTERS[code];
  if (!a?.listPickupPoints || !a.capabilities().pickupPoints) return [];
  return a.listPickupPoints(country);
}
