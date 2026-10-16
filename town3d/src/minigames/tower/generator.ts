// PCG Tower generator: experience graph -> spatial realisation -> local validation.
//
// Loosely follows "From Experience to 3D Platformer Levels via Topological Graphs"
// (AIIDE 2026): first sample a sequence of experience beats, then realise each beat
// platform by platform, checking every consecutive pair with a local validator that
// uses the real controller physics, and re-sampling candidates that fail.

// ---- Controller physics (mirrors src/core/physics.ts and src/core/game.ts) ----------

export const PHYS = {
  gravity: 26,
  jumpSpeed: 9.2,
  walk: 4.6,
  run: 7.2,
  bodyHeight: 1.5,
};

/** Apex of a standing jump: v0^2 / 2g = 1.628 m. */
export const JUMP_APEX = (PHYS.jumpSpeed * PHYS.jumpSpeed) / (2 * PHYS.gravity);
/** Highest rise we ever ask for (apex minus a 0.33 m margin). */
export const MAX_RISE = 1.3;
/** Fraction of the ideal ballistic reach we allow (players never jump perfectly). */
export const REACH_SAFETY = 0.78;
/** Smallest edge-to-edge gap between consecutive platforms. */
export const MIN_GAP = 0.3;
/** Deepest drop between consecutive platforms. */
export const MAX_DROP = 2.2;
/** Vertical room a jump needs above a platform top: apex + body + margin. */
export const HEADROOM = JUMP_APEX + PHYS.bodyHeight + 0.3;

export const PILLAR_R = 3;
const BOUNDS_R = 24;

/** Time from take-off until the body comes back down through height dh (s). */
export function airTime(dh: number): number {
  const v0 = PHYS.jumpSpeed;
  const disc = v0 * v0 - 2 * PHYS.gravity * dh;
  if (disc < 0) return 0;
  return (v0 + Math.sqrt(disc)) / PHYS.gravity;
}

/** Largest edge-to-edge gap we accept for a height change dh at a given run-up speed. */
export function maxGap(dh: number, speed: number): number {
  if (dh > MAX_RISE) return 0;
  return speed * airTime(dh) * REACH_SAFETY;
}

// ---- Seeded PRNG ----------------------------------------------------------------------

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

// ---- Experience graph -------------------------------------------------------------------

export type BeatKind = "start" | "rest" | "gap" | "climb" | "narrow" | "zigzag" | "stairs" | "reward" | "checkpoint" | "summit";

export const BEAT_INFO: Record<BeatKind, { label: string; short: string; color: number }> = {
  start: { label: "Start", short: "S", color: 0x7cc06a },
  rest: { label: "Rest", short: "R", color: 0x94d070 },
  gap: { label: "Gap", short: "G", color: 0xe6a65a },
  climb: { label: "Climb", short: "C", color: 0x8aa8d0 },
  narrow: { label: "Narrow", short: "N", color: 0xd4866a },
  zigzag: { label: "Zig-zag", short: "Z", color: 0xb79ad8 },
  stairs: { label: "Stairs", short: "T", color: 0xd9c47a },
  reward: { label: "Reward", short: "★", color: 0xf4cf3c },
  checkpoint: { label: "Checkpoint", short: "⚑", color: 0x56b8a8 },
  summit: { label: "Summit", short: "▲", color: 0xf07868 },
};

export const CHALLENGES: BeatKind[] = ["gap", "climb", "narrow", "zigzag", "stairs"];

export interface Beat {
  kind: BeatKind;
  /** Platform index range [from, to). */
  from: number;
  to: number;
}

export interface Platform {
  cx: number;
  cz: number;
  sx: number;
  sz: number;
  top: number;
  /** Physics body thickness below the top. */
  thick: number;
  /** Visual rock cone below the body. */
  under: number;
  beat: number;
  kind: BeatKind;
}

export interface Coin {
  x: number;
  y: number;
  z: number;
}

export interface TowerParams {
  seed: number;
  /** 1..5 */
  difficulty: number;
  /** 1..5 */
  length: number;
}

