import { COLS, SAFE_ROW, type Grid } from "./grid";

// Composite potential fields shared by the guard team (after Xu et al., AIIDE 2025 /
// CoG 2026). Two global maps live on the occupancy grid:
//   information  seconds since a guard last saw each cell (stale cells attract)
//   confidence   belief that the intruder is in each cell (spikes on sight/sound,
//                diffuses outward and fades when the trail goes cold)
// The third component, connectivity, is each guard's own BFS distance map.

/** Information saturates after this many unseen seconds. */
export const INFO_CAP = 28;

export type FieldLayer = "combined" | "information" | "confidence";

export class PotentialFields {
  readonly info: Float32Array;
  readonly conf: Float32Array;
  private scratch: Float32Array;
  /** Cells inside any guard's view this tick (cleared every tick). */
  readonly seen: Uint8Array;
  /** Current belief peak; confidence is read relative to it so a fading trail still guides the search. */
  private peakV = 0;

  constructor(readonly grid: Grid) {
    this.info = new Float32Array(grid.n);
    this.conf = new Float32Array(grid.n);
    this.scratch = new Float32Array(grid.n);
    this.seen = new Uint8Array(grid.n);
  }

  /** Fresh fields: random staleness so the team fans out from the start. */
  reset() {
    for (const c of this.grid.open) this.info[c] = 8 + Math.random() * 10;
    this.conf.fill(0);
    this.seen.fill(0);
    this.peakV = 0;
  }

  markSeen(c: number) {
    if (c >= 0) this.seen[c] = 1;
  }

  /** Raise belief around a cell (sighting = strong and tight, noise = weaker). */
  addEvidence(c: number, strength: number, radius = 1) {
    if (c < 0) return;
    const g = this.grid;
    const ci = c % COLS;
    const cj = g.row(c);
    for (const o of g.open) {
      const di = (o % COLS) - ci;
      const dj = g.row(o) - cj;
      const d2 = di * di + dj * dj;
      if (d2 > (radius + 0.5) ** 2) continue;
      const v = strength * Math.exp(-d2 / (2 * Math.max(0.4, radius * 0.7) ** 2));
      if (v > this.conf[o]) this.conf[o] = Math.min(1, v);
    }
    this.peakV = Math.max(this.peakV, Math.min(1, strength));
  }

  /**
   * One field tick. Information grows everywhere and resets where guards look;
   * confidence diffuses to neighbours, decays, and is wiped where guards look and
   * see nobody (negative information) unless `keep` (the cell holding the visible intruder).
   */
  tick(dt: number, keep: number) {
    const g = this.grid;
    const { info, conf, scratch, seen } = this;
    const decay = Math.exp(-dt / 14);
    for (const c of g.open) {
      info[c] = seen[c] ? 0 : Math.min(INFO_CAP, info[c] + dt);
      const nb = g.nbrs[c];
      let sum = 0;
      for (const n of nb) sum += conf[n];
      const mean = nb.length ? sum / nb.length : 0;
      const k = Math.min(0.5, dt * 1.6);
      scratch[c] = ((1 - k) * conf[c] + k * mean) * decay;
    }
    let peak = 0;
    for (const c of g.open) {
      conf[c] = seen[c] && c !== keep ? scratch[c] * 0.15 : scratch[c];
      if (conf[c] > peak) peak = conf[c];
    }
    this.peakV = peak;
    seen.fill(0);
  }

  /** Normalised staleness 0..1. */
  infoN(c: number) {
    return this.info[c] / INFO_CAP;
  }

  /** Belief relative to the current peak (0..1); vanishes once the trail is cold. */
  confN(c: number) {
    return this.conf[c] / Math.max(0.06, this.peakV);
  }

  /**
   * The guard-independent part of the potential, for the heatmap. The entrance hall is
   * outside the patrol region, so only belief (a chase) shows there.
   */
  value(c: number, layer: FieldLayer): number {
    const info = this.grid.row(c) >= SAFE_ROW ? 0 : this.infoN(c);
    if (layer === "information") return info;
    if (layer === "confidence") return this.confN(c);
    return Math.min(1, 0.55 * info + 0.9 * this.confN(c));
  }

  /** Strongest belief and where it is. */
  peak(): { cell: number; value: number } {
    let cell = -1;
    let value = 0;
    for (const c of this.grid.open) {
      if (this.conf[c] > value) {
        value = this.conf[c];
        cell = c;
      }
    }
    return { cell, value };
  }
}
