// Local leaderboards + per-game difficulty for the research mini-games.
// Lives in its own localStorage key (core/save.ts stays untouched). Every access is
// guarded: storage can be unavailable and the games must still run.

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];
export const DIFF_LABEL: Record<Difficulty, string> = { easy: "Easy", normal: "Normal", hard: "Hard" };
export const DIFF_ICON: Record<Difficulty, string> = { easy: "🌱", normal: "⚖️", hard: "🔥" };

export interface LbEntry {
  /** Sort key (seconds, or a composite score). */
  score: number;
  /** What the board shows, e.g. "1:23.4". */
  text: string;
  /** Secondary detail, e.g. "seed #412" or "3 questions". */
  note?: string;
  /** Epoch ms; doubles as the entry id. */
  at: number;
}

interface Store {
  v: 1;
  boards: Record<string, LbEntry[]>;
  diff: Record<string, Difficulty>;
}

const KEY = "xu-town-3d:minigames:v1";
const MAX = 5;

let cache: Store | null = null;

function load(): Store {
  if (cache) return cache;
  let s: Store = { v: 1, boards: {}, diff: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Store>;
      s = { v: 1, boards: parsed.boards ?? {}, diff: parsed.diff ?? {} };
    }
  } catch {
    /* storage unavailable or corrupt */
  }
  cache = s;
  return s;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(load()));
  } catch {
    /* storage unavailable */
  }
}

export function getDifficulty(gameId: string): Difficulty {
  const d = load().diff[gameId];
  return d && DIFFICULTIES.includes(d) ? d : "normal";
}

export function setDifficulty(gameId: string, d: Difficulty) {
  load().diff[gameId] = d;
  persist();
}

/** Board id for a game (and optional variant such as a difficulty). */
export function boardKey(gameId: string, variant?: string) {
  return variant ? `${gameId}:${variant}` : gameId;
}

export function topEntries(key: string): LbEntry[] {
  return [...(load().boards[key] ?? [])];
}

export interface SubmitResult {
  /** 0-based rank on the board, or -1 if it did not make the top 5. */
  rank: number;
  /** Strictly better than every previous entry (or the first entry). */
  best: boolean;
  entry: LbEntry;
}

export function submitScore(key: string, e: Omit<LbEntry, "at">, lowerIsBetter = true): SubmitResult {
  const store = load();
  const list = store.boards[key] ?? [];
  const entry: LbEntry = { ...e, at: Date.now() };
  const better = (a: number, b: number) => (lowerIsBetter ? a < b : a > b);
  // Insert after entries that are as good or better (ties keep the older entry first).
  let i = 0;
  while (i < list.length && !better(entry.score, list[i].score)) i++;
  const next = [...list.slice(0, i), entry, ...list.slice(i)].slice(0, MAX);
  store.boards[key] = next;
  persist();
  const rank = next.indexOf(entry);
  return { rank, best: rank === 0, entry };
}