export interface Level {
  params: TowerParams;
  beats: Beat[];
  platforms: Platform[];
  coins: Coin[];
  checkpoints: number[];
  summit: number;
  /** Candidates the validator rejected and re-sampled. */
  rejected: number;
  /** Times a beat backtracked to re-sample an earlier step. */
  backtracks: number;
  /** Placements that exhausted re-sampling and backtracking (should stay ~0). */
  forced: number;
  /** Platform indices that were force-placed. */
  forcedAt: number[];
  /** Why candidates were rejected, by validator rule. */
  reasons: Record<string, number>;
  /** Design run-up speed: walk on easy towers, run on hard ones. */
  runRequired: boolean;
  lowest: number;
  height: number;
}

/** Sample the experience graph: a beat sequence shaped by difficulty and length. */
export function sampleBeats(p: TowerParams, rnd: () => number): BeatKind[] {
  const t = (p.difficulty - 1) / 4;
  const segments = 2 + p.length;
  const out: BeatKind[] = ["start"];
  let last: BeatKind = "start";
  for (let s = 0; s < segments; s++) {
    // Challenge density grows with difficulty: 1..4 challenge beats per segment.
    const k = 1 + Math.floor(rnd() * (1.6 + 2.4 * t));
    for (let i = 0; i < k; i++) {
      let c: BeatKind;
      do c = CHALLENGES[Math.floor(rnd() * CHALLENGES.length)];
      while (c === last && rnd() < 0.8);
      // Early towers lean on gentle beats.
      if (t < 0.3 && c === "narrow" && rnd() < 0.5) c = "stairs";
      out.push(c);
      last = c;
    }
    out.push("reward");
    if (s === segments - 1) break;
    // Hard towers checkpoint every other segment.
    const checkpoint = p.difficulty <= 3 || s % 2 === 1;
    out.push(checkpoint ? "checkpoint" : "rest");
    last = "rest";
  }
  out.push("summit");
  return out;
}

// ---- Geometry helpers -----------------------------------------------------------------

interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function rectOf(p: { cx: number; cz: number; sx: number; sz: number }, grow = 0): Rect {
  return { minX: p.cx - p.sx / 2 - grow, maxX: p.cx + p.sx / 2 + grow, minZ: p.cz - p.sz / 2 - grow, maxZ: p.cz + p.sz / 2 + grow };
}

/** Edge-to-edge distance between two axis-aligned platform footprints. */
export function rectGap(a: Platform | Candidate, b: Platform | Candidate): number {
  const dx = Math.max(0, Math.abs(a.cx - b.cx) - (a.sx + b.sx) / 2);
  const dz = Math.max(0, Math.abs(a.cz - b.cz) - (a.sz + b.sz) / 2);
  return Math.hypot(dx, dz);
}

function pointRectDist(x: number, z: number, r: Rect) {
  const dx = Math.max(r.minX - x, 0, x - r.maxX);
  const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
  return Math.hypot(dx, dz);
}

function segRectDist(ax: number, az: number, bx: number, bz: number, r: Rect) {
  let best = Infinity;
  for (let i = 0; i <= 12; i++) {
    const s = i / 12;
    best = Math.min(best, pointRectDist(ax + (bx - ax) * s, az + (bz - az) * s, r));
  }
  return best;
}

function segPointDist(ax: number, az: number, bx: number, bz: number, px: number, pz: number) {
  const vx = bx - ax;
  const vz = bz - az;
  const l2 = vx * vx + vz * vz || 1e-6;
  const s = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2));
  return Math.hypot(ax + vx * s - px, az + vz * s - pz);
}

/** Jump corridor between two consecutive platforms (centre to centre, conservative). */
interface Corridor {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  y0: number;
  y1: number;
  a: number;
  b: number;
}

const CORRIDOR_R = 0.6;

function corridorOf(a: Platform | Candidate, b: Platform | Candidate, ia: number, ib: number): Corridor {
  return {
    ax: a.cx,
    az: a.cz,
    bx: b.cx,
    bz: b.cz,
    y0: Math.min(a.top, b.top) - 0.1,
    y1: Math.max(a.top, b.top) + JUMP_APEX + PHYS.bodyHeight + 0.15,
    a: ia,
    b: ib,
  };
}

type Candidate = Omit<Platform, "beat" | "kind">;

/** Bottom of the solid body (what the controller collides with). */
function bodyBottom(p: Candidate) {
  return p.top - p.thick;
}

/** Tip of the decorative rock cone. */
function visualBottom(p: Candidate) {
  return p.top - p.thick - p.under;
}

/** Visual cones may hang over a platform, but above head height. */
const CONE_CLEAR = PHYS.bodyHeight + 0.45;

