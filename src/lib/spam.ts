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

export function checkInquirySpam(input: {
  name?: string | null;
  message?: string | null;
  company?: string | null;
  extraText?: string | null;
  elapsedMs?: number | null;
}): SpamCheck {
  if (input.elapsedMs != null && input.elapsedMs >= 0 && input.elapsedMs < MIN_FILL_MS) return { spam: true, reason: "too_fast" };
  if (hasGibberish(input.name) || hasGibberish(input.message) || hasGibberish(input.company) || hasGibberish(input.extraText)) {
    return { spam: true, reason: "gibberish" };
  }
  return { spam: false, reason: null };
}
