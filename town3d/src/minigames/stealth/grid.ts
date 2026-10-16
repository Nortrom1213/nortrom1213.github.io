// 1 m occupancy grid for The Archive floor. The same grid drives collision,
// guard vision occlusion, path-finding and the potential-field heatmap, so what
// the visitor sees on screen is exactly what the guards reason over.

/**
 * Floor plan, north (z = -12) at the top, 32 x 24 cells.
 *   #  partition wall (blocks movement and sight, 1.8 m tall)
 *   C  glass display cabinet (blocks movement and sight)
 *   p  statue on a plinth (blocks movement and sight)
 *   B  archive shelf (blocks movement and sight)
 *   t  potted plant (blocks movement only)
 *   M  manuscript lectern (blocks movement only)
 *   .  open floor
 */
export const PLAN: string[] = [
  "t..............................t", // 0  north gallery: the manuscript room
  ".BB..........................BB.", // 1
  "..........p....MM....p..........", // 2
  "................................", // 3
  ".....CCC..............CCC.......", // 4
  "................................", // 5
  "..p.........p......p.........p..", // 6
  "t..............................t", // 7
  "####...##################...####", // 8  wall with west and east doorways
  "..........#..........#..........", // 9  west / central / east galleries
  "..p.......#....CC....#.......p..", // 10
  "..........#..........#..........", // 11
  "....CC.....p..........p....CC...", // 12 side doorways through the galleries
  "................................", // 13
  "..........#..........#..........", // 14
  "..p.......#....pp....#.......p..", // 15
  "###...########....########...###", // 16 wall into the entrance hall
  "t..............................t", // 17 entrance hall
  "...p......C...CCCC...C......p...", // 18
  "................................", // 19
  ".....tt..................tt.....", // 20
  "................................", // 21
  "................................", // 22
  "t..............................t", // 23
];

export const COLS = 32;
export const ROWS = 24;
export const X0 = -COLS / 2;
export const Z0 = -ROWS / 2;
/** Rows at or below this index are the entrance hall: guards never pick targets there. */
export const SAFE_ROW = 17;

const OPAQUE = new Set(["#", "C", "p", "B"]);
const BLOCKED = new Set(["#", "C", "p", "B", "t", "M"]);

const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export class Grid {
  readonly n = COLS * ROWS;
  readonly kind: string[] = [];
  readonly blocked = new Uint8Array(COLS * ROWS);
  readonly opaque = new Uint8Array(COLS * ROWS);
  /** Indices of every walkable cell (heatmap + field loops). */
  readonly open: number[] = [];
  /** Walkable 4-neighbours of each cell. */
  readonly nbrs: number[][] = [];

  constructor() {
    for (let j = 0; j < ROWS; j++) {
      const row = PLAN[j] ?? "";
      if (row.length !== COLS) console.warn(`archive plan row ${j} has ${row.length} cells`);
      for (let i = 0; i < COLS; i++) {
        const ch = row[i] ?? ".";
        const c = j * COLS + i;
        this.kind[c] = ch;
        this.blocked[c] = BLOCKED.has(ch) ? 1 : 0;
        this.opaque[c] = OPAQUE.has(ch) ? 1 : 0;
      }
    }
    for (let c = 0; c < this.n; c++) {
      const list: number[] = [];
      if (!this.blocked[c]) {
        this.open.push(c);
        const i = c % COLS;
        const j = (c / COLS) | 0;
        for (const [di, dj] of DIRS4) {
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= COLS || nj >= ROWS) continue;
          const nc = nj * COLS + ni;
          if (!this.blocked[nc]) list.push(nc);
        }
      }
      this.nbrs.push(list);
    }
  }

  /** Cell index under a world point, or -1 off the grid. */
  cellAt(x: number, z: number): number {
    const i = Math.floor(x - X0);
    const j = Math.floor(z - Z0);
    if (i < 0 || j < 0 || i >= COLS || j >= ROWS) return -1;
    return j * COLS + i;
  }

  cx(c: number) {
    return X0 + (c % COLS) + 0.5;
  }

  cz(c: number) {
    return Z0 + ((c / COLS) | 0) + 0.5;
  }

  row(c: number) {
    return (c / COLS) | 0;
  }

  isOpaqueAt(x: number, z: number): boolean {
    const c = this.cellAt(x, z);
    return c < 0 || this.opaque[c] === 1;
  }

  isBlockedAt(x: number, z: number): boolean {
    const c = this.cellAt(x, z);
    return c < 0 || this.blocked[c] === 1;
  }

  /** Grid line of sight: sample the segment every 0.25 m against opaque cells. */
  lineOfSight(ax: number, az: number, bx: number, bz: number): boolean {
    const dx = bx - ax;
    const dz = bz - az;
    const steps = Math.ceil(Math.hypot(dx, dz) / 0.25);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      if (this.isOpaqueAt(ax + dx * t, az + dz * t)) return false;
    }
    return true;
  }

  /** A guard (radius ~0.3) can walk straight from a to b without clipping a blocked cell. */
  walkableLine(ax: number, az: number, bx: number, bz: number): boolean {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return true;
    const px = (-dz / len) * 0.32;
    const pz = (dx / len) * 0.32;
    const steps = Math.ceil(len / 0.3);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = ax + dx * t;
      const z = az + dz * t;
      if (this.isBlockedAt(x + px, z + pz) || this.isBlockedAt(x - px, z - pz)) return false;
    }
    return true;
  }

  /**
   * Connectivity map: breadth-first distance (in cells) from `start` over walkable cells.
   * Unreachable cells are -1. `parent` is filled for path reconstruction.
   */
  bfs(start: number, dist: Int16Array, parent: Int32Array) {
    dist.fill(-1);
    parent.fill(-1);
    if (start < 0 || this.blocked[start]) return;
    const queue = new Int32Array(this.n);
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    dist[start] = 0;
    while (head < tail) {
      const c = queue[head++];
      for (const nc of this.nbrs[c]) {
        if (dist[nc] !== -1) continue;
        dist[nc] = dist[c] + 1;
        parent[nc] = c;
        queue[tail++] = nc;
      }
    }
  }

  /** Path start -> goal from a filled parent array (start excluded). */
  pathTo(goal: number, parent: Int32Array): number[] {
    const out: number[] = [];
    let c = goal;
    let guard = 0;
    while (c !== -1 && guard++ < this.n) {
      out.push(c);
      c = parent[c];
    }
    out.pop(); // the start cell
    return out.reverse();
  }

  /** Nearest walkable cell to a point (for spawning / snapping). */
  nearestOpen(x: number, z: number): number {
    let best = this.open[0];
    let bd = Infinity;
    for (const c of this.open) {
      const d = (this.cx(c) - x) ** 2 + (this.cz(c) - z) ** 2;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }
}