// ---- Local validator ------------------------------------------------------------------

export interface Verdict {
  ok: boolean;
  reason?: string;
}

/**
 * Validate placing `c` after `prev` (index prevIdx) given everything placed so far.
 * 1. Reachability against the controller: rise <= MAX_RISE, drop <= MAX_DROP and the
 *    edge-to-edge gap within the ballistic reach for that rise at the design speed.
 * 2. Clearance: the new jump corridor is not blocked by any other platform, the new
 *    platform blocks no earlier corridor, and stacked platforms keep a full jump of
 *    headroom. 3. Stays off the central pillar and inside the arena.
 */
export function validate(prev: Platform, prevIdx: number, c: Candidate, placed: Platform[], corridors: Corridor[], speed: number): Verdict {
  const dh = c.top - prev.top;
  const gap = rectGap(prev, c);
  if (dh > MAX_RISE) return { ok: false, reason: "too high" };
  if (dh < -MAX_DROP) return { ok: false, reason: "too deep" };
  if (gap < MIN_GAP) return { ok: false, reason: "overlap" };
  if (gap > maxGap(dh, speed)) return { ok: false, reason: "too far" };

  const rc = rectOf(c);
  if (pointRectDist(0, 0, rc) < PILLAR_R + 0.5) return { ok: false, reason: "pillar" };
  if (Math.hypot(c.cx, c.cz) + Math.max(c.sx, c.sz) / 2 > BOUNDS_R) return { ok: false, reason: "bounds" };
  const own = corridorOf(prev, c, prevIdx, placed.length);
  if (segPointDist(own.ax, own.az, own.bx, own.bz, 0, 0) < PILLAR_R + 0.45) return { ok: false, reason: "pillar arc" };

  const cBottom = bodyBottom(c);
  const cTip = visualBottom(c);
  for (let i = 0; i < placed.length; i++) {
    const q = placed[i];
    const qBottom = bodyBottom(q);
    // Stacked footprints need a full jump of headroom between them.
    const rq = rectOf(q, 0.5);
    const overlapXZ = rc.minX < rq.maxX && rc.maxX > rq.minX && rc.minZ < rq.maxZ && rc.maxZ > rq.minZ;
    if (overlapXZ && i !== prevIdx) {
      const above = q.top + HEADROOM <= cBottom && q.top + CONE_CLEAR <= cTip;
      const below = c.top + HEADROOM <= qBottom && c.top + CONE_CLEAR <= visualBottom(q);
      if (!above && !below) return { ok: false, reason: "headroom" };
    }
    // The new corridor must not pass through another platform.
    if (i !== prevIdx && own.y1 > visualBottom(q) && own.y0 < q.top) {
      if (segRectDist(own.ax, own.az, own.bx, own.bz, rectOf(q)) < CORRIDOR_R) return { ok: false, reason: "arc blocked" };
    }
  }
  // The new platform must not sit inside an earlier jump arc.
  for (const k of corridors) {
    if (k.y1 > cTip && k.y0 < c.top) {
      if (segRectDist(k.ax, k.az, k.bx, k.bz, rc) < CORRIDOR_R) return { ok: false, reason: "blocks arc" };
    }
  }
  return { ok: true };
}

// ---- Spatial realisation --------------------------------------------------------------

interface StepSpec {
  size: [number, number];
  dh: [number, number];
  /** Gap as a fraction of the validator's maximum for the sampled rise. */
  gapFrac: [number, number];
  turn: number;
  thick?: number;
}

