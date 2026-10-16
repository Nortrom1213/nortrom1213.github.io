import * as THREE from "three";
import type { Sky } from "./sky";

export type WeatherKind = "clear" | "cloudy" | "rain" | "snow" | "breeze";

const LABEL: Record<WeatherKind, string> = {
  clear: "Clear",
  cloudy: "Cloudy",
  rain: "Rain",
  snow: "Snow",
  breeze: "Breezy",
};

/** Particle weather around the camera plus drifting low-poly clouds. */
export class Weather {
  kind: WeatherKind = "clear";
  readonly group = new THREE.Group();
  private rain: THREE.LineSegments;
  private snow: THREE.Points;
  private leaves: THREE.InstancedMesh;
  private clouds: THREE.Group;
  private rainPos: Float32Array;
  private snowPos: Float32Array;
  private leafState: { p: THREE.Vector3; v: THREE.Vector3; r: number; s: number }[] = [];
  private amount = 0; // fades particles in/out
  private timer = 0;
  private readonly R = 30;
  private dummy = new THREE.Object3D();

  constructor(lowQuality: boolean) {
    const nRain = lowQuality ? 700 : 1600;
    this.rainPos = new Float32Array(nRain * 6);
    for (let i = 0; i < nRain; i++) this.respawnDrop(i, true);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaac4dd, transparent: true, opacity: 0, depthWrite: false }));
    this.rain.frustumCulled = false;

    const nSnow = lowQuality ? 500 : 1100;
    this.snowPos = new Float32Array(nSnow * 3);
    for (let i = 0; i < nSnow; i++) {
      this.snowPos[i * 3] = (Math.random() - 0.5) * this.R * 2;
      this.snowPos[i * 3 + 1] = Math.random() * 22;
      this.snowPos[i * 3 + 2] = (Math.random() - 0.5) * this.R * 2;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(this.snowPos, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0, depthWrite: false }));
    this.snow.frustumCulled = false;

    const nLeaf = 60;
    const leafGeo = new THREE.PlaneGeometry(0.18, 0.12);
    this.leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0xe0903a, side: THREE.DoubleSide, roughness: 0.9 }), nLeaf);
    const leafColors = [0xe0903a, 0xd0602a, 0xe8b84a, 0x9ab04a];
    for (let i = 0; i < nLeaf; i++) {
      this.leafState.push({ p: new THREE.Vector3((Math.random() - 0.5) * 50, Math.random() * 10, (Math.random() - 0.5) * 50), v: new THREE.Vector3(), r: Math.random() * 6, s: 0.5 + Math.random() });
      this.leaves.setColorAt(i, new THREE.Color(leafColors[i % leafColors.length]));
    }
    this.leaves.frustumCulled = false;
    this.leaves.visible = false;

    this.clouds = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + Math.random() * 4, 0), cloudMat);
        m.position.set(j * 5 - n * 2.5, Math.random() * 2, (Math.random() - 0.5) * 4);
        m.scale.y = 0.6;
        c.add(m);
      }
      const a = Math.random() * Math.PI * 2;
      const d = 60 + Math.random() * 90;
      c.position.set(Math.cos(a) * d, 45 + Math.random() * 20, Math.sin(a) * d);
      this.clouds.add(c);
    }
    this.group.add(this.rain, this.snow, this.leaves, this.clouds);
    this.pickRandom(true);
  }

  label() {
    return LABEL[this.kind];
  }

  set(kind: WeatherKind) {
    this.kind = kind;
    this.timer = 240 + Math.random() * 300;
  }

  private pickRandom(initial = false) {
    const month = new Date().getMonth();
    const winter = month === 11 || month <= 2;
    const autumn = month >= 8 && month <= 10;
    const r = Math.random();
    let k: WeatherKind = "clear";
    if (r < 0.42) k = "clear";
    else if (r < 0.6) k = autumn ? "breeze" : "cloudy";
    else if (r < 0.78) k = "cloudy";
    else if (r < 0.92) k = winter ? "snow" : "rain";
    else k = winter ? "rain" : "breeze";
    if (initial && k === "rain" && Math.random() < 0.5) k = "clear";
    this.set(k);
  }

  private respawnDrop(i: number, anyHeight: boolean) {
    const x = (Math.random() - 0.5) * this.R * 2;
    const z = (Math.random() - 0.5) * this.R * 2;
    const y = anyHeight ? Math.random() * 24 : 20 + Math.random() * 6;
    const o = i * 6;
    this.rainPos[o] = x;
    this.rainPos[o + 1] = y;
    this.rainPos[o + 2] = z;
    this.rainPos[o + 3] = x - 0.05;
    this.rainPos[o + 4] = y - 0.55;
    this.rainPos[o + 5] = z;
  }

  /** Rain amount and wind for audio, 0..1. */
  audioLevels() {
    return {
      rain: this.kind === "rain" ? this.amount : 0,
      wind: this.kind === "breeze" ? 0.8 : this.kind === "snow" ? 0.5 : this.kind === "cloudy" ? 0.3 : 0.1,
    };
  }

  update(dt: number, center: THREE.Vector3, sky: Sky) {
    this.timer -= dt;
    if (this.timer <= 0) this.pickRandom();
    const wantOvercast = this.kind === "rain" ? 0.85 : this.kind === "snow" ? 0.6 : this.kind === "cloudy" ? 0.45 : 0;
    sky.overcast += (wantOvercast - sky.overcast) * Math.min(1, dt * 0.4);
    const precip = this.kind === "rain" || this.kind === "snow";
    this.amount += ((precip ? 1 : 0) - this.amount) * Math.min(1, dt * 0.5);

    this.rain.position.set(center.x, 0, center.z);
    this.snow.position.set(center.x, 0, center.z);
    const rm = this.rain.material as THREE.LineBasicMaterial;
    rm.opacity = this.kind === "rain" ? this.amount * 0.55 : 0;
    this.rain.visible = rm.opacity > 0.01;
    if (this.rain.visible) {
      const n = this.rainPos.length / 6;
      for (let i = 0; i < n; i++) {
        const o = i * 6;
        this.rainPos[o + 1] -= 26 * dt;
        this.rainPos[o + 4] -= 26 * dt;
        this.rainPos[o] -= 1.2 * dt;
        this.rainPos[o + 3] -= 1.2 * dt;
        if (this.rainPos[o + 4] < 0) this.respawnDrop(i, false);
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    const sm = this.snow.material as THREE.PointsMaterial;
    sm.opacity = this.kind === "snow" ? this.amount * 0.9 : 0;
    this.snow.visible = sm.opacity > 0.01;
    if (this.snow.visible) {
      const n = this.snowPos.length / 3;
      const t = performance.now() / 1000;
      for (let i = 0; i < n; i++) {
        const o = i * 3;
        this.snowPos[o + 1] -= 1.4 * dt;
        this.snowPos[o] += Math.sin(t + i) * 0.3 * dt;
        if (this.snowPos[o + 1] < 0) this.snowPos[o + 1] = 20;
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }

    this.leaves.visible = this.kind === "breeze";
    if (this.leaves.visible) {
      const t = performance.now() / 1000;
      this.leafState.forEach((l, i) => {
        l.p.x += (2.2 + Math.sin(t * 0.7 + i) * 0.8) * dt * l.s;
        l.p.y -= (0.5 + Math.sin(t * 2 + i) * 0.4) * dt;
        l.p.z += Math.cos(t * 0.5 + i * 3) * 0.8 * dt;
        l.r += dt * 3 * l.s;
        if (l.p.y < 0 || l.p.x - center.x > 26) {
          l.p.set(center.x - 25, 4 + Math.random() * 8, center.z + (Math.random() - 0.5) * 50);
        }
        this.dummy.position.copy(l.p);
        this.dummy.rotation.set(l.r, l.r * 0.7, l.r * 0.3);
        this.dummy.updateMatrix();
        this.leaves.setMatrixAt(i, this.dummy.matrix);
      });
      this.leaves.instanceMatrix.needsUpdate = true;
    }

    // Clouds drift; greyer when overcast, tinted at night.
    const cloudCol = new THREE.Color(0xffffff).lerp(new THREE.Color(0x8a909a), sky.overcast).multiplyScalar(1 - sky.night * 0.7);
    this.clouds.children.forEach((c, i) => {
      c.position.x += (1 + (i % 3) * 0.5) * dt;
      if (c.position.x > 180) c.position.x = -180;
      c.visible = i < 6 + sky.overcast * 10;
      ((c.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.copy(cloudCol);
    });
  }
}
