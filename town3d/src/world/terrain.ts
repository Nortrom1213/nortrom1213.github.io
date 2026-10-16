import * as THREE from "three";
import { HILLS_START, POI, pathNetwork, BUILDINGS, TILE } from "./layout";
import { toonRamp } from "../core/toon";

// Ground: one big plane with a hand-painted canvas texture (grass, paths, plaza,
// sand) and rolling hills outside the play area.

export const GROUND_SIZE = 260;

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise2(x: number, z: number) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, z: number) {
  return noise2(x, z) * 0.6 + noise2(x * 2.1, z * 2.1) * 0.3 + noise2(x * 4.3, z * 4.3) * 0.1;
}

export function groundHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r < HILLS_START) return 0;
  const t = THREE.MathUtils.smoothstep(r, HILLS_START, HILLS_START + 40);
  return t * (5 + fbm(x * 0.03, z * 0.03) * 16);
}

/** Distance from point to a polyline. */
export function distToPolyline(x: number, z: number, pts: [number, number][]) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

export function onPath(x: number, z: number, margin = 0) {
  for (const p of pathNetwork()) if (distToPolyline(x, z, p.pts) < p.w / 2 + margin) return true;
  return Math.hypot(x - POI.plaza.x, z - POI.plaza.z) < POI.plaza.r + margin;
}