function stepsFor(kind: BeatKind, t: number, rnd: () => number): StepSpec[] {
  const lo = 0.28 + 0.3 * t;
  const hi = 0.5 + 0.45 * t;
  const big = 3.4 - 1.5 * t;
  const rep = (n: number, s: StepSpec) => Array.from({ length: n }, () => ({ ...s }));
  switch (kind) {
    case "gap":
      return [{ size: [big * 0.85, big * 1.1], dh: [-0.6, 0.6], gapFrac: [lo + 0.1, hi + 0.04], turn: 0 }];
    case "climb":
      return rep(2 + Math.floor(rnd() * 2), { size: [1.7, 2.6 - 0.4 * t], dh: [0.8, 1.0 + 0.3 * t], gapFrac: [0.25, 0.35 + 0.4 * t], turn: 0 });
    case "narrow":
      return rep(3, { size: [1.6 - 0.6 * t, 1.9 - 0.6 * t], dh: [-0.3, 0.4], gapFrac: [lo * 0.8, hi * 0.85], turn: 0.15 });
    case "zigzag":
      return rep(4, { size: [1.7 - 0.3 * t, 2.4 - 0.4 * t], dh: [0, 0.55], gapFrac: [lo, hi * 0.9], turn: 0.75 });
    case "stairs":
      return rep(4 + Math.floor(rnd() * 2), { size: [1.5, 2.0], dh: [0.3, 0.5], gapFrac: [0.12, 0.25 + 0.15 * t], turn: 0.05, thick: 0.5 });
    case "reward":
      return [{ size: [2.2, 2.6], dh: [-0.2, 0.5], gapFrac: [lo, hi * 0.8], turn: 0 }];
    case "rest":
    case "checkpoint":
      return [{ size: [3.4, 4.0], dh: [0, 0.6], gapFrac: [0.25, 0.4], turn: 0 }];
    case "summit":
      return [{ size: [4.6, 5.0], dh: [0.3, 0.9], gapFrac: [0.25, 0.4], turn: 0 }];
    case "start":
      return [];
  }
}

const lerp = (a: number, b: number, s: number) => a + (b - a) * s;

/** Centre of a platform of size (sx, sz) placed along `dir` from `from` with the given edge gap. */
function placeAlong(from: Platform, dx: number, dz: number, sx: number, sz: number, gap: number) {
  const probe = { cx: 0, cz: 0, sx, sz, top: 0, thick: 0, under: 0 };
  let lo = 0;
  let hi = 40;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    probe.cx = from.cx + dx * m;
    probe.cz = from.cz + dz * m;
    if (rectGap(from, probe) < gap) lo = m;
    else hi = m;
  }
  return { cx: from.cx + dx * hi, cz: from.cz + dz * hi };
}

export const START_ISLAND = { cx: 0, cz: 11, sx: 8.5, sz: 7 };

