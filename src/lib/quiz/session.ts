import { makeRng, shuffle, type Rng } from "./random";
import type { Question, QuestionType } from "./types";

export const SESSION_MIN = 8;
export const SESSION_MAX = 12;

/** Never three of the same type in a row. */
const MAX_RUN = 2;

/**
 * Rough difficulty, used only to shape the running order.
 *
 * Recognising a face on the floor is easier than reproducing a position from memory,
 * so a pass target opens and a spot sits in the middle.
 */
const DIFFICULTY: Record<QuestionType, number> = {
  identify: 1,
  "pass-target": 2,
  "next-action": 3,
  spot: 4,
  sequence: 5,
  draw: 6,
};

function difficulty(q: Question): number {
  return DIFFICULTY[q.type] ?? 3;
}

function groupBy<K>(items: Question[], key: (q: Question) => K): Map<K, Question[]> {
  const out = new Map<K, Question[]>();
  for (const q of items) {
    const k = key(q);
    const list = out.get(k) ?? [];
    list.push(q);
    out.set(k, list);
  }
  return out;
}

/** Take one from each queue in turn until `size` is reached or all are empty. */
function roundRobin(queues: Question[][], size: number): Question[] {
  const out: Question[] = [];
  while (out.length < size) {
    let took = false;
    for (const queue of queues) {
      if (out.length >= size) break;
      const next = queue.shift();
      if (next) {
        out.push(next);
        took = true;
      }
    }
    if (!took) break;
  }
  return out;
}

/**
 * Trim until "no three in a row" is actually achievable.
 *
 * With one type dominating, no ordering can satisfy the constraint: n of a type need
 * at least ceil(n/2) - 1 others to separate them. The seed is spot-heavy — five players
 * per beat against a handful of passes — so without this a session is simply a run of
 * spots and the ordering code quietly fails to fix it. Better a shorter session than
 * one that breaks its own rule.
 */
function trimToSeparable(selected: Question[]): Question[] {
  const out = [...selected];
  for (;;) {
    const counts = groupBy(out, (q) => q.type);
    let worstType: QuestionType | null = null;
    let worstCount = 0;
    for (const [type, list] of counts) {
      if (list.length > worstCount) {
        worstCount = list.length;
        worstType = type;
      }
    }
    if (!worstType) return out;

    const others = out.length - worstCount;
    // Each pair of same-type questions needs one separator between the pairs.
    const allowed = 2 * (others + 1);
    if (worstCount <= allowed) return out;

    const index = out.map((q) => q.type).lastIndexOf(worstType);
    if (index === -1) return out;
    out.splice(index, 1);
  }
}

/**
 * Open easy, hardest in the middle, end on a win.
 *
 * The last question being winnable is deliberate. A session that ends on the hardest
 * question ends on a miss for most players, and this is a product people have to come
 * back to tomorrow.
 */
function arc(questions: Question[]): Question[] {
  const byEasiest = [...questions].sort((a, b) => difficulty(a) - difficulty(b));
  const front: Question[] = [];
  const back: Question[] = [];

  byEasiest.forEach((q, i) => {
    if (i % 2 === 0) front.push(q);
    else back.unshift(q);
  });

  return [...front, ...back];
}

/**
 * Break up runs by swapping in the nearest later question of a different type.
 *
 * A swap rather than a re-sort, so the difficulty arc survives — the run is usually one
 * position out of place, not evidence the whole order is wrong.
 */
function breakRuns(ordered: Question[]): Question[] {
  const out = [...ordered];

  for (let i = MAX_RUN; i < out.length; i++) {
    const isRun = out
      .slice(i - MAX_RUN, i + 1)
      .every((q) => q.type === out[i].type);
    if (!isRun) continue;

    let swapped = false;
    for (let j = i + 1; j < out.length; j++) {
      if (out[j].type === out[i].type) continue;
      [out[i], out[j]] = [out[j], out[i]];
      swapped = true;
      break;
    }
    if (swapped) continue;

    // Nothing later differs — look backwards for a slot that stays legal.
    for (let j = i - MAX_RUN - 1; j >= 0; j--) {
      if (out[j].type === out[i].type) continue;
      [out[i], out[j]] = [out[j], out[i]];
      break;
    }
  }

  return out;
}

/**
 * Build a session from a pool of generated questions.
 *
 * Questions are pure data produced up front — nothing here calls an API, and nothing
 * here animates. The runner takes this list and renders it.
 */
export function buildSession(
  pool: Question[],
  options: { size?: number; seed?: number; rng?: Rng } = {},
): Question[] {
  if (!pool.length) return [];

  const rng = options.rng ?? makeRng(options.seed ?? 1);
  const size = Math.max(
    1,
    Math.min(options.size ?? SESSION_MAX, SESSION_MAX, pool.length),
  );

  const shuffled = shuffle(pool, rng);

  // Balance types first — a session of nothing but spots cannot be ordered legally.
  // Within a type, round-robin across plays so one play does not dominate either.
  const byType = groupBy(shuffled, (q) => q.type);
  const typeQueues = [...byType.values()].map((list) =>
    roundRobin(
      [...groupBy(list, (q) => q.playId).values()],
      list.length,
    ),
  );

  const selected = trimToSeparable(roundRobin(typeQueues, size));
  return breakRuns(arc(selected));
}

/** True when there are enough questions for a session worth starting. */
export function canStartSession(pool: Question[]): boolean {
  return pool.length >= SESSION_MIN;
}
