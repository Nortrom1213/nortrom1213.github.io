import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { centered, hasModel, modelBounds, type Kit } from "../../core/assets";
import type { Game } from "../../core/game";
import type { Interactable } from "../../core/stage";
import type { TownStage } from "../town";
import { onPath } from "../terrain";
import type { Synth } from "./sound";

// Shared helpers for the town details: a vertex-colour "baker" that merges many
// small code-built shapes into one mesh (one draw call per prop cluster), canvas
// textures, model fitting, collider/placement helpers and the discovery log.

const V = new THREE.Vector3();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const ONE = new THREE.Vector3(1, 1, 1);

/** One shared material for every baked mesh (colours live in the vertices). */
export const bakedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true });

/**
 * Collects coloured primitives under a transform stack and merges them into a
 * single non-indexed mesh with flat normals.
 */
export class Baker {
  private parts: THREE.BufferGeometry[] = [];
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];

  private get top() {
    return this.stack[this.stack.length - 1];
  }

  /** Run `fn` with a local frame at (x, y, z) turned by ry (and uniformly scaled). */
  at(x: number, y: number, z: number, ry: number, fn: () => void, s = 1) {
    const m = new THREE.Matrix4().compose(V.set(x, y, z), Q.setFromEuler(E.set(0, ry, 0)), new THREE.Vector3(s, s, s));
    this.stack.push(this.top.clone().multiply(m));
    fn();
    this.stack.pop();
    return this;
  }

  /** Same as `at` but with a full rotation. */
  atR(x: number, y: number, z: number, rx: number, ry: number, rz: number, fn: () => void) {
    const m = new THREE.Matrix4().compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), ONE);
    this.stack.push(this.top.clone().multiply(m));
    fn();
    this.stack.pop();
    return this;
  }

  add(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    for (const name of Object.keys(g.attributes)) if (name !== "position") g.deleteAttribute(name);
    const local = new THREE.Matrix4().compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(this.top.clone().multiply(local));
    const n = g.attributes.position.count;
    const c = new THREE.Color(color);
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    this.parts.push(g);
    return this;
  }

  /** Box centred at (x, y, z). */
  box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz);
  }

  /** Cylinder centred at (x, y, z). */
  cyl(rTop: number, rBot: number, h: number, seg: number, color: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, x, y, z, rx, ry, rz);
  }

  cone(r: number, h: number, seg: number, color: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, x, y, z, rx, ry, rz);
  }

  /** Low-poly blob (icosahedron), optionally squashed. */
  blob(r: number, color: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, detail = 0) {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, x, y, z, 0, 0, 0, sx, sy, sz);
  }

  sphere(r: number, color: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    return this.add(new THREE.SphereGeometry(r, 8, 6), color, x, y, z, 0, 0, 0, sx, sy, sz);
  }

  torus(r: number, tube: number, color: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2) {
    return this.add(new THREE.TorusGeometry(r, tube, 4, 10, arc), color, x, y, z, rx, ry, rz);
  }

  /** Triangle in the local XY plane, extruded `depth` along z (centred). */
  prism(w: number, h: number, depth: number, color: number, x = 0, y = 0, z = 0, ry = 0) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    return this.add(g, color, x, y, z, 0, ry, 0);
  }

  get empty() {
    return this.parts.length === 0;
  }

  build(shadows = true): THREE.Mesh {
    const merged = this.parts.length ? mergeGeometries(this.parts, false) : new THREE.BufferGeometry();
    for (const p of this.parts) p.dispose();
    this.parts = [];
    merged.computeVertexNormals();
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, bakedMat);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    return mesh;
  }
}

/** Canvas texture helper. */
export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * A thin board with a texture on its front (+z) face: a single-material box plus a
 * textured plane (two draw calls; a multi-material box would cost six).
 */
export function plaque(w: number, h: number, tex: THREE.Texture, edge = 0x5e3a20, depth = 0.06, emissive = false): THREE.Mesh {
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), new THREE.MeshStandardMaterial({ color: edge, roughness: 0.9 }));
  back.castShadow = true;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.98, h * 0.98),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, ...(emissive ? { emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6 } : {}) }),
  );
  face.position.z = depth / 2 + 0.003;
  back.add(face);
  return back;
}