export function generate(params: TowerParams): Level {
  const rnd = mulberry32(params.seed * 7919 + params.difficulty * 104729 + params.length * 1299709);
  const t = (params.difficulty - 1) / 4;
  const runRequired = params.difficulty >= 4;
  const speed = runRequired ? PHYS.run : PHYS.walk;
  const kinds = sampleBeats(params, rnd);

  const platforms: Platform[] = [];
  const corridors: Corridor[] = [];
  const beats: Beat[] = [];
  const coins: Coin[] = [];
  const checkpoints: number[] = [0];
  let rejected = 0;
  let forced = 0;
  const forcedAt: number[] = [];
  const reasons: Record<string, number> = {};
  let zig = rnd() < 0.5 ? 1 : -1;
  // Each tower winds either way round the pillar.
  const spin = rnd() < 0.5 ? 1 : -1;
  /** Angle swept round the pillar at each platform (alternates radius bands per turn). */
  const swept: number[] = [0];
  let backtracks = 0;

  platforms.push({ ...START_ISLAND, top: 0, thick: 1.2, under: 4.2, beat: 0, kind: "start" });
  beats.push({ kind: "start", from: 0, to: 1 });

  /** Sample candidates for one step until the validator accepts one. */
  const tryPlace = (spec: StepSpec): Candidate | null => {
    const prevIdx = platforms.length - 1;
    const prev = platforms[prevIdx];
    const alpha = Math.atan2(prev.cz, prev.cx);
    const r = Math.hypot(prev.cx, prev.cz);
    // Odd turns run on an outer band so consecutive turns never stack tightly.
    const band = Math.floor(swept[prevIdx] / (Math.PI * 2)) % 2 === 0 ? 9 : 14;
    if (spec.turn > 0.5) zig = -zig;
    for (let attempt = 0; attempt < 60; attempt++) {
      const relax = attempt >= 40;
      const spread = 0.3 + attempt * 0.04;
      const size = lerp(spec.size[0], spec.size[1], rnd());
      const sx = size * lerp(0.85, 1.15, rnd());
      const sz = size * lerp(0.85, 1.15, rnd());
      // Late attempts climb out of trouble with a modest, short hop.
      const dh = relax ? lerp(0.5, 1.0, rnd()) : lerp(spec.dh[0], spec.dh[1], rnd());
      const reach = maxGap(dh, speed);
      const frac = relax ? lerp(0.2, 0.4, rnd()) : lerp(spec.gapFrac[0], spec.gapFrac[1], rnd());
      const gap = Math.max(MIN_GAP + 0.05, reach * frac);
      // Wind round the pillar, pulled towards this turn's radius band.
      const radial = Math.max(-0.7, Math.min(0.7, (band - r) * 0.18));
      const jitter = (rnd() * 2 - 1) * spread + zig * spec.turn;
      let dx = -Math.sin(alpha) * spin + Math.cos(alpha) * radial;
      let dz = Math.cos(alpha) * spin + Math.sin(alpha) * radial;
      const ca = Math.cos(jitter);
      const sa = Math.sin(jitter);
      [dx, dz] = [dx * ca - dz * sa, dx * sa + dz * ca];
      const len = Math.hypot(dx, dz);
      const pos = placeAlong(prev, dx / len, dz / len, sx, sz, gap);
      const c: Candidate = {
        cx: pos.cx,
        cz: pos.cz,
        sx,
        sz,
        top: prev.top + dh,
        thick: spec.thick ?? 0.7 + rnd() * 0.3,
        under: Math.min(1.5, Math.min(sx, sz) * lerp(0.35, 0.6, rnd())),
      };
      const verdict = validate(prev, prevIdx, c, platforms, corridors, speed);
      if (verdict.ok) return c;
      rejected++;
      reasons[verdict.reason!] = (reasons[verdict.reason!] ?? 0) + 1;
    }
    return null;
  };

  const push = (c: Candidate, kind: BeatKind) => {
    const prevIdx = platforms.length - 1;
    const prev = platforms[prevIdx];
    const placed: Platform = { ...c, beat: beats.length, kind };
    let da = Math.atan2(placed.cz, placed.cx) - Math.atan2(prev.cz, prev.cx);
    da = Math.atan2(Math.sin(da), Math.cos(da));
    swept.push(swept[prevIdx] + Math.max(0, da * spin));
    corridors.push(corridorOf(prev, placed, prevIdx, platforms.length));
    platforms.push(placed);
  };

  for (let b = 1; b < kinds.length; b++) {
    const kind = kinds[b];
    const from = platforms.length;
    const specs = stepsFor(kind, t, rnd);
    let si = 0;
    let budget = 8;
    while (si < specs.length) {
      const c = tryPlace(specs[si]);
      if (c) {
        push(c, kind);
        si++;
      } else if (si > 0 && budget > 0) {
        // Backtrack: re-sample the previous step of this beat.
        budget--;
        backtracks++;
        platforms.pop();
        corridors.pop();
        swept.pop();
        si--;
      } else {
        // Out of options: sweep short, steep hops in every direction; force one only if none validates.
        const prevIdx = platforms.length - 1;
        const prev = platforms[prevIdx];
        const alpha = Math.atan2(prev.cz, prev.cx);
        let pick: Candidate | null = null;
        let first: Candidate | null = null;
        for (let k = 0; k < 24 && !pick; k++) {
          const a = alpha + spin * (Math.PI / 2) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.26;
          const pos = placeAlong(prev, Math.cos(a), Math.sin(a), 1.8, 1.8, 0.5);
          const c: Candidate = { cx: pos.cx, cz: pos.cz, sx: 1.8, sz: 1.8, top: prev.top + (k < 12 ? 1.1 : 0.6), thick: 0.6, under: 0.5 };
          first ??= c;
          if (validate(prev, prevIdx, c, platforms, corridors, speed).ok) pick = c;
        }
        if (!pick) {
          forced++;
          forcedAt.push(platforms.length);
        }
        push(pick ?? first!, kind);
        si++;
      }
    }
    beats.push({ kind, from, to: platforms.length });
    const last = platforms[platforms.length - 1];
    if (kind === "reward") coins.push({ x: last.cx, y: last.top + 1.05, z: last.cz });
    if (kind === "checkpoint") checkpoints.push(platforms.length - 1);
  }

  let lowest = 0;
  let height = 0;
  for (const p of platforms) {
    lowest = Math.min(lowest, p.top);
    height = Math.max(height, p.top);
  }
  return { params, beats, platforms, coins, checkpoints, summit: platforms.length - 1, rejected, backtracks, forced, forcedAt, reasons, runRequired, lowest, height };
}
