import * as THREE from "three";
import { buildChibi, type Chibi } from "../../actors/chibi";
import { SAFE_ROW, type Grid } from "./grid";
import type { PotentialFields } from "./fields";

// Guard agents. Each guard senses with an occluded vision cone, and plans with the
// composite potential field:
//   U(c) = wI * information(c) + wC * confidence(c) - wD * connectivity(c) - wS * spread(c)
// where connectivity is the guard's BFS distance and spread penalises cells near the
// other guards' targets so the team fans out instead of clumping.

export const FOV = THREE.MathUtils.degToRad(70);
export const RANGE = 7;
const ALERT_RANGE = 8.5;
const PATROL_SPEED = 2.1;
const CHASE_SPEED = 3.5;
const RAYS = 24;
const W_INFO = 1.0;
const W_CONF = 2.4;
const W_DIST = 0.75;
const W_SPREAD = 0.9;

const CALM = new THREE.Color(0xffd45c);
const WARY = new THREE.Color(0xff9a3c);
const ALARM = new THREE.Color(0xff3a2e);

function iconTexture(ch: string, bg: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.beginPath();
  g.arc(64, 64, 54, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = "#2a1a10";
  g.stroke();
  g.fillStyle = "#2a1a10";
  g.font = "900 84px Nunito, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let icons: { alarm: THREE.SpriteMaterial; wary: THREE.SpriteMaterial } | null = null;
function iconMats() {
  if (!icons) {
    icons = {
      alarm: new THREE.SpriteMaterial({ map: iconTexture("!", "#ff5a3c"), depthTest: false }),
      wary: new THREE.SpriteMaterial({ map: iconTexture("?", "#ffd45c"), depthTest: false }),
    };
  }
  return icons;
}

const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export interface GuardSpawn {
  x: number;
  z: number;
  heading: number;
  accent: number;
}

export interface Sense {
  sees: boolean;
  dist: number;
}

/** Per-difficulty guard tuning. */
export interface GuardTuning {
  fov: number;
  range: number;
  alertRange: number;
  patrolSpeed: number;
  chaseSpeed: number;
}

export const DEFAULT_TUNING: GuardTuning = { fov: FOV, range: RANGE, alertRange: ALERT_RANGE, patrolSpeed: PATROL_SPEED, chaseSpeed: CHASE_SPEED };

/** 0 calm, 1 wary (heard / glimpsed something), 2 alarmed (chasing). */
export type AlertState = 0 | 1 | 2;

export class Guard {
  readonly chibi: Chibi;
  readonly root = new THREE.Group();
  x = 0;
  z = 0;
  heading = 0;
  /** Seconds of alarm left; > 0 means chasing the confidence peak. */
  alert = 0;
  /** Seconds of suspicion (heard something). */
  wary = 0;
  target = -1;
  sees = false;
  /** Inactive guards are hidden and skipped (difficulty sets the team size). */
  active = true;
  tuning: GuardTuning = { ...DEFAULT_TUNING };
  private debugOn = false;
  private path: number[] = [];
  private pathIdx = 0;
  private replanT = 0;
  private lookT = 0;
  private lookBase = 0;
  private moving = 0;
  private readonly dist: Int16Array;
  private readonly parent: Int32Array;
  // Visuals.
  private cone: THREE.Mesh;
  private conePos: THREE.BufferAttribute;
  private coneCol: THREE.BufferAttribute;
  private coneMat: THREE.MeshBasicMaterial;
  private icon: THREE.Sprite;
  readonly debug = new THREE.Group();
  private ring: THREE.Mesh;
  private line: THREE.Line;
  private linePos: THREE.BufferAttribute;

  constructor(
    readonly grid: Grid,
    readonly spawn: GuardSpawn,
    scene: THREE.Scene,
  ) {
    this.dist = new Int16Array(grid.n);
    this.parent = new Int32Array(grid.n);
    this.chibi = buildChibi({
      hat: "cap",
      hatColor: 0x1f2b4a,
      top: 0x34497a,
      pants: 0x1e2333,
      shoes: 0x1a1410,
      hair: "short",
      hairColor: 0x3a2a20,
      prop: "lantern",
      scale: 1.04,
    });
    this.root.add(this.chibi.root);
    this.icon = new THREE.Sprite(iconMats().wary);
    this.icon.scale.setScalar(0.55);
    this.icon.position.y = 2.15;
    this.icon.renderOrder = 10;
    this.icon.visible = false;
    this.root.add(this.icon);
    scene.add(this.root);

    // Vision cone: a fan whose rays stop at walls; alpha fades toward the rim.
    const geo = new THREE.BufferGeometry();
    this.conePos = new THREE.BufferAttribute(new Float32Array((RAYS + 2) * 3), 3);
    this.coneCol = new THREE.BufferAttribute(new Float32Array((RAYS + 2) * 4), 4);
    this.conePos.setUsage(THREE.DynamicDrawUsage);
    this.coneCol.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", this.conePos);
    geo.setAttribute("color", this.coneCol);
    const idx: number[] = [];
    for (let r = 0; r < RAYS; r++) idx.push(0, r + 2, r + 1);
    geo.setIndex(idx);
    this.coneMat = new THREE.MeshBasicMaterial({ color: CALM.clone(), vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.cone = new THREE.Mesh(geo, this.coneMat);
    this.cone.frustumCulled = false;
    this.cone.renderOrder = 3;
    scene.add(this.cone);

    // Heatmap overlay: planned path and chosen target in the guard's accent colour.
    const accent = new THREE.Color(spawn.accent);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.46, 20), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.95, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 4;
    this.linePos = new THREE.BufferAttribute(new Float32Array(grid.n * 3), 3);
    this.linePos.setUsage(THREE.DynamicDrawUsage);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", this.linePos);
    lg.setDrawRange(0, 0);
    this.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.9, depthWrite: false }));
    this.line.frustumCulled = false;
    this.line.renderOrder = 4;
    this.debug.add(this.ring, this.line);
    this.debug.visible = false;
    scene.add(this.debug);
  }

  reset() {
    this.x = this.spawn.x;
    this.z = this.spawn.z;
    this.heading = this.spawn.heading;
    this.alert = 0;
    this.wary = 0;
    this.target = -1;
    this.path = [];
    this.pathIdx = 0;
    this.replanT = 0.4 + Math.random() * 0.6;
    this.lookT = 0;
    this.sees = false;
    this.moving = 0;
    this.icon.visible = false;
    this.line.geometry.setDrawRange(0, 0);
    this.syncVisual(0);
  }

  get cell() {
    return this.grid.cellAt(this.x, this.z);
  }

  // ---- Sensing -------------------------------------------------------------------

  /** Sweep the cone: rebuild the fan mesh and stamp every visible cell as seen. */
  sweep(fields: PotentialFields) {
    const g = this.grid;
    const { fov: FOV, range: base, alertRange } = this.tuning;
    const range = this.alert > 0 ? alertRange : base;
    const pos = this.conePos.array as Float32Array;
    const col = this.coneCol.array as Float32Array;
    const y = 0.05;
    pos[0] = this.x;
    pos[1] = y;
    pos[2] = this.z;
    col[0] = col[1] = col[2] = 1;
    col[3] = 0.55;
    fields.markSeen(this.cell);
    for (let r = 0; r <= RAYS; r++) {
      const a = this.heading - FOV / 2 + (FOV * r) / RAYS;
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      let len = 0;
      let last = -2;
      while (len < range) {
        const nl = Math.min(range, len + 0.2);
        const c = g.cellAt(this.x + dx * nl, this.z + dz * nl);
        if (c < 0 || g.opaque[c]) break;
        if (c !== last) {
          fields.markSeen(c);
          last = c;
        }
        len = nl;
      }
      const v = (r + 1) * 3;
      pos[v] = this.x + dx * len;
      pos[v + 1] = y;
      pos[v + 2] = this.z + dz * len;
      const k = (r + 1) * 4;
      col[k] = col[k + 1] = col[k + 2] = 1;
      col[k + 3] = 0.5 - 0.4 * (len / range);
    }
    this.conePos.needsUpdate = true;
    this.coneCol.needsUpdate = true;
  }

  /** Can this guard see the intruder at (px, pz)? */
  look(px: number, pz: number): Sense {
    const dx = px - this.x;
    const dz = pz - this.z;
    const d = Math.hypot(dx, dz);
    const range = this.alert > 0 ? this.tuning.alertRange : this.tuning.range;
    let sees = false;
    if (d < 1.3) sees = this.grid.lineOfSight(this.x, this.z, px, pz);
    else if (d < range && Math.abs(angDiff(Math.atan2(dx, dz), this.heading)) < this.tuning.fov / 2) sees = this.grid.lineOfSight(this.x, this.z, px, pz);
    this.sees = sees;
    return { sees, dist: d };
  }

  /** Heard running nearby: stop, turn toward the sound, then re-plan on the raised confidence. */
  hear(px: number, pz: number) {
    if (this.alert > 0) return;
    this.wary = 2.6;
    this.lookBase = Math.atan2(px - this.x, pz - this.z);
    this.lookT = 0.9;
    this.target = -1;
    this.path = [];
    this.replanT = 0;
  }

  /** Glimpsed something: stop and stare toward it while the detection meter builds. */
  notice(px: number, pz: number) {
    if (this.alert > 0) return;
    this.wary = Math.max(this.wary, 1.2);
    this.lookBase = Math.atan2(px - this.x, pz - this.z);
    this.lookT = Math.max(this.lookT, 0.3);
  }

  raiseAlarm() {
    if (this.alert <= 0) this.chibi.emote("jump");
    this.alert = 6;
    this.wary = 0;
    this.lookT = 0;
  }

  // ---- Planning ------------------------------------------------------------------

  /** Composite potential field target selection over every reachable cell. */
  private chooseTarget(fields: PotentialFields, team: Guard[]) {
    const g = this.grid;
    const start = this.cell;
    g.bfs(start, this.dist, this.parent);
    const chasing = this.alert > 0;
    let best = -1;
    let bestS = -Infinity;
    for (const c of g.open) {
      const d = this.dist[c];
      if (d < 0) continue;
      if (!chasing && (d < 3 || g.row(c) >= SAFE_ROW)) continue;
      let s: number;
      if (chasing) {
        s = fields.confN(c) * 3 - 0.02 * d;
      } else {
        s = W_INFO * fields.infoN(c) + W_CONF * fields.confN(c) - W_DIST * (d / 30);
        const x = g.cx(c);
        const z = g.cz(c);
        for (const o of team) {
          if (o === this) continue;
          if (o.target >= 0) {
            const d2 = (x - g.cx(o.target)) ** 2 + (z - g.cz(o.target)) ** 2;
            s -= W_SPREAD * Math.exp(-d2 / 32);
          }
          const p2 = (x - o.x) ** 2 + (z - o.z) ** 2;
          s -= 0.35 * W_SPREAD * Math.exp(-p2 / 18);
        }
        s += Math.random() * 0.03;
      }
      if (s > bestS) {
        bestS = s;
        best = c;
      }
    }
    if (best < 0) {
      this.target = -1;
      this.path = [];
      this.lookBase = this.heading;
      this.lookT = 1;
      return;
    }
    this.target = best;
    this.path = g.pathTo(best, this.parent);
    this.pathIdx = 0;
    this.drawPath();
  }

  private drawPath() {
    const g = this.grid;
    const arr = this.linePos.array as Float32Array;
    let n = 0;
    arr[n++] = this.x;
    arr[n++] = 0.09;
    arr[n++] = this.z;
    for (const c of this.path) {
      arr[n++] = g.cx(c);
      arr[n++] = 0.09;
      arr[n++] = g.cz(c);
    }
    this.linePos.needsUpdate = true;
    this.line.geometry.setDrawRange(0, n / 3);
    if (this.target >= 0) this.ring.position.set(g.cx(this.target), 0.08, g.cz(this.target));
  }

  // ---- Acting --------------------------------------------------------------------

  update(dt: number, t: number, fields: PotentialFields, team: Guard[], px: number, pz: number) {
    this.alert = Math.max(0, this.alert - dt);
    this.wary = Math.max(0, this.wary - dt);
    this.replanT -= dt;
    const chasing = this.alert > 0;
    const speed = chasing ? this.tuning.chaseSpeed : this.tuning.patrolSpeed;
    this.moving = 0;

    if (this.lookT > 0) {
      // Stand and scan (after reaching a target or hearing a noise).
      this.lookT -= dt;
      const want = this.lookBase + (this.wary > 0 ? 0 : Math.sin(t * 2.2) * 1.05);
      this.turnToward(want, dt, 5);
      if (this.lookT <= 0) this.replanT = 0;
    } else if (chasing && this.sees && this.grid.walkableLine(this.x, this.z, px, pz)) {
      // Direct pursuit while the intruder is in view.
      this.moveToward(px, pz, speed, dt);
      this.replanT = Math.min(this.replanT, 0.15);
    } else {
      const arrived = this.pathIdx >= this.path.length;
      if (arrived && this.target >= 0) {
        // Arrived: look around before choosing the next cell.
        this.lookBase = this.heading;
        this.lookT = chasing ? 0.7 : 1.1 + Math.random() * 0.8;
        this.target = -1;
      } else if (arrived || this.replanT <= 0) {
        this.chooseTarget(fields, team);
        this.replanT = chasing ? 0.6 : 3.5 + Math.random();
      }
      if (this.lookT <= 0) this.followPath(speed, dt);
    }
    this.syncVisual(dt);
  }

  private followPath(speed: number, dt: number) {
    const g = this.grid;
    if (this.pathIdx >= this.path.length) return;
    // String-pulling: aim at the furthest waypoint reachable in a straight line.
    const end = Math.min(this.path.length - 1, this.pathIdx + 6);
    for (let m = end; m > this.pathIdx; m--) {
      const c = this.path[m];
      if (g.walkableLine(this.x, this.z, g.cx(c), g.cz(c))) {
        this.pathIdx = m;
        break;
      }
    }
    const c = this.path[this.pathIdx];
    const tx = g.cx(c);
    const tz = g.cz(c);
    if (Math.hypot(tx - this.x, tz - this.z) < 0.15) {
      this.pathIdx++;
      return;
    }
    this.moveToward(tx, tz, speed, dt);
  }

  private moveToward(tx: number, tz: number, speed: number, dt: number) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-3) return;
    const want = Math.atan2(dx, dz);
    this.turnToward(want, dt, 7);
    // Slow down while turning sharply so guards don't moonwalk round corners.
    const k = Math.max(0.2, Math.cos(angDiff(want, this.heading)));
    const step = Math.min(d, speed * k * dt);
    const nx = this.x + (dx / d) * step;
    const nz = this.z + (dz / d) * step;
    if (!this.grid.isBlockedAt(nx, nz)) {
      this.x = nx;
      this.z = nz;
    }
    this.moving = step / Math.max(dt, 1e-4);
  }

  private turnToward(want: number, dt: number, rate: number) {
    const d = angDiff(want, this.heading);
    this.heading += THREE.MathUtils.clamp(d, -rate * dt, rate * dt);
  }

  private syncVisual(dt: number) {
    this.root.position.set(this.x, 0, this.z);
    this.chibi.root.rotation.y = this.heading;
    this.chibi.animate(dt, this.moving, false);
    const target = this.alert > 0 ? ALARM : this.wary > 0 ? WARY : CALM;
    this.coneMat.color.lerp(target, dt > 0 ? Math.min(1, dt * 8) : 1);
    const mats = iconMats();
    this.icon.visible = this.alert > 0 || this.wary > 0;
    this.icon.material = this.alert > 0 ? mats.alarm : mats.wary;
    this.ring.visible = this.target >= 0;
  }

  get state(): AlertState {
    return this.alert > 0 ? 2 : this.wary > 0 ? 1 : 0;
  }

  setDebug(on: boolean) {
    this.debugOn = on;
    this.debug.visible = on && this.active;
  }

  /** Join or leave the patrol team (hidden when inactive). */
  setActive(on: boolean) {
    this.active = on;
    this.root.visible = on;
    this.cone.visible = on;
    this.debug.visible = on && this.debugOn;
  }
}
