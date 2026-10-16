// Tavern Whodunit puzzle logic: seeded generation, a tiny CSP solver over the five
// "who is the werewolf" hypotheses, and Expected-Target-Entropy style look-ahead.
//
// Model (after CSP4SDG): villagers always tell the truth, the single werewolf always
// lies. A hypothesis h ("suspect h is the werewolf") is consistent with a statement
// iff the statement's claim under h is true exactly when its speaker is not h.

export const N = 5;
export type LocId = "bar" | "hearth" | "window";
export const LOCS: LocId[] = ["bar", "hearth", "window"];
export const LOC_AT: Record<LocId, string> = { bar: "at the bar", hearth: "by the hearth", window: "at the window table" };
export const LOC_NAME: Record<LocId, string> = { bar: "Bar", hearth: "Hearth", window: "Window table" };
export const LOC_CAP: Record<LocId, number> = { bar: 3, hearth: 2, window: 2 };

export type Statement =
  | { kind: "not" | "is" | "together" | "lying" | "trust"; speaker: number; a: number }
  | { kind: "either"; speaker: number; a: number; b: number }
  | { kind: "seatIs" | "seatNot"; speaker: number; loc: LocId }
  | { kind: "mySpot"; speaker: number };

export interface Case {
  seed: number;
  culprit: number;
  seats: LocId[];
  statements: Statement[];
  /** A smallest set of statement indices that already pins down the culprit. */
  minimal: number[];
}

// ---- RNG -------------------------------------------------------------------------

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
function shuffle<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const others = (s: number, ...not: number[]) => [...Array(N).keys()].filter((i) => i !== s && !not.includes(i));

// ---- Semantics -------------------------------------------------------------------

/**
 * Truth of a statement's claim if `w` is the werewolf. Meta statements ("X is lying")
 * use role semantics: X lies iff X is the werewolf. For every hypothesis that survives
 * X's own constraint this equals the literal truth, so the consistent set is identical.
 */
export function claim(st: Statement, w: number, seats: LocId[]): boolean {
  switch (st.kind) {
    case "not":
      return w !== st.a;
    case "is":
      return w === st.a;
    case "either":
      return w === st.a || w === st.b;
    case "together":
      return w !== st.a && w !== st.speaker;
    case "lying":
      return w === st.a;
    case "trust":
      return w !== st.a;
    case "seatIs":
      return seats[w] === st.loc;
    case "seatNot":
      return seats[w] !== st.loc;
    case "mySpot":
      return seats[w] !== seats[st.speaker];
  }
}

/** Is hypothesis h compatible with this statement? */
export function consistent(st: Statement, h: number, seats: LocId[]) {
  return claim(st, h, seats) === (st.speaker !== h);
}

/** Hypotheses consistent with every given statement. */
export function candidates(stmts: Statement[], seats: LocId[]): number[] {
  return [...Array(N).keys()].filter((h) => stmts.every((s) => consistent(s, h, seats)));
}

/** The set of werewolves for which the claim would be true (for the assist gloss). */
export function trueWhen(st: Statement, seats: LocId[]): number[] {
  return [...Array(N).keys()].filter((w) => claim(st, w, seats));
}

/** Literal truth: meta statements are evaluated against their target's actual statement. */
function literal(st: Statement, w: number, all: Statement[], seats: LocId[]): boolean {
  if (st.kind === "lying" || st.kind === "trust") {
    const target = all[st.a];
    if (target.kind === "lying" || target.kind === "trust") throw new Error("meta statement targets a meta statement");
    const t = claim(target, w, seats);
    return st.kind === "lying" ? !t : t;
  }
  return claim(st, w, seats);
}

// ---- Generation ------------------------------------------------------------------

const BASIC_WEIGHTS: [Statement["kind"], number][] = [
  ["not", 3],
  ["either", 3],
  ["together", 2],
  ["seatIs", 1.4],
  ["seatNot", 1.4],
  ["mySpot", 1],
  ["is", 0.6],
];

/**
 * How hard a generated case is: how often regulars make meta statements ("X is lying"),
 * how the basic statement kinds are weighted, and how many testimonies the shortest
 * proof must need.
 */
export interface Complexity {
  /** Chance a regular speaks about another's testimony. */
  meta: number;
  /** Basic statement weights (defaults to BASIC_WEIGHTS). */
  weights?: [Statement["kind"], number][];
  /** Accept a case once its minimal proof uses at least this many statements. */
  minSteps: number;
  /** Late in the search, settle for a proof of at least this length. */
  fallbackSteps: number;
  /** Allow rare two-step puzzles built on a blunt / meta claim. */
  spicy: boolean;
}

export const DEFAULT_COMPLEXITY: Complexity = { meta: 0.22, minSteps: 3, fallbackSteps: 2, spicy: true };

function weighted(rng: Rng, weights: [Statement["kind"], number][] = BASIC_WEIGHTS): Statement["kind"] {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of weights) if ((r -= w) <= 0) return k;
  return "not";
}

function randomBasic(rng: Rng, s: number, seats: LocId[], weights?: [Statement["kind"], number][]): Statement {
  const kind = weighted(rng, weights);
  switch (kind) {
    case "either": {
      const [a, b] = shuffle(rng, others(s));
      return { kind, speaker: s, a, b };
    }
    case "seatIs":
    case "seatNot":
      return { kind, speaker: s, loc: pick(rng, [...new Set(seats)]) };
    case "mySpot":
      return { kind, speaker: s };
    default:
      return { kind: kind as "not", speaker: s, a: pick(rng, others(s)) };
  }
}

