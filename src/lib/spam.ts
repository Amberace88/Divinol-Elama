/**
 * Form-spam heuristics (shared by the inquiry Server Action; the same rule runs in SQL — inquiry_looks_spam()).
 *
 * The bots hitting the "Ask an expert" form fill every field with random mixed-case letter strings
 * ("iqVTIMTVsfzNdBLSBRKFRMOv"). Real names, car models and VIN codes never look like that: VINs are
 * upper-case + digits, names have at most one capital per word part. A word counts as gibberish when it is
 * 10+ letters only, has ≥3 lower- and ≥3 upper-case letters, and switches lower→upper case at least twice.
 */
export function isGibberishWord(word: string) {
  if (!/^[A-Za-z]{10,}$/.test(word)) return false;
  // regular CamelCase compounds ("ToyotaLandCruiser", "McDonalds…") are fine
  if (/^[A-Za-z][a-z]+(?:[A-Z][a-z]{2,})+$/.test(word)) return false;
  const upper = word.replace(/[^A-Z]/g, "").length;
  const lower = word.replace(/[^a-z]/g, "").length;
  const switches = (word.match(/[a-z][A-Z]/g) ?? []).length;
  return upper >= 3 && lower >= 3 && switches >= 2;
}

export function hasGibberish(text: string | null | undefined) {
  return (text ?? "").split(/[\s,.;:!?()"'/\\-]+/).some(isGibberishWord);
}

export type SpamCheck = { spam: boolean; reason: string | null };

/** Minimum time (ms) a human needs between the form appearing and pressing "Send". */
export const MIN_FILL_MS = 2500;

/** Free Russian / Belarusian mailbox domains used by the "call-back" spam wave (shop sells only in LV / EE / LT). */
const RU_MAIL = /@(?:mail|internet|bk|list|inbox|yandex|ya|rambler|xmail)\.(?:ru|by)$|\.(?:ru|by)$/i;
const MESSENGER = /(мессендж|вацап|ватсап|воцап|whats\s?app|телеграм|telegram|вайбер|viber)/i;

/** Russian / Belarusian number (+7 / +375, or a bare 8 9xx… / 7 9xx… mobile written in Russian style). */
export function isRuPhone(phone: string | null | undefined) {
  const d = (phone ?? "").replace(/\D/g, "");
  return /^(?:7|8)9\d{9}$/.test(d) || /^375\d{9}$/.test(d);
}

/**
 * "Call-back" bait: a short message whose only content is "if you can't reach me, write to my WhatsApp/messenger 89…"
 * — no product, no question. Sent in waves from Russian numbers and mail.ru-type addresses.
 */
export function isCallbackBait(message: string | null | undefined, phone?: string | null) {
  const m = (message ?? "").trim();
  if (!m || m.length > 220 || !MESSENGER.test(m)) return false;
  const digits = m.match(/\+?\d[\d\s()-]{8,}\d/g) ?? [];
  if (!digits.length) return false;
  const rest = m.replace(/\+?\d[\d\s()-]{8,}\d/g, "").replace(/[^\p{L}]+/gu, " ").trim().split(/\s+/).length;
  return rest <= 20 && (isRuPhone(phone) || digits.some((x) => isRuPhone(x)));
}

export const SPAM_REASON_LABEL: Record<string, string> = {
  gibberish: "Nejēdzīgs teksts (bots)",
  too_fast: "Forma aizpildīta pārāk ātri (bots)",
  callback_bait: "„Uzrakstiet man WhatsApp” ziņa no Krievijas numura",
  ru_sender: "Krievijas numurs un .ru e-pasts (uz Krieviju netirgojam)",
  blocked_sender: "Sūtītājs jau iepriekš atzīmēts kā surogātpasts",
  duplicate: "Tāds pats ziņojums no tā paša sūtītāja jau saņemts",
  bot: "Bots (slēptais lauks vai ātrums)",
  manual: "Atzīmēts manuāli",
};

export function checkInquirySpam(input: {
  name?: string | null;
  message?: string | null;
  company?: string | null;
  extraText?: string | null;
  elapsedMs?: number | null;
  phone?: string | null;
  email?: string | null;
}): SpamCheck {
  if (input.elapsedMs != null && input.elapsedMs >= 0 && input.elapsedMs < MIN_FILL_MS) return { spam: true, reason: "too_fast" };
  if (hasGibberish(input.name) || hasGibberish(input.message) || hasGibberish(input.company) || hasGibberish(input.extraText)) {
    return { spam: true, reason: "gibberish" };
  }
  if (isCallbackBait(input.message, input.phone)) return { spam: true, reason: "callback_bait" };
  if (isRuPhone(input.phone) && RU_MAIL.test((input.email ?? "").trim())) return { spam: true, reason: "ru_sender" };
  return { spam: false, reason: null };
}
