import * as THREE from "three";
import { toonRamp } from "../core/toon";
import { onPath, groundHeight } from "./terrain";
import { BUILDINGS, POI, TILE, PLAY_RADIUS } from "./layout";
import { mulberry } from "./town";

// Instanced grass tufts that sway in the wind (vertex shader), plus a shared time
// uniform. Tufts avoid paths, the plaza, buildings and the pond.

const windUniforms = { uTime: { value: 0 }, uWind: { value: 1 } };

export function grassWind(t: number, strength: number) {
  windUniforms.uTime.value = t;
  windUniforms.uWind.value = strength;
}

/** Patch a toon material so vertices sway by their height above the base (`aSway` = 0..1). */
export function addWind(mat: THREE.Material, amp = 0.18) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uTime; uniform float uWind;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          float h = clamp(position.y / 0.55, 0.0, 1.0);
          float gust = sin(uTime * 1.7 + wp.x * 0.35 + wp.z * 0.22) * 0.6 + sin(uTime * 3.1 + wp.x * 1.3) * 0.25;
          transformed.x += gust * ${amp.toFixed(3)} * uWind * h * h;
          transformed.z += cos(uTime * 1.3 + wp.z * 0.4) * ${(amp * 0.5).toFixed(3)} * uWind * h * h;
        }`,
      );
  };
  mat.customProgramCacheKey = () => `wind${amp}`;
}

function tuftGeometry(): THREE.BufferGeometry {
  // Five tapered blades fanned around the centre.
  const pos: number[] = [];
  const col: number[] = [];
  const base = new THREE.Color(0x76a244);
  const tip = new THREE.Color(0xd2e48a);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + i * 0.4;
    const lean = 0.12 + (i % 2) * 0.08;
    const h = 0.38 + (i % 3) * 0.09;
    const w = 0.06;
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    const px = -cz * w;
    const pz = cx * w;
    const tx = cx * lean;
    const tz = cz * lean;
    pos.push(px, 0, pz, -px, 0, -pz, tx, h, tz);
    col.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // Point normals up so blades light like the ground they grow from.
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

export function buildGrass(count: number): THREE.InstancedMesh {
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp(), side: THREE.DoubleSide });
  addWind(mat, 0.16);
  const mesh = new THREE.InstancedMesh(tuftGeometry(), mat, count);
  const rnd = mulberry(42);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  const blocked = (x: number, z: number) => {
    if (onPath(x, z, 0.2)) return true;
    for (const b of BUILDINGS) {
      if (Math.abs(x - b.x) < (b.w * TILE) / 2 + 0.6 && Math.abs(z - b.z) < (b.d * TILE) / 2 + 0.6) return true;
    }
    const dx = (x - POI.pond.x) / (POI.pond.rx + 1.2);
    const dz = (z - POI.pond.z) / (POI.pond.rz + 1.2);
    return dx * dx + dz * dz < 1;
  };
  let n = 0;
  for (let tries = 0; n < count && tries < count * 6; tries++) {
    // Denser near the centre of town where the camera spends its time.
    const r = Math.pow(rnd(), 0.75) * (PLAY_RADIUS + 14);
    const a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (blocked(x, z)) continue;
    // Clumps: skip some spots based on a cheap noise so the field isn't uniform.
    if (Math.sin(x * 0.21) * Math.cos(z * 0.17) + Math.sin(x * 0.05 + z * 0.07) < -0.55) continue;
    const k = 0.42 + rnd() * 0.42;
    q.setFromAxisAngle(up, rnd() * Math.PI * 2);
    s.set(k * 1.2, k * (0.75 + rnd() * 0.5), k * 1.2);
    p.set(x, groundHeight(x, z), z);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    tint.setHSL(0.2 + rnd() * 0.08, 0.35, 0.78 + rnd() * 0.17);
    mesh.setColorAt(n, tint);
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}
