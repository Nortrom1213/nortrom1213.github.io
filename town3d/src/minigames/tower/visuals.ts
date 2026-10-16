import * as THREE from "three";
import { instanced, type Kit, type Placement } from "../../core/assets";
import { flatMat } from "../../actors/chibi";
import { BEAT_INFO, PILLAR_R, mulberry32, type Level } from "./generator";

// Meshes for a generated tower. Every platform shares three InstancedMeshes (grass
// slab, stone body, rock cone underneath) so a whole tower costs a handful of draw
// calls; decorations use the instanced Kenney helpers.

export const TOWER_MODELS: [Kit, string][] = [
  ["nature", "flower_redA"],
  ["nature", "flower_yellowA"],
  ["nature", "flower_purpleA"],
  ["nature", "grass"],
  ["nature", "grass_large"],
  ["nature", "plant_bush"],
  ["nature", "rock_smallA"],
  ["nature", "rock_smallC"],
  ["nature", "tree_pineRoundA"],
  ["nature", "tree_oak"],
];

/** Unit box with its top face at y = 0. */
const slabGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, -0.5, 0);
/** Square pyramid hanging down: base (1 x 1) at y = 0, apex at y = -1. */
const coneGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).rotateX(Math.PI).translate(0, -0.5, 0);
const coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.09, 14).rotateX(Math.PI / 2);
const poleGeo = new THREE.CylinderGeometry(0.05, 0.06, 1, 6).translate(0, 0.5, 0);
const clothGeo = new THREE.BoxGeometry(1, 1, 0.04).translate(0.5, 0, 0);
const knobGeo = new THREE.IcosahedronGeometry(0.12, 0);
const puffGeo = new THREE.IcosahedronGeometry(1, 0);

const instMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, flatShading: true });
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffcf3a, emissive: 0x8a5a00, emissiveIntensity: 0.55, roughness: 0.45, metalness: 0.25, flatShading: true });
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, flatShading: true, transparent: true, opacity: 0.92 });

export const BANNER_IDLE = flatMat(0xa8b0b8);
export const BANNER_ON = flatMat(0x56b8a8, { emissive: 0x1a5a50 });

export interface Banner {
  cloth: THREE.Mesh;
  platform: number;
}

export interface LevelView {
  group: THREE.Group;
  coins: THREE.InstancedMesh;
  banners: Banner[];
  flag: THREE.Object3D;
  dispose(): void;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

function setInst(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rotY = 0) {
  tmpQ.setFromAxisAngle(UP, rotY);
  tmpM.compose(tmpP.set(x, y, z), tmpQ, tmpS.set(sx, sy, sz));
  mesh.setMatrixAt(i, tmpM);
}

function newInstanced(geo: THREE.BufferGeometry, mat: THREE.Material, count: number, shadows = true) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
  m.count = count;
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}

