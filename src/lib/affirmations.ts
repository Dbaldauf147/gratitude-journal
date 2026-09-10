/**
 * The daily affirmation pool and the rule for choosing today's line.
 *
 * Lived in dashboard/page.tsx until the card got stuck showing one user the
 * same affirmation ten evenings running. The picker is here so the rotation
 * rule is testable on its own, away from the component that renders it.
 */

export const DEFAULT_AFFIRMATIONS = [
  "I am worthy of love, happiness, and fulfillment.",
  "I choose to focus on what I can control and let go of the rest.",
  "I am growing stronger and more resilient every day.",
  "I am grateful for the abundance that flows into my life.",
  "I trust the timing of my journey.",
  "I am enough, just as I am.",
  "I attract positivity and release negativity.",
  "My challenges are opportunities for growth.",
  "I am surrounded by love and support.",
  "I choose peace over worry.",
  "I am capable of achieving anything I set my mind to.",
  "I honor my body and treat it with kindness.",
  "Every day is a fresh start full of possibilities.",
  "I radiate confidence, warmth, and compassion.",
  "I am deserving of rest and self-care.",
  "I celebrate my progress, no matter how small.",
  "I release comparison and embrace my unique path.",
  "I am a positive force in the lives of those around me.",
  "My potential is limitless.",
  "I welcome joy into every moment of today.",
];

// Stable index for a given day, so a refresh doesn't reshuffle the card.
// Mirrors hashDay in popularQuotes.ts.
function hash(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export interface AffirmationHistory {
  /** Every text this user has already been shown, kept or removed. */
  seen: Set<string>;
  /** Texts whose standing verdict is "Keep in Rotation". */
  approved: string[];
  /** Texts whose standing verdict is "Remove". */
  dismissed: Set<string>;
  /** The text shown most recently, so today can avoid landing on it again. */
  lastShown?: string;
}

/**
 * Today's affirmation.
 *
 * Unseen lines come first, so the whole catalogue gets walked before anything
 * is offered twice — the old rule indexed into the pool by day-of-year alone,
 * which happily re-offered yesterday's line and, when the pool shrank, could
 * sit on one line indefinitely. Once everything has been ruled on, the kept
 * ones cycle; if none were kept, the catalogue restarts rather than the card
 * disappearing.
 *
 * `seed` is mixed into the day hash so two people on the same day get
 * different lines.
 */
export function pickAffirmation(
  dayKey: string,
  seed: string,
  history: AffirmationHistory
): string | null {
  const { seen, approved, dismissed, lastShown } = history;

  // Approving adds to the catalogue; it must never *become* the catalogue.
  const catalogue = Array.from(new Set([...DEFAULT_AFFIRMATIONS, ...approved]))
    .filter((t) => !dismissed.has(t));

  const unseen = catalogue.filter((t) => !seen.has(t));
  const kept = approved.filter((t) => !dismissed.has(t));

  const pool =
    unseen.length > 0 ? unseen
    : kept.length > 0 ? kept
    : catalogue.length > 0 ? catalogue
    : DEFAULT_AFFIRMATIONS;

  if (pool.length === 0) return null;

  let pick = pool[hash(`${dayKey}|${seed}`) % pool.length];
  // The hash is uniform, not sequential, so consecutive days can collide.
  if (pick === lastShown && pool.length > 1) {
    pick = pool[(hash(`${dayKey}|${seed}`) + 1) % pool.length];
  }
  return pick;
}