/** A statement for speaker s that is true iff s is a villager (given culprit w). */
export function genStatement(rng: Rng, s: number, w: number, seats: LocId[], metaTargets: number[] | null, weights?: [Statement["kind"], number][]): Statement {
  const honest = s !== w;
  const targets = metaTargets?.filter((t) => t !== s) ?? [];
  if (targets.length) {
    const a = pick(rng, targets);
    // Villager: "a is lying" iff a is the wolf. Werewolf: must lie, so only "a is lying".
    if (!honest || a === w) return { kind: "lying", speaker: s, a };
    return { kind: "trust", speaker: s, a };
  }
  for (let i = 0; i < 60; i++) {
    const st = randomBasic(rng, s, seats, weights);
    if (claim(st, w, seats) === honest) return st;
  }
  return honest ? { kind: "not", speaker: s, a: pick(rng, others(s, w)) } : { kind: "is", speaker: s, a: pick(rng, others(s)) };
}

function assignSeats(rng: Rng): LocId[] {
  const patterns: [number, number, number][] = [[3, 1, 1], [2, 2, 1], [2, 1, 2], [1, 2, 2]];
  const [b, h, wi] = pick(rng, patterns);
  const slots: LocId[] = [...Array(b).fill("bar"), ...Array(h).fill("hearth"), ...Array(wi).fill("window")];
  return shuffle(rng, slots);
}

const popcount = (m: number) => m.toString(2).replace(/0/g, "").length;

/** Smallest subset of statements with a unique consistent hypothesis. */
export function minimalSubset(stmts: Statement[], seats: LocId[]): number[] | null {
  const masks = [...Array(1 << stmts.length).keys()].slice(1).sort((x, y) => popcount(x) - popcount(y));
  for (const m of masks) {
    const idx = stmts.map((_, i) => i).filter((i) => m & (1 << i));
    if (candidates(idx.map((i) => stmts[i]), seats).length === 1) return idx;
  }
  return null;
}

/** Generate a case with exactly one consistent hypothesis. Deterministic per seed. */
export function generateCase(seed: number, cx: Complexity = DEFAULT_COMPLEXITY): Case {
  const rng = mulberry32(seed);
  let fallback: Case | null = null;
  for (let attempt = 0; attempt < 800; attempt++) {
    const seats = assignSeats(rng);
    const culprit = Math.floor(rng() * N);
    const meta = [...Array(N).keys()].map(() => rng() < cx.meta);
    const basicSpeakers = () => [...Array(N).keys()].filter((i) => !meta[i]);
    for (let s = 0; s < N; s++) if (meta[s] && basicSpeakers().filter((b) => b !== s).length === 0) meta[s] = false;
    const stmts: Statement[] = new Array(N);
    for (let s = 0; s < N; s++) if (!meta[s]) stmts[s] = genStatement(rng, s, culprit, seats, null, cx.weights);
    for (let s = 0; s < N; s++) if (meta[s]) stmts[s] = genStatement(rng, s, culprit, seats, basicSpeakers(), cx.weights);

    // CSP: exactly one hypothesis must survive all five constraints.
    const cands = candidates(stmts, seats);
    if (cands.length !== 1 || cands[0] !== culprit) continue;
    // Validate literal truth values: villagers true, werewolf false.
    if (!stmts.every((st) => literal(st, culprit, stmts, seats) === (st.speaker !== culprit))) continue;
    const minimal = minimalSubset(stmts, seats);
    if (!minimal) continue;
    const c: Case = { seed, culprit, seats, statements: stmts, minimal };
    // Quality: prefer puzzles that need at least three testimonies and few blunt accusations.
    // Meta / blunt claims ("X is lying", "X is the werewolf") narrow things to two
    // suspects at once, so they are allowed in some two-step puzzles for variety.
    const blunt = stmts.filter((s) => s.kind === "is").length;
    const spicy = stmts.some((s) => s.kind === "lying" || s.kind === "is");
    if (blunt <= 1 && (minimal.length >= cx.minSteps || (cx.spicy && spicy && minimal.length === 2 && rng() < 0.06))) return c;
    if (!fallback || minimal.length > fallback.minimal.length) fallback = c;
    if (attempt > 500 && fallback.minimal.length >= cx.fallbackSteps) return fallback;
  }
  if (fallback) return fallback;
  throw new Error("could not generate a unique whodunit");
}

// ---- Information theory ----------------------------------------------------------

export const bits = (n: number) => (n > 0 ? Math.log2(n) : 0);

/**
 * Expected remaining entropy (bits) about the werewolf's identity after interviewing
 * `j`, averaging over the surviving hypotheses (uniform) and over what j would say
 * under each one (sampled from the generator's statement model).
 */
export function expectedEntropyAfter(j: number, cands: number[], seats: LocId[], seed: number, samples = 24, metaRate = 0.22): number {
  if (cands.length <= 1) return 0;
  const rng = mulberry32((seed ^ (j * 0x9e3779b1) ^ (cands.reduce((m, h) => m | (1 << h), 0) << 20)) >>> 0);
  let total = 0;
  let n = 0;
  for (const h of cands) {
    for (let k = 0; k < samples; k++) {
      const metaTargets = rng() < metaRate ? others(j) : null;
      const st = genStatement(rng, j, h, seats, metaTargets);
      total += bits(cands.filter((h2) => consistent(st, h2, seats)).length);
      n++;
    }
  }
  return total / n;
}
