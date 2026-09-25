import type { Market } from "@/lib/types";

/** Client-safe shipping types shared by the adapters, the price comparison and the admin UI. */

export type CarrierCode = "omniva" | "dpd" | "venipak" | "smartposti" | "unisend" | "latvijas_pasts" | "dhl_express" | "freight" | (string & {});

export type ServiceType = "locker" | "courier" | "pickup" | "pallet";

export const SHIPMENT_STATUSES = ["draft", "created", "label_printed", "handed_over", "in_transit", "delivered", "returned", "cancelled"] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export type Carrier = {
  code: CarrierCode;
  name: string;
  enabled: boolean;
  checkout_enabled: boolean;
  tracking_url_template: string | null;
  logo: string | null;
  website: string | null;
  notes: string | null;
  sort: number;
};

export type RateRow = {
  id: string;
  carrier: CarrierCode;
  service_code: string;
  service_name: string;
  type: ServiceType;
  country: Market;
  size_code: string | null;
  min_weight_kg: number;
  max_weight_kg: number;
  max_length_cm: number | null;
  max_width_cm: number | null;
  max_height_cm: number | null;
  price_net: number | null;
  currency: string;
  transit_days_min: number | null;
  transit_days_max: number | null;
  source_url: string | null;
  source_date: string | null;
  source_note: string | null;
  is_contract: boolean;
  active: boolean;
  sort: number;
};

export type PickupPoint = {
  id: string;
  name: string;
  city: string;
  address: string;
  postcode?: string;
  country: Market;
  lat: number | null;
  lng: number | null;
  /** carrier-specific extra data needed when creating a shipment (e.g. Venipak terminal company code) */
  meta?: Record<string, string | number | null>;
};

/** What each carrier integration can do in this deployment (computed server-side from env vars). */
export type CarrierCapabilities = {
  code: CarrierCode;
  /** shipments + labels are created through the carrier API */
  api: boolean;
  /** env var names that enable the API (names only — never values) */
  envVars: string[];
  /** which of those env vars are set */
  envSet: string[];
  /** pickup-point list available (public feed or with credentials) */
  pickupPoints: boolean;
  /** tracking status can be refreshed from the carrier */
  tracking: boolean;
  /** official documentation used for the integration */
  docs: string[];
  note?: string;
};

export type ParcelInput = { weightKg: number; l: number; w: number; h: number };

export type ShipmentEvent = { at: string; status?: ShipmentStatus | null; text: string; location?: string | null; source: "api" | "admin" | "system" };