function finish(mesh: THREE.InstancedMesh) {
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

/** Vertical extent of the central pillar (shared by mesh and collider). */
export function pillarSpan(level: Level) {
  return { top: level.height - 1.6, bottom: level.lowest - 9 };
}

export function buildLevelView(level: Level, lowQuality: boolean): LevelView {
  const group = new THREE.Group();
  const rnd = mulberry32(level.params.seed + 17);
  const P = level.platforms;

  // ---- Platforms: slab + body + hanging rock -------------------------------------
  const tops = newInstanced(slabGeo, instMat, P.length);
  const bodies = newInstanced(slabGeo, instMat, P.length);
  const unders = newInstanced(coneGeo, instMat, P.length, !lowQuality);
  P.forEach((p, i) => {
    setInst(tops, i, p.cx, p.top, p.cz, p.sx * 1.04, 0.2, p.sz * 1.04);
    setInst(bodies, i, p.cx, p.top - 0.16, p.cz, p.sx * 0.98, Math.max(0.2, p.thick - 0.16), p.sz * 0.98);
    setInst(unders, i, p.cx, p.top - p.thick + 0.01, p.cz, p.sx * 0.96, p.under, p.sz * 0.96);
    const v = (rnd() - 0.5) * 0.08;
    tmpC.setHex(BEAT_INFO[p.kind].color).offsetHSL(0, 0, v);
    tops.setColorAt(i, tmpC);
    tmpC.setHex(0xa88a66).offsetHSL(0, 0, v);
    bodies.setColorAt(i, tmpC);
    tmpC.setHex(0x7d6650).offsetHSL(0, 0, v * 0.8);
    unders.setColorAt(i, tmpC);
  });
  for (const m of [tops, bodies, unders]) {
    finish(m);
    group.add(m);
  }

  // ---- Decorations on calm platforms ------------------------------------------------
  const deco = new Map<string, Placement[]>();
  const put = (name: string, pl: Placement) => {
    let list = deco.get(name);
    if (!list) deco.set(name, (list = []));
    list.push(pl);
  };
  const flowers = ["flower_redA", "flower_yellowA", "flower_purpleA"];
  P.forEach((p, i) => {
    const calm = p.kind === "start" || p.kind === "rest" || p.kind === "checkpoint" || p.kind === "summit" || p.kind === "reward";
    const n = calm ? 3 + Math.floor(rnd() * 4) : rnd() < 0.35 ? 1 : 0;
    for (let k = 0; k < n; k++) {
      // Keep the middle clear: decorations hug the rim.
      const side = Math.floor(rnd() * 4);
      const u = rnd() * 2 - 1;
      const ex = p.sx / 2 - 0.3;
      const ez = p.sz / 2 - 0.3;
      const x = p.cx + (side < 2 ? u * ex : side === 2 ? ex : -ex);
      const z = p.cz + (side < 2 ? (side === 0 ? ez : -ez) : u * ez);
      const r = rnd();
      const name = r < 0.45 ? flowers[Math.floor(rnd() * 3)] : r < 0.75 ? (rnd() < 0.5 ? "grass" : "grass_large") : r < 0.9 ? "plant_bush" : rnd() < 0.5 ? "rock_smallA" : "rock_smallC";
      const scale = name.startsWith("flower") ? 1.3 + rnd() * 0.5 : name.startsWith("grass") ? 1.4 + rnd() * 0.6 : name === "plant_bush" ? 0.9 + rnd() * 0.4 : 1.0 + rnd() * 0.6;
      put(name, { x, y: p.top, z, rotY: rnd() * 6.28, scale });
    }
    if (i === 0) {
      put("tree_oak", { x: p.cx - p.sx / 2 + 0.9, y: p.top, z: p.cz - p.sz / 2 + 0.9, rotY: 1, scale: 2.2 });
    }
  });
  for (const [name, list] of deco) group.add(instanced("nature", name, list, 1, !lowQuality));

  // ---- Central stone pillar ---------------------------------------------------------
  const { top: pillarTop, bottom: pillarBottom } = pillarSpan(level);
  const ph = pillarTop - pillarBottom;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(PILLAR_R, PILLAR_R * 1.08, ph, 10, 1), flatMat(0xc2b49c));
  pillar.position.y = pillarBottom + ph / 2;
  pillar.castShadow = true;
  pillar.receiveShadow = true;
  group.add(pillar);
  const root = new THREE.Mesh(new THREE.ConeGeometry(PILLAR_R * 1.08, 6, 10, 1).rotateX(Math.PI), flatMat(0x8a735a));
  root.position.y = pillarBottom - 3;
  group.add(root);
  // Bands, windows and crenellations (instanced).
  const bandCount = Math.max(1, Math.floor(ph / 5));
  const bands = newInstanced(new THREE.CylinderGeometry(PILLAR_R + 0.12, PILLAR_R + 0.12, 0.35, 10, 1), flatMat(0x9c8c74), bandCount, false);
  for (let i = 0; i < bandCount; i++) setInst(bands, i, 0, pillarBottom + 4 + i * 5, 0, 1, 1, 1);
  finish(bands);
  group.add(bands);
  const winCount = Math.max(1, Math.floor(ph / 2.4));
  const windows = newInstanced(slabGeo, flatMat(0x3a3046, { emissive: 0x2a1a10 }), winCount, false);
  for (let i = 0; i < winCount; i++) {
    const a = i * 2.1;
    const y = pillarBottom + 2 + i * 2.4;
    setInst(windows, i, Math.sin(a) * PILLAR_R, y + 0.5, Math.cos(a) * PILLAR_R, 0.5, 0.9, 0.5, a);
  }
  finish(windows);
  group.add(windows);
  const merlons = newInstanced(slabGeo, flatMat(0xb0a28a), 10);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    setInst(merlons, i, Math.sin(a) * (PILLAR_R - 0.3), pillarTop + 0.6, Math.cos(a) * (PILLAR_R - 0.3), 0.8, 0.6, 0.6, a);
  }
  finish(merlons);
  group.add(merlons);

  // ---- Coins ---------------------------------------------------------------------------
  const coins = newInstanced(coinGeo, coinMat, level.coins.length);
  level.coins.forEach((c, i) => setInst(coins, i, c.x, c.y, c.z, 1, 1, 1));
  finish(coins);
  coins.frustumCulled = false;
  group.add(coins);

  // ---- Checkpoint banners ------------------------------------------------------------
  const banners: Banner[] = [];
  for (const idx of level.checkpoints) {
    if (idx === 0) continue;
    const p = P[idx];
    const g = new THREE.Group();
    g.position.set(p.cx + p.sx / 2 - 0.45, p.top, p.cz + p.sz / 2 - 0.45);
    const pole = new THREE.Mesh(poleGeo, flatMat(0x6a4a30));
    pole.scale.y = 2.3;
    const cloth = new THREE.Mesh(clothGeo, BANNER_IDLE);
    cloth.scale.set(0.9, 0.55, 1);
    cloth.position.y = 1.95;
    const knob = new THREE.Mesh(knobGeo, flatMat(0xe8c24a));
    knob.position.y = 2.36;
    g.add(pole, cloth, knob);
    group.add(g);
    banners.push({ cloth, platform: idx });
  }

  // ---- Summit flag ---------------------------------------------------------------------
  const s = P[level.summit];
  const flagRoot = new THREE.Group();
  flagRoot.position.set(s.cx, s.top, s.cz);
  const fpole = new THREE.Mesh(poleGeo, flatMat(0x6a4a30));
  fpole.scale.set(1.4, 3.4, 1.4);
  const flag = new THREE.Group();
  flag.position.y = 2.9;
  const fcloth = new THREE.Mesh(clothGeo, flatMat(0xe0503a));
  fcloth.scale.set(1.5, 0.9, 1);
  flag.add(fcloth);
  const fknob = new THREE.Mesh(knobGeo, flatMat(0xffd25a, { emissive: 0x8a5a00 }));
  fknob.scale.setScalar(1.6);
  fknob.position.y = 3.5;
  flagRoot.add(fpole, flag, fknob);
  group.add(flagRoot);

  return {
    group,
    coins,
    banners,
    flag,
    dispose() {
      group.traverse((o) => {
        const im = o as THREE.InstancedMesh;
        if (im.isInstancedMesh) im.dispose();
      });
      pillar.geometry.dispose();
      root.geometry.dispose();
      bands.geometry.dispose();
    },
  };
}

