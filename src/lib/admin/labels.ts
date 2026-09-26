/** Latvian labels + pill tones for admin enums (client + server safe). */
export type Tone = "gray" | "blue" | "yellow" | "green" | "red" | "purple" | "navy" | "orange";

type LabelMap = Record<string, { label: string; tone: Tone }>;

export const ORDER_STATUS: LabelMap = {
  new: { label: "Jauns", tone: "yellow" },
  confirmed: { label: "Apstiprināts", tone: "blue" },
  processing: { label: "Komplektē", tone: "purple" },
  shipped: { label: "Nosūtīts", tone: "navy" },
  completed: { label: "Izpildīts", tone: "green" },
  cancelled: { label: "Atcelts", tone: "gray" },
};
export const ORDER_STATUSES = Object.keys(ORDER_STATUS);
export const OPEN_ORDER_STATUSES = ["new", "confirmed", "processing"];

export const PAYMENT_STATUS: LabelMap = {
  unpaid: { label: "Neapmaksāts", tone: "orange" },
  pending: { label: "Gaida maksājumu", tone: "yellow" },
  paid: { label: "Apmaksāts", tone: "green" },
  failed: { label: "Maksājums neizdevās", tone: "red" },
  refunded: { label: "Atmaksāts", tone: "gray" },
  partially_refunded: { label: "Daļēji atmaksāts", tone: "purple" },
};
export const PAYMENT_STATUSES = Object.keys(PAYMENT_STATUS);

export const PAYMENT_METHOD: Record<string, string> = {
  bank_transfer: "Bankas pārskaitījums",
  card: "Maksājumu karte",
  invoice: "Pēc rēķina (B2B)",
  cash_on_pickup: "Maksa saņemot",
  montonio_bank: "Bankas saite (Montonio)",
  montonio_card: "Karte / Apple Pay / Google Pay (Montonio)",
};

export const SHIPPING_METHOD: Record<string, string> = {
  pickup: "Saņemšana noliktavā",
  parcel_locker: "Pakomāts",
  courier: "Kurjers",
  freight: "Kravas piegāde",
};

export const MARKET: Record<string, string> = { LV: "Latvija", EE: "Igaunija", LT: "Lietuva" };
export const MARKETS = ["LV", "EE", "LT"] as const;

export const INVOICE_TYPE: LabelMap = {
  proforma: { label: "Avansa rēķins", tone: "blue" },
  invoice: { label: "Rēķins", tone: "navy" },
  credit_note: { label: "Kredītrēķins", tone: "purple" },
};
export const INVOICE_STATUS: LabelMap = {
  issued: { label: "Izrakstīts", tone: "yellow" },
  paid: { label: "Apmaksāts", tone: "green" },
  void: { label: "Anulēts", tone: "gray" },
};

export const B2B_STATUS: LabelMap = {
  none: { label: "—", tone: "gray" },
  pending: { label: "Gaida apstiprinājumu", tone: "yellow" },
  approved: { label: "Apstiprināts", tone: "green" },
  rejected: { label: "Noraidīts", tone: "red" },
};

export const CUSTOMER_TYPE: Record<string, string> = { private: "Privātpersona", business: "Uzņēmums" };
export const ROLE: Record<string, string> = { customer: "Klients", admin: "Administrators" };

export const INQUIRY_TYPE: LabelMap = {
  contact: { label: "Kontaktforma", tone: "blue" },
  b2b: { label: "B2B pieteikums", tone: "navy" },
  quote: { label: "Cenu pieprasījums", tone: "purple" },
  oil_finder: { label: "Eļļas izvēle", tone: "orange" },
};
export const INQUIRY_STATUS: LabelMap = {
  new: { label: "Jauns", tone: "yellow" },
  in_progress: { label: "Procesā", tone: "blue" },
  done: { label: "Pabeigts", tone: "green" },
  spam: { label: "Surogātpasts", tone: "gray" },
};

export const ORDER_EVENT: Record<string, string> = {
  created: "Pasūtījums izveidots",
  status: "Statusa maiņa",
  payment: "Apmaksa",
  invoice: "Izrakstīts rēķins",
  tracking: "Sūtījuma kods",
  note: "Piezīme",
  shipping: "Piegāde",
  shipment: "Sūtījums",
};

export const LANGS = ["lv", "et", "lt", "en", "ru"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABEL: Record<Lang, string> = { lv: "Latviešu", et: "Eesti", lt: "Lietuvių", en: "English", ru: "Русский" };

export const CATEGORY_ICONS = ["car", "truck", "bike", "cog", "gauge", "factory", "droplets", "spray", "snowflake", "hardhat"] as const;

export function labelOf(map: LabelMap, key: string | null | undefined) {
  return map[key ?? ""] ?? { label: key ?? "—", tone: "gray" as Tone };
}
