/**
 * Seeded RNG, so a session is reproducible.
 *
 * Question generation is pure data produced before a session starts. Making it
 * deterministic means a test can assert which distractors were picked, and a coach
 * reporting "question 4 was wrong" can have that exact question regenerated.
 */
export type Rng = () => number;

/** mulberry32 — small, fast, good enough for shuffling four options. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable numeric seed from a string, so a play id always yields the same session. */
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fisher-Yates. Returns a new array; the input is untouched. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pick<T>(items: T[], rng: Rng): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(rng() * items.length)];
}
