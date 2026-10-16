import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { warmFoliage } from "./toon";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Loads Kenney CC0 models (public/models/{town,nature,furniture}) once, and hands out
// clones or instanced batches. Fantasy-town pieces share one colour-map texture; roof
// colours are swapped by recolouring that texture per palette.

const BASE = import.meta.env.BASE_URL + "models/";
const loader = new GLTFLoader();
const cache = new Map<string, THREE.Group>();
const pending = new Map<string, Promise<THREE.Group>>();

export type Kit = "town" | "nature" | "furniture";

export function modelKey(kit: Kit, name: string) {
  return `${kit}/${name}`;
}

// Every Kenney GLB carries its own copy of the same material (and, for the town
// kit, the same 512px colour map). Share one material per (kit, name, colour, map)
// so the GPU holds one texture and static geometry can be merged per material.
const canonical = new Map<string, THREE.Material>();
function canonicalMaterial(kit: Kit, mat: THREE.Material): THREE.Material {
  const s = mat as THREE.MeshStandardMaterial;
  if (!s.isMeshStandardMaterial) return mat;
  const key = `${kit}|${s.name}|${s.color.getHexString()}|${s.map ? "map" : ""}|${s.transparent ? "t" : ""}|${s.vertexColors ? "vc" : ""}`;
  const hit = canonical.get(key);
  if (hit) {
    if (s !== hit) {
      s.map?.dispose();
      s.dispose();
    }
    return hit;
  }
  s.roughness = Math.max(s.roughness, 0.75);
  s.metalness = 0;
  canonical.set(key, s);
  return s;
}

export function loadModel(kit: Kit, name: string): Promise<THREE.Group> {
  const key = modelKey(kit, name);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(key);
  if (!p) {
    p = loader.loadAsync(`${BASE}${kit}/${name}.glb`).then((gltf) => {
      const g = gltf.scene;
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
          if (Array.isArray(m.material)) m.material = m.material.map((x) => canonicalMaterial(kit, x));
          else m.material = canonicalMaterial(kit, m.material);
        }
      });
      if (kit === "nature") warmFoliage(g);
      cache.set(key, g);
      return g;
    });
    // A failed download must be retryable later (flaky network).
    p.catch(() => pending.delete(key));
    pending.set(key, p);
  }
  return p;
}

/** Load many models. With `strict`, a failure rejects (callers then don't build half a stage). */
export async function preload(list: [Kit, string][], onProgress?: (done: number, total: number) => void, strict = false) {
  let done = 0;
  let failed: unknown = null;
  await Promise.all(
    list.map(([kit, name]) =>
      loadModel(kit, name)
        .catch((e) => {
          console.warn("model failed", kit, name, e);
          failed = e;
        })
        .finally(() => onProgress?.(++done, list.length)),
    ),
  );
  if (strict && failed) throw failed;
}

/** Synchronous clone of a preloaded model. Throws if it was never loaded. */
export function model(kit: Kit, name: string, scale = 1): THREE.Group {
  const src = cache.get(modelKey(kit, name));
  if (!src) throw new Error(`model not preloaded: ${kit}/${name}`);
  const g = src.clone(true);
  g.scale.setScalar(scale);
  return g;
}

export function hasModel(kit: Kit, name: string) {
  return cache.has(modelKey(kit, name));
}

// ---------------------------------------------------------------------------
// Roof recolouring. Fantasy-town meshes sample flat swatches from one colour map;
// roofs use the red swatches. We bake the sampled colours into vertex colours and
// swap the roof swatch for the requested colour.

let swatchData: { data: Uint8ClampedArray; w: number; h: number } | null = null;
const tintedGeo = new Map<string, THREE.BufferGeometry>();
const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });

function sampleMap(tex: THREE.Texture) {
  if (swatchData) return swatchData;
  const img = tex.image as HTMLImageElement | ImageBitmap;
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img as CanvasImageSource, 0, 0);
  swatchData = { data: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
  return swatchData;
}