/** Simple engraved / painted text plate. */
export function textTexture(lines: string[], opts: { w?: number; h?: number; bg?: string; fg?: string; font?: string; border?: string; sizes?: number[] } = {}) {
  const w = opts.w ?? 512;
  const h = opts.h ?? 256;
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = opts.bg ?? "#d8cdb4";
    ctx.fillRect(0, 0, w, h);
    if (opts.border) {
      ctx.strokeStyle = opts.border;
      ctx.lineWidth = Math.max(6, w * 0.02);
      ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
    }
    ctx.fillStyle = opts.fg ?? "#3a2a1e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const n = lines.length;
    lines.forEach((line, i) => {
      const size = opts.sizes?.[i] ?? (i === 0 ? h * 0.26 : h * 0.15);
      ctx.font = `700 ${size}px ${opts.font ?? "Fraunces, Georgia, serif"}`;
      let s = size;
      while (ctx.measureText(line).width > w * 0.9 && s > 10) {
        s -= 2;
        ctx.font = `700 ${s}px ${opts.font ?? "Fraunces, Georgia, serif"}`;
      }
      ctx.fillText(line, w / 2, (h * (i + 1)) / (n + 1) + (i === 0 && n > 1 ? -h * 0.04 : 0));
    });
  });
}

/** Clone a model so its height matches `height` metres (empty group if missing). */
export function fit(kit: Kit, name: string, height: number): THREE.Group {
  if (!hasModel(kit, name)) return new THREE.Group();
  const b = modelBounds(kit, name);
  const s = height / Math.max(1e-3, b.max.y - b.min.y);
  return centered(kit, name, s);
}

/** Current material of a mesh (the toon pass may swap it), for live tweaks. */
export function liveMat(mesh: THREE.Mesh): THREE.MeshStandardMaterial {
  return (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
}

/** Set emissive intensity on whatever materials the object currently has (incl. children). */
export function setGlow(obj: THREE.Object3D, k: number) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const s = m as THREE.MeshStandardMaterial;
      if (s.emissive && (s.emissiveMap || s.emissive.getHex() !== 0)) s.emissiveIntensity = k;
    }
  });
}

/** Additive glow sprite (uses the town's radial texture). */
export function glowSprite(tex: THREE.Texture, color: number, size: number) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  s.scale.setScalar(size);
  return s;
}

// ---- Placement -----------------------------------------------------------------

/** True when a circle (x, z, r) overlaps an existing collider. */
export function blockedBy(town: TownStage, x: number, z: number, r: number) {
  for (const c of town.world.cylinders) if (Math.hypot(c.x - x, c.z - z) < c.r + r && c.y1 > 0.2) return true;
  for (const b of town.world.boxes) {
    const cx = Math.max(b.min.x, Math.min(x, b.max.x));
    const cz = Math.max(b.min.z, Math.min(z, b.max.z));
    if (Math.hypot(x - cx, z - cz) < r && b.max.y > 0.2) return true;
  }
  return false;
}

/** First candidate (or a nearby nudge of it) that is off paths and free of colliders. */
export function findClear(town: TownStage, candidates: [number, number][], r: number): { x: number; z: number } {
  for (const [cx, cz] of candidates) {
    for (let ring = 0; ring <= 4; ring++) {
      const steps = ring === 0 ? 1 : 8;
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const x = cx + Math.cos(a) * ring * 1.2;
        const z = cz + Math.sin(a) * ring * 1.2;
        if (Math.hypot(x, z) > 55) continue;
        if (!onPath(x, z, r + 0.3) && !blockedBy(town, x, z, r + 0.4)) return { x, z };
      }
    }
  }
  return { x: candidates[0][0], z: candidates[0][1] };
}

// ---- Persistence (local only) -------------------------------------------------------

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / storage full: the town just forgets */
  }
}

// ---- Context shared by every detail module ---------------------------------------------

export interface SpotOptions {
  id: string;
  x: number;
  z: number;
  y?: number;
  label: string | (() => string);
  radius?: number;
  marker?: number;
  enabled?: () => boolean;
  /** Counts toward "discoveries" the first time it is used. */
  discovery?: string;
  /** Share one discovery between several spots (e.g. benches). */
  discoveryId?: string;
  onInteract: () => void;
}

export interface Ctx {
  game: Game;
  town: TownStage;
  root: THREE.Group;
  synth: Synth;
  glowTex: THREE.Texture;
  autumn: boolean;
  season: "spring" | "summer" | "autumn" | "winter";
  every(fn: (dt: number, t: number) => void): void;
  spot(o: SpotOptions): Interactable;
  /** Record a discovery (shows the x/N toast the first time). */
  discover(id: string, label: string): void;
  solidCyl(x: number, z: number, r: number, h?: number): void;
  solidBox(x: number, z: number, sx: number, sz: number, h?: number, y0?: number): void;
  /** Night factor 0..1. */
  night(): number;
  /** Player position (live). */
  player(): THREE.Vector3;
  /** Short line with a sound-free toast. */
  say(html: string, ms?: number): void;
  /** Pick lines in order, wrapping. */
  cycle(lines: string[]): () => string;
}

/** Random pick that never repeats the previous item. */
export function shuffler<T>(items: T[]): () => T {
  let last = -1;
  return () => {
    let i = Math.floor(Math.random() * items.length);
    if (items.length > 1 && i === last) i = (i + 1) % items.length;
    last = i;
    return items[i];
  };
}
