import * as THREE from "three";

// Stylised shading: every lit material in a scene is swapped for a MeshToonMaterial
// with one shared 4-step ramp, so Kenney models and code-built props read as one
// art style. Conversions are cached per source material.

let ramp: THREE.DataTexture | null = null;

export function toonRamp(): THREE.DataTexture {
  if (ramp) return ramp;
  // Dark → mid → light → highlight, slightly lifted so shadows stay readable.
  const steps = [92, 158, 214, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  ramp = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

const converted = new WeakMap<THREE.Material, THREE.Material>();

function toToon(src: THREE.Material): THREE.Material {
  const hit = converted.get(src);
  if (hit) return hit;
  const s = src as THREE.MeshStandardMaterial;
  if (!(s.isMeshStandardMaterial || (s as unknown as THREE.MeshLambertMaterial).isMeshLambertMaterial) || s.userData.keepPBR) {
    converted.set(src, src);
    return src;
  }
  const t = new THREE.MeshToonMaterial({
    color: s.color,
    map: s.map,
    gradientMap: toonRamp(),
    emissive: s.emissive,
    emissiveIntensity: s.emissiveIntensity,
    emissiveMap: s.emissiveMap,
    vertexColors: s.vertexColors,
    transparent: s.transparent,
    opacity: s.opacity,
    side: s.side,
    alphaTest: s.alphaTest,
    depthWrite: s.depthWrite,
  });
  t.name = s.name;
  t.userData = { ...s.userData, toonFrom: s.uuid };
  // Code that kept a reference to the original material (window glow, screens,
  // fades) must keep working: share the Color objects and forward the numeric
  // fields that get animated.
  t.color = s.color;
  t.emissive = s.emissive;
  for (const key of ["emissiveIntensity", "opacity"] as const) {
    Object.defineProperty(s, key, {
      configurable: true,
      get: () => t[key],
      set: (v: number) => {
        t[key] = v;
      },
    });
  }
  converted.set(src, t);
  converted.set(t, t);
  return t;
}

/** Convert all lit materials under `root`. Idempotent and cheap to call again. */
export function toonify(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    if (Array.isArray(m.material)) m.material = m.material.map(toToon);
    else m.material = toToon(m.material);
  });
}

/**
 * Kenney's nature kit uses a cool teal for foliage; shift those swatches to warm
 * greens so trees sit with the grass. Applied once per loaded model.
 */
export function warmFoliage(root: THREE.Object3D) {
  const hsl = { h: 0, s: 0, l: 0 };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const s = mat as THREE.MeshStandardMaterial;
      if (!s.color || s.userData.warmed) continue;
      s.color.getHSL(hsl, THREE.SRGBColorSpace);
      if (hsl.h > 0.38 && hsl.h < 0.55 && hsl.s > 0.25) {
        // Teal → spring/olive green, keep relative lightness.
        const h = 0.24 + (hsl.h - 0.38) * 0.35;
        s.color.setHSL(h, Math.min(0.62, hsl.s * 0.9), THREE.MathUtils.clamp(hsl.l * 0.92, 0.18, 0.6), THREE.SRGBColorSpace);
      }
      s.userData.warmed = true;
    }
  });
}