/** Recolour the roof swatches of a fantasy-town model clone in place. */
export function tintRoof(obj: THREE.Object3D, hex: number) {
  const target = new THREE.Color(hex);
  const thsl = { h: 0, s: 0, l: 0 };
  target.getHSL(thsl);
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (!mat.map) return;
    const key = `${m.geometry.uuid}|${hex}`;
    let geo = tintedGeo.get(key);
    if (!geo) {
      const sw = sampleMap(mat.map);
      geo = m.geometry.clone();
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      const colors = new Float32Array(uv.count * 3);
      const c = new THREE.Color();
      const hsl = { h: 0, s: 0, l: 0 };
      for (let i = 0; i < uv.count; i++) {
        const u = THREE.MathUtils.clamp(uv.getX(i), 0, 0.9999);
        const v = THREE.MathUtils.clamp(mat.map.flipY ? 1 - uv.getY(i) : uv.getY(i), 0, 0.9999);
        const px = Math.floor(u * sw.w);
        const py = Math.floor(v * sw.h);
        const j = (py * sw.w + px) * 4;
        c.setRGB(sw.data[j] / 255, sw.data[j + 1] / 255, sw.data[j + 2] / 255, THREE.SRGBColorSpace);
        c.getHSL(hsl, THREE.SRGBColorSpace);
        // Roof swatches are red on some pieces and teal on others.
        const reddish = (hsl.h < 0.035 || hsl.h > 0.94) && hsl.s > 0.35 && hsl.l > 0.35 && hsl.l < 0.7;
        const teal = hsl.h > 0.39 && hsl.h < 0.5 && hsl.s > 0.3 && hsl.l > 0.35 && hsl.l < 0.7;
        if (reddish || teal) {
          c.setHSL(thsl.h, thsl.s * 0.78, THREE.MathUtils.clamp(thsl.l + 0.08 + (hsl.l - 0.55) * 0.8, 0.05, 0.9), THREE.SRGBColorSpace);
        }
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      tintedGeo.set(key, geo);
    }
    m.geometry = geo;
    m.material = vcMat;
  });
}

// ---------------------------------------------------------------------------
// Instancing: many copies of one model become one InstancedMesh per sub-mesh.

export interface Placement {
  x: number;
  y?: number;
  z: number;
  rotY?: number;
  scale?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

export function instanced(kit: Kit, name: string, placements: Placement[], baseScale = 1, shadows = true): THREE.Group {
  const group = new THREE.Group();
  if (!placements.length) return group;
  const src = cache.get(modelKey(kit, name));
  if (!src) throw new Error(`model not preloaded: ${kit}/${name}`);
  src.updateMatrixWorld(true);
  const tmp = new THREE.Matrix4();
  const place = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  src.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, placements.length);
    placements.forEach((pl, i) => {
      const k = (pl.scale ?? 1) * baseScale;
      q.setFromAxisAngle(up, pl.rotY ?? 0);
      s.set(k * (pl.sx ?? 1), k * (pl.sy ?? 1), k * (pl.sz ?? 1));
      p.set(pl.x, pl.y ?? 0, pl.z);
      place.compose(p, q, s);
      tmp.multiplyMatrices(place, mesh.matrixWorld);
      inst.setMatrixAt(i, tmp);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = shadows;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    group.add(inst);
  });
  return group;
}

/** Bounding box of a preloaded model at scale 1 (model space). */
export function modelBounds(kit: Kit, name: string): THREE.Box3 {
  const src = cache.get(modelKey(kit, name));
  if (!src) throw new Error(`model not preloaded: ${kit}/${name}`);
  return new THREE.Box3().setFromObject(src);
}

/** Clone a model re-centred so its footprint centre sits at the origin, base at y=0. */
export function centered(kit: Kit, name: string, scale = 1): THREE.Group {
  const inner = model(kit, name, scale);
  const box = new THREE.Box3().setFromObject(inner);
  const c = box.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -box.min.y, -c.z);
  const outer = new THREE.Group();
  outer.add(inner);
  outer.userData.size = box.getSize(new THREE.Vector3());
  return outer;
}

/**
 * Merge every static mesh under `root` into one mesh per material (geometry baked
 * into root's space). Cuts hundreds of draw calls for buildings made of modules.
 * Meshes with `userData.noMerge`, instanced meshes and multi-material meshes stay.
 */
export function mergeStatic(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean; meshes: THREE.Mesh[] }>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material) || m.userData.noMerge) return;
    const attrs = Object.keys(m.geometry.attributes).sort().join(",");
    const key = `${m.material.uuid}|${attrs}|${m.geometry.index ? "i" : "n"}`;
    let b = buckets.get(key);
    if (!b) {
      b = { mat: m.material, geos: [], cast: m.castShadow, meshes: [] };
      buckets.set(key, b);
    }
    const g = m.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    b.geos.push(g);
    b.meshes.push(m);
  });
  for (const b of buckets.values()) {
    if (b.meshes.length < 2) continue;
    const merged = mergeGeometries(b.geos, false);
    if (!merged) continue;
    for (const m of b.meshes) m.parent?.remove(m);
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  // Drop empty groups left behind.
  const empty: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o !== root && !(o as THREE.Mesh).isMesh && o.children.length === 0 && o.type === "Group") empty.push(o);
  });
  for (const e of empty) e.parent?.remove(e);
}
