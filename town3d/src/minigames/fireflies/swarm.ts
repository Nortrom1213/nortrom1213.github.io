import * as THREE from "three";
import { createNoise3 } from "./noise";

// The firefly swarm: one InstancedMesh of tiny bright cores plus one Points cloud of
// additive glow sprites. All simulation state lives in flat typed arrays; the hot
// loop allocates nothing and writes instance matrices + glow attributes in one pass.

export type SwarmMode = "perlin" | "random";

/** Swarm area: an ellipse covering the meadow and the pond. */
export const AREA = { x: -2, z: 36, rx: 15, rz: 10 };

const FIELD_SCALE = 0.085; // noise units per metre (~12 m features)
const FIELD_EPS = 0.05; // finite-difference step, noise units
const FIELD_TIME = 0.11; // how fast the shared field evolves
const FLOW = 1.15; // m/s per unit of curl
const MAX_FLOW = 2.6;
const FLEE_R = 2.3;
const ST_ACTIVE = 0;
const ST_JAR = 1;
const ST_HIDDEN = 2;

const VERT = /* glsl */ `
  attribute float aGlow;
  attribute float aSize;
  uniform float uScale;
  varying float vGlow;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (0.55 + 0.45 * aGlow) * uScale / max(-mv.z, 0.5);
    vGlow = aGlow;
  }`;

const FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec3 uColor;
  varying float vGlow;
  void main() {
    float a = texture2D(uTex, gl_PointCoord).a * vGlow;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * (1.0 + vGlow * 0.5), a);
    #include <colorspace_fragment>
  }`;

const smooth = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class FireflySwarm {
  mode: SwarmMode = "perlin";
  /** Set while a challenge runs: fireflies shy away from / get caught by this point (player feet). */
  catcher: THREE.Vector3 | null = null;
  onCatch: (() => void) | null = null;
  /** How far (m) and how strongly fireflies shy away from the catcher (difficulty). */
  fleeR = FLEE_R;
  fleeK = 2.8;
  /** Last simulation time, for the order-parameter probe. */
  private lastT = 0;

  readonly count: number;
  private noise = createNoise3(1213);
  private cores: THREE.InstancedMesh;
  private glows: THREE.Points;
  private glowMat: THREE.ShaderMaterial;
  private pos: Float32Array; // shared with the Points position attribute
  private vel: Float32Array;
  private glow: Float32Array;
  private phase: Float32Array;
  private freq: Float32Array;
  private thr: Float32Array;
  private fade: Float32Array;
  private timer: Float32Array;
  private state: Uint8Array;
  private mats: Float32Array;
  private visible = true;

  constructor(scene: THREE.Scene, count: number, glowTex: THREE.Texture) {
    this.count = count;
    const n = count;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.glow = new Float32Array(n);
    this.phase = new Float32Array(n);
    this.freq = new Float32Array(n);
    this.thr = new Float32Array(n);
    this.fade = new Float32Array(n).fill(1);
    this.timer = new Float32Array(n);
    this.state = new Uint8Array(n);
    const size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.place(i, null);
      this.phase[i] = Math.random() * Math.PI * 2;
      this.freq[i] = 1.4 + Math.random() * 2.2;
      this.thr[i] = Math.random();
      size[i] = 0.42 + Math.random() * 0.36;
    }

    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfbffc8, toneMapped: false, fog: false });
    this.cores = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 4), coreMat, n);
    this.cores.frustumCulled = false;
    this.cores.castShadow = false;
    this.cores.receiveShadow = false;
    this.cores.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mats = this.cores.instanceMatrix.array as Float32Array;
    for (let i = 0; i < n; i++) this.mats[i * 16 + 15] = 1; // rest of each matrix is written per frame

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", posAttr);
    geo.setAttribute("aGlow", new THREE.BufferAttribute(this.glow, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    this.glowMat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: glowTex }, uColor: { value: new THREE.Color(0xc6ff5c) }, uScale: { value: 600 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.glows = new THREE.Points(geo, this.glowMat);
    this.glows.frustumCulled = false;
    this.glows.renderOrder = 5;
    scene.add(this.cores, this.glows);
  }

  setVisible(v: boolean) {
    if (v === this.visible) return;
    this.visible = v;
    this.cores.visible = v;
    this.glows.visible = v;
  }

  /** Drop firefly i at a random spot in the area (away from `avoid` if given). */
  private place(i: number, avoid: THREE.Vector3 | null) {
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.88;
      x = AREA.x + Math.cos(a) * r * AREA.rx;
      z = AREA.z + Math.sin(a) * r * AREA.rz;
      if (!avoid || (x - avoid.x) ** 2 + (z - avoid.z) ** 2 > 36) break;
    }
    const o = i * 3;
    this.pos[o] = x;
    this.pos[o + 1] = 0.7 + Math.random() * 1.9;
    this.pos[o + 2] = z;
    this.vel[o] = this.vel[o + 1] = this.vel[o + 2] = 0;
  }

  /**
   * @param vis 0..1 how "out" the fireflies are (night fade); a fraction come out first.
   * @param uScale drawing-buffer height / (2 tan(fov/2)) for perspective point sizes.
   */
  update(dt: number, t: number, vis: number, uScale: number) {
    this.glowMat.uniforms.uScale.value = uScale;
    this.lastT = t;
    const fleeR = this.fleeR;
    const fleeK = this.fleeK;
    const n = this.count;
    const pos = this.pos;
    const vel = this.vel;
    const mats = this.mats;
    const noise = this.noise;
    const perlin = this.mode === "perlin";
    const catcher = this.catcher;
    const T = t * FIELD_TIME;
    const steer = Math.min(1, dt * 2.2);
    const damp = 1 - Math.min(1, dt * 0.9);
    const bodyY = catcher ? catcher.y + 0.75 : 0;

    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const m = i * 16;
      const st = this.state[i];

      if (st === ST_HIDDEN) {
        this.timer[i] -= dt;
        if (this.timer[i] <= 0) {
          this.place(i, catcher);
          this.state[i] = ST_ACTIVE;
          this.fade[i] = 0;
        }
        this.glow[i] = 0;
        mats[m] = mats[m + 5] = mats[m + 10] = 0;
        continue;
      }

      if (st === ST_JAR) {
        // Zip into the jar at the player's hip, shrinking as it goes.
        this.timer[i] -= dt;
        const k = Math.min(1, dt * 9);
        if (catcher) {
          pos[o] += (catcher.x - pos[o]) * k;
          pos[o + 1] += (catcher.y + 1.0 - pos[o + 1]) * k;
          pos[o + 2] += (catcher.z - pos[o + 2]) * k;
        } else pos[o + 1] += dt * 2;
        const s = Math.max(0, this.timer[i] / 0.45);
        this.glow[i] = 0.4 + s * 0.6;
        mats[m] = mats[m + 5] = mats[m + 10] = s * 1.2;
        mats[m + 12] = pos[o];
        mats[m + 13] = pos[o + 1];
        mats[m + 14] = pos[o + 2];
        if (this.timer[i] <= 0) {
          this.state[i] = ST_HIDDEN;
          this.timer[i] = 3 + Math.random() * 2.5;
        }
        continue;
      }

      const x = pos[o];
      const y = pos[o + 1];
      const z = pos[o + 2];

      // Extra velocity: soft spring back into the ellipse + shyness near the player.
      let ex = 0;
      let ez = 0;
      const dx = x - AREA.x;
      const dz = z - AREA.z;
      const e = Math.sqrt((dx * dx) / (AREA.rx * AREA.rx) + (dz * dz) / (AREA.rz * AREA.rz));
      if (e > 0.8) {
        const d = Math.sqrt(dx * dx + dz * dz) + 1e-6;
        const k = (e - 0.8) * 12;
        ex -= (dx / d) * k;
        ez -= (dz / d) * k;
      }
      if (catcher) {
        const px = x - catcher.x;
        const pz = z - catcher.z;
        const d2 = px * px + pz * pz;
        if (d2 < fleeR * fleeR && d2 > 1e-4) {
          const d = Math.sqrt(d2);
          const k = (1 - d / fleeR) * fleeK;
          ex += (px / d) * k;
          ez += (pz / d) * k;
        }
      }

      let b: number;
      if (perlin) {
        // Every firefly reads the SAME time-evolving field: the curl of a scalar noise
        // potential gives a divergence-free flow, so neighbours glide together in ribbons.
        const fx = x * FIELD_SCALE;
        const fz = z * FIELD_SCALE;
        const n1 = noise(fx, fz + FIELD_EPS, T);
        const n2 = noise(fx, fz - FIELD_EPS, T);
        const n3 = noise(fx + FIELD_EPS, fz, T);
        const n4 = noise(fx - FIELD_EPS, fz, T);
        let tvx = ((n1 - n2) / (2 * FIELD_EPS)) * FLOW;
        let tvz = (-(n3 - n4) / (2 * FIELD_EPS)) * FLOW;
        const sp = Math.sqrt(tvx * tvx + tvz * tvz);
        if (sp > MAX_FLOW) {
          tvx *= MAX_FLOW / sp;
          tvz *= MAX_FLOW / sp;
        }
        const ph = this.phase[i];
        const wob = t * this.freq[i] * 0.6 + ph;
        tvx += Math.sin(wob) * 0.22 + ex;
        tvz += Math.cos(wob * 1.13) * 0.22 + ez;
        const alt = noise(fx * 1.4 + 17.3, fz * 1.4 - 5.1, T * 1.3);
        const tvy = (1.6 + alt * 1.1 - y) * 1.3;
        vel[o] += (tvx - vel[o]) * steer;
        vel[o + 1] += (tvy - vel[o + 1]) * steer;
        vel[o + 2] += (tvz - vel[o + 2]) * steer;
        // Synchronised blinking: the phase comes from the same field, so light waves
        // roll across the swarm.
        const psi = (n1 + n2 + n3 + n4) * 0.25;
        const s = Math.sin(t * 2.4 + psi * 8 + ph * 0.12);
        b = s > 0 ? s * s * s : 0;
      } else {
        // Independent random walk: everyone for themselves.
        vel[o] = (vel[o] + (Math.random() - 0.5) * 16 * dt + ex * dt * 3) * damp;
        vel[o + 1] = (vel[o + 1] + (Math.random() - 0.5) * 7 * dt + (1.6 + Math.sin(this.phase[i]) * 0.8 - y) * dt) * damp;
        vel[o + 2] = (vel[o + 2] + (Math.random() - 0.5) * 16 * dt + ez * dt * 3) * damp;
        const sp = Math.sqrt(vel[o] * vel[o] + vel[o + 2] * vel[o + 2]);
        if (sp > 2) {
          vel[o] *= 2 / sp;
          vel[o + 2] *= 2 / sp;
        }
        const s = Math.sin(t * this.freq[i] + this.phase[i]);
        b = s > 0 ? s * s * s : 0;
      }

      let ny = y + vel[o + 1] * dt;
      if (ny < 0.3) {
        ny = 0.3;
        vel[o + 1] = Math.abs(vel[o + 1]) * 0.5;
      } else if (ny > 3.3) {
        ny = 3.3;
        vel[o + 1] = -Math.abs(vel[o + 1]) * 0.5;
      }
      const nx = x + vel[o] * dt;
      const nz = z + vel[o + 2] * dt;
      pos[o] = nx;
      pos[o + 1] = ny;
      pos[o + 2] = nz;

      if (this.fade[i] < 1) this.fade[i] = Math.min(1, this.fade[i] + dt * 0.7);
      const th = this.thr[i] * 0.85;
      const a = smooth(vis, th, th + 0.15) * this.fade[i];

      if (catcher && a > 0.5) {
        const cx = nx - catcher.x;
        const cz = nz - catcher.z;
        if (cx * cx + cz * cz < 1.21 && Math.abs(ny - bodyY) < 1.6) {
          this.state[i] = ST_JAR;
          this.timer[i] = 0.45;
          this.onCatch?.();
        }
      }

      const g = 0.14 + 0.86 * b;
      this.glow[i] = a * g;
      const sc = a * (0.35 + 0.65 * g);
      mats[m] = mats[m + 5] = mats[m + 10] = sc;
      mats[m + 12] = nx;
      mats[m + 13] = ny;
      mats[m + 14] = nz;
    }

    this.cores.instanceMatrix.needsUpdate = true;
    const geo = this.glows.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aGlow.needsUpdate = true;
  }

  /** Direction of the shared curl-noise flow at (x, z) at sim time t (unnormalised). */
  private fieldAt(x: number, z: number, t: number): [number, number] {
    const T = t * FIELD_TIME;
    const fx = x * FIELD_SCALE;
    const fz = z * FIELD_SCALE;
    const n1 = this.noise(fx, fz + FIELD_EPS, T);
    const n2 = this.noise(fx, fz - FIELD_EPS, T);
    const n3 = this.noise(fx + FIELD_EPS, fz, T);
    const n4 = this.noise(fx - FIELD_EPS, fz, T);
    return [(n1 - n2) / (2 * FIELD_EPS), -(n3 - n4) / (2 * FIELD_EPS)];
  }

  /**
   * Local order parameter (Vicsek-style alignment within `radius` m): for each free
   * firefly, the length of the mean unit heading of itself and its neighbours,
   * averaged over the swarm. 1 = everyone nearby flies the same way.
   * `counter` is the counterfactual for the other mode at the same positions:
   * in Perlin mode the alignment independent random headings would give
   * (≈ sqrt(pi / 4k) for k neighbours); in random mode the alignment the shared
   * noise field would impose there.
   */
  orderParameter(radius = 3): { measured: number; counter: number; n: number } {
    const idx: number[] = [];
    for (let i = 0; i < this.count; i++) if (this.state[i] === ST_ACTIVE) idx.push(i);
    const m = idx.length;
    if (m < 2) return { measured: 0, counter: 0, n: m };
    const hx = new Float32Array(m);
    const hz = new Float32Array(m);
    const fx = new Float32Array(m);
    const fz = new Float32Array(m);
    for (let k = 0; k < m; k++) {
      const o = idx[k] * 3;
      const vx = this.vel[o];
      const vz = this.vel[o + 2];
      const l = Math.hypot(vx, vz) || 1;
      hx[k] = vx / l;
      hz[k] = vz / l;
      const [ax, az] = this.fieldAt(this.pos[o], this.pos[o + 2], this.lastT);
      const lf = Math.hypot(ax, az) || 1;
      fx[k] = ax / lf;
      fz[k] = az / lf;
    }
    const r2 = radius * radius;
    let sumM = 0;
    let sumC = 0;
    let used = 0;
    for (let a = 0; a < m; a++) {
      const oa = idx[a] * 3;
      let sx = 0;
      let sz = 0;
      let gx = 0;
      let gz = 0;
      let cnt = 0;
      for (let b = 0; b < m; b++) {
        const ob = idx[b] * 3;
        const dx = this.pos[oa] - this.pos[ob];
        const dz = this.pos[oa + 2] - this.pos[ob + 2];
        if (dx * dx + dz * dz > r2) continue;
        sx += hx[b];
        sz += hz[b];
        gx += fx[b];
        gz += fz[b];
        cnt++;
      }
      if (cnt < 2) continue;
      used++;
      sumM += Math.hypot(sx, sz) / cnt;
      sumC += this.mode === "perlin" ? Math.min(1, Math.sqrt(Math.PI / (4 * cnt))) : Math.hypot(gx, gz) / cnt;
    }
    if (!used) return { measured: 0, counter: 0, n: m };
    return { measured: sumM / used, counter: sumC / used, n: m };
  }

  /** Release any caught/hidden fireflies immediately (after a challenge). */
  releaseAll() {
    for (let i = 0; i < this.count; i++) {
      if (this.state[i] === ST_HIDDEN) this.timer[i] = Math.random() * 1.5;
    }
  }
}