/** Spin and bob the coins; collected ones shrink to nothing. */
export function updateCoins(view: LevelView, level: Level, taken: boolean[], t: number) {
  level.coins.forEach((c, i) => {
    const k = taken[i] ? 0 : 1;
    setInst(view.coins, i, c.x, c.y + Math.sin(t * 2.4 + i) * 0.12, c.z, k, k, k, t * 2.6 + i);
  });
  view.coins.instanceMatrix.needsUpdate = true;
}

/** Static backdrop: a cloud sea below and a few far-off floating islands. */
export function buildBackdrop(lowQuality: boolean): THREE.Group {
  const group = new THREE.Group();
  const rnd = mulberry32(4242);
  const puffs = lowQuality ? 70 : 140;
  const clouds = newInstanced(puffGeo, cloudMat, puffs, false);
  clouds.receiveShadow = false;
  for (let i = 0; i < puffs; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 8 + Math.sqrt(rnd()) * 120;
    const s = 3 + rnd() * 6;
    setInst(clouds, i, Math.cos(a) * r, -19 - rnd() * 4, Math.sin(a) * r, s * 1.6, s * 0.55, s * 1.3, rnd() * 6);
  }
  finish(clouds);
  group.add(clouds);

  const n = 8;
  const isleTops = newInstanced(slabGeo, instMat, n, false);
  const isleUnders = newInstanced(coneGeo, instMat, n, false);
  const trees: Placement[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
    const r = 55 + rnd() * 45;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = -8 + rnd() * 30;
    const s = 6 + rnd() * 8;
    setInst(isleTops, i, x, y, z, s, 1.4, s * 0.8, a);
    setInst(isleUnders, i, x, y - 1.4, z, s * 0.95, s * 0.9, s * 0.75, a);
    isleTops.setColorAt(i, tmpC.setHex(0x8cc46a).offsetHSL(0, 0, (rnd() - 0.5) * 0.1));
    isleUnders.setColorAt(i, tmpC.setHex(0x7d6650));
    for (let k = 0; k < 2 + Math.floor(rnd() * 3); k++) {
      trees.push({ x: x + (rnd() - 0.5) * s * 0.6, y, z: z + (rnd() - 0.5) * s * 0.4, rotY: rnd() * 6, scale: 3 + rnd() * 2 });
    }
  }
  finish(isleTops);
  finish(isleUnders);
  group.add(isleTops, isleUnders, instanced("nature", "tree_pineRoundA", trees, 1, false));
  return group;
}