export function buildGround(): THREE.Mesh {
  const RES = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = RES;
  const ctx = canvas.getContext("2d")!;
  const k = RES / GROUND_SIZE;
  const toPx = (x: number, z: number): [number, number] => [(x + GROUND_SIZE / 2) * k, (z + GROUND_SIZE / 2) * k];

  // Grass base with soft colour variation.
  ctx.fillStyle = "#7fb05a";
  ctx.fillRect(0, 0, RES, RES);
  const img = ctx.getImageData(0, 0, RES, RES);
  const step = 4;
  for (let py = 0; py < RES; py += step) {
    for (let px = 0; px < RES; px += step) {
      const x = px / k - GROUND_SIZE / 2;
      const z = py / k - GROUND_SIZE / 2;
      const n = fbm(x * 0.08, z * 0.08);
      const n2 = noise2(x * 0.9, z * 0.9);
      // Warm meadow greens with soft olive patches.
      const r = 96 + n * 38 + n2 * 8;
      const g = 142 + n * 28 + n2 * 8;
      const b = 62 + n * 14;
      for (let yy = 0; yy < step; yy++) {
        for (let xx = 0; xx < step; xx++) {
          const i = ((py + yy) * RES + px + xx) * 4;
          img.data[i] = r;
          img.data[i + 1] = g;
          img.data[i + 2] = b;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  // Sand ring around the pond.
  const pond = POI.pond;
  ctx.fillStyle = "#e3cf9a";
  ctx.beginPath();
  const [pcx, pcz] = toPx(pond.x, pond.z);
  ctx.ellipse(pcx, pcz, (pond.rx + 2.2) * k, (pond.rz + 2.2) * k, 0, 0, Math.PI * 2);
  ctx.fill();

  // Paths: darker edge, then lighter dirt.
  const drawPaths = (extra: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const p of pathNetwork()) {
      ctx.lineWidth = (p.w + extra) * k;
      ctx.beginPath();
      p.pts.forEach(([x, z], i) => {
        const [px, py] = toPx(x, z);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
  };
  drawPaths(1.0, "#9a8a5a");
  drawPaths(0, "#cdb27c");

  // Building aprons (packed earth) so doors meet paths cleanly.
  ctx.fillStyle = "#b8a070";
  for (const b of BUILDINGS) {
    const [x0, z0] = toPx(b.x - (b.w * TILE) / 2 - 1.2, b.z - (b.d * TILE) / 2 - 1.2);
    ctx.fillRect(x0, z0, (b.w * TILE + 2.4) * k, (b.d * TILE + 2.4) * k);
  }

  // Plaza: cobble circle with rings.
  const [cx, cz] = toPx(POI.plaza.x, POI.plaza.z);
  ctx.fillStyle = "#c9bca4";
  ctx.beginPath();
  ctx.arc(cx, cz, POI.plaza.r * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#a8987e";
  ctx.lineWidth = 0.18 * k;
  for (let r = 1.6; r < POI.plaza.r; r += 1.4) {
    ctx.beginPath();
    ctx.arc(cx, cz, r * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 1.6 * k, cz + Math.sin(a) * 1.6 * k);
    ctx.lineTo(cx + Math.cos(a) * POI.plaza.r * k, cz + Math.sin(a) * POI.plaza.r * k);
    ctx.stroke();
  }
  ctx.strokeStyle = "#8a7a62";
  ctx.lineWidth = 0.35 * k;
  ctx.beginPath();
  ctx.arc(cx, cz, POI.plaza.r * k, 0, Math.PI * 2);
  ctx.stroke();

  // Speckles for texture.
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * RES;
    const y = Math.random() * RES;
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(60,90,30,0.18)" : "rgba(255,255,220,0.12)";
    ctx.fillRect(x, y, 3, 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

  const geo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 130, 130);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toonRamp() });
  addGroundDetail(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;

  // Far skirt so the horizon never shows a hard edge.
  const skirt = new THREE.Mesh(new THREE.RingGeometry(GROUND_SIZE / 2 - 2, 600, 48, 1), new THREE.MeshStandardMaterial({ color: 0x6f9a50, roughness: 1 }));
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = 18;
  mesh.add(skirt);
  return mesh;
}

/** Tiled detail texture (blade strokes + pebbles) multiplied over the painted ground. */
function detailTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgb(200,200,200)";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const l = 150 + Math.random() * 105;
    g.strokeStyle = `rgb(${l},${l},${l})`;
    g.lineWidth = 1 + Math.random() * 1.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 4, y - 4 - Math.random() * 6);
    g.stroke();
  }
  for (let i = 0; i < 160; i++) {
    const l = 120 + Math.random() * 60;
    g.fillStyle = `rgb(${l},${l},${l})`;
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function addGroundDetail(mat: THREE.MeshToonMaterial) {
  const detail = detailTexture();
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tDetail = { value: detail };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
varying vec3 vWorldPos;`)
      .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
uniform sampler2D tDetail; varying vec3 vWorldPos;`)
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float d1 = texture2D(tDetail, vWorldPos.xz * 0.35).r;
        float d2 = texture2D(tDetail, vWorldPos.xz * 0.09 + 0.37).r;
        diffuseColor.rgb *= mix(0.86, 1.12, d1 * 0.6 + d2 * 0.4);`,
      );
  };
  mat.customProgramCacheKey = () => "ground-detail";
}

/** Stylised pond: depth tint, sky reflection, ripples, shoreline foam, sun glint. */
export function buildWater(): { mesh: THREE.Mesh; update: (t: number, sky: { top: THREE.Color; horizon: THREE.Color; night: number; sunDir: THREE.Vector3 }) => void } {
  const p = POI.pond;
  const geo = new THREE.CircleGeometry(1, 64);
  geo.rotateX(-Math.PI / 2);
  const uniforms = {
    uTime: { value: 0 },
    uSkyTop: { value: new THREE.Color(0x5aa6ec) },
    uSkyHorizon: { value: new THREE.Color(0xd2ecf6) },
    uNight: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uShallow: { value: new THREE.Color(0x4fb8b8) },
    uDeep: { value: new THREE.Color(0x1a5a7a) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: /* glsl */ `
      varying vec2 vLocal; varying vec3 vWorld;
      void main() {
        vLocal = position.xz;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uSkyTop; uniform vec3 uSkyHorizon; uniform float uNight;
      uniform vec3 uSunDir; uniform vec3 uShallow; uniform vec3 uDeep;
      varying vec2 vLocal; varying vec3 vWorld;
      void main() {
        float r = length(vLocal);
        // Ripple normal from a few travelling waves.
        vec2 q = vWorld.xz;
        float w1 = sin(q.x * 1.7 + uTime * 1.3) * cos(q.y * 1.3 - uTime * 1.1);
        float w2 = sin((q.x + q.y) * 3.1 - uTime * 2.2) * 0.5;
        vec3 n = normalize(vec3(w1 * 0.12 + w2 * 0.06, 1.0, cos(q.y * 2.3 + uTime) * 0.1));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 water = mix(uDeep, uShallow, smoothstep(0.55, 1.0, r));
        vec3 sky = mix(uSkyHorizon, uSkyTop, 0.35);
        vec3 col = mix(water, sky, 0.08 + fres * 0.35);
        // Sun / moon glint.
        vec3 h = normalize(normalize(uSunDir) + v);
        float spec = pow(max(dot(n, h), 0.0), 120.0);
        col += vec3(1.0, 0.95, 0.8) * spec * (1.2 - uNight * 0.7);
        // Foam ring at the shore, wobbling.
        float foamEdge = 0.955 + sin(atan(vLocal.y, vLocal.x) * 9.0 + uTime * 1.5) * 0.015;
        float foam = smoothstep(foamEdge - 0.025, foamEdge, r);
        col = mix(col, vec3(0.92, 0.97, 1.0), foam * 0.7);
        col *= 1.0 - uNight * 0.55;
        gl_FragColor = vec4(col, 0.92);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(p.rx, 1, p.rz);
  mesh.position.set(p.x, 0.06, p.z);
  return {
    mesh,
    update(t, sky) {
      uniforms.uTime.value = t;
      uniforms.uSkyTop.value.copy(sky.top);
      uniforms.uSkyHorizon.value.copy(sky.horizon);
      uniforms.uNight.value = sky.night;
      uniforms.uSunDir.value.copy(sky.sunDir);
    },
  };
}
