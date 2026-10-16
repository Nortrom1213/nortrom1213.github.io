// Small persistent state in localStorage. Every access is guarded: storage can be
// unavailable (private mode, blocked site data), and the game must still run.

export interface SaveState {
  muted: boolean;
  volume: number;
  quality: "auto" | "high" | "low";
  mouseMode: "immersive" | "drag";
  avatar: { preset: string; hair?: number; top?: number } | null;
  badges: string[];
  seenIntro: boolean;
  stats: Record<string, number>;
}

const KEY = "xu-town-3d:v1";

const DEFAULTS: SaveState = {
  muted: false,
  volume: 0.7,
  quality: "auto",
  mouseMode: "immersive",
  avatar: null,
  badges: [],
  seenIntro: false,
  stats: {},
};

let state: SaveState = load();

function load(): SaveState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveState>;
      const s = { ...DEFAULTS, ...p };
      if (!Array.isArray(s.badges)) s.badges = [];
      if (!s.stats || typeof s.stats !== "object") s.stats = {};
      if (typeof s.volume !== "number") s.volume = DEFAULTS.volume;
      if (!["auto", "high", "low"].includes(s.quality)) s.quality = "auto";
      if (s.mouseMode !== "drag") s.mouseMode = "immersive";
      return s;
    }
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULTS, badges: [], stats: {} };
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

export const save = {
  get(): Readonly<SaveState> {
    return state;
  },
  set<K extends keyof SaveState>(key: K, value: SaveState[K]) {
    state = { ...state, [key]: value };
    persist();
  },
  hasBadge(id: string) {
    return state.badges.includes(id);
  },
  /** Returns true when the badge is new. */
  addBadge(id: string): boolean {
    if (state.badges.includes(id)) return false;
    state = { ...state, badges: [...state.badges, id] };
    persist();
    return true;
  },
  bestStat(key: string, value: number, lowerIsBetter = true): boolean {
    const prev = state.stats[key];
    const better = prev === undefined || (lowerIsBetter ? value < prev : value > prev);
    if (better) {
      state = { ...state, stats: { ...state.stats, [key]: value } };
      persist();
    }
    return better;
  },
};
