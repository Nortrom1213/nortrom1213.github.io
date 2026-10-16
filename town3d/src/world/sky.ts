import * as THREE from "three";

// Day/night cycle: gradient sky dome, sun + moon, stars, hemisphere and directional
// light, fog. One game hour lasts one real minute by default.

interface Key {
  h: number;
  top: number;
  horizon: number;
  sun: number;
  sunI: number;
  hemiI: number;
  fog: number;
}

const KEYS: Key[] = [
  { h: 0, top: 0x0b1030, horizon: 0x1c2550, sun: 0x8090ff, sunI: 0.35, hemiI: 0.35, fog: 0x141c3e },
  { h: 4.8, top: 0x10183a, horizon: 0x2a2f5a, sun: 0x8090ff, sunI: 0.3, hemiI: 0.35, fog: 0x1c2346 },
  { h: 6, top: 0x5a6aa8, horizon: 0xf0a080, sun: 0xffb27a, sunI: 0.9, hemiI: 0.6, fog: 0xd8a490 },
  { h: 8, top: 0x6aaee8, horizon: 0xcfe6f2, sun: 0xfff0d8, sunI: 2.1, hemiI: 0.95, fog: 0xc6dfe8 },
  { h: 12, top: 0x5aa6ec, horizon: 0xd2ecf6, sun: 0xfffaf0, sunI: 2.5, hemiI: 1.05, fog: 0xcde6ef },
  { h: 16.5, top: 0x62a4e0, horizon: 0xe2e6d8, sun: 0xffe8c0, sunI: 2.2, hemiI: 0.95, fog: 0xdce2d6 },
  { h: 18.3, top: 0x5a6ab0, horizon: 0xffa868, sun: 0xff9a50, sunI: 1.5, hemiI: 0.7, fog: 0xe8a878 },
  { h: 19.6, top: 0x2a2f6a, horizon: 0xb06070, sun: 0xff7a5a, sunI: 0.6, hemiI: 0.5, fog: 0x6a4a6a },
  { h: 21, top: 0x0e1436, horizon: 0x26305e, sun: 0x8090ff, sunI: 0.35, hemiI: 0.38, fog: 0x18204a },
  { h: 24, top: 0x0b1030, horizon: 0x1c2550, sun: 0x8090ff, sunI: 0.35, hemiI: 0.35, fog: 0x141c3e },
];

const ca = new THREE.Color();
const cb = new THREE.Color();
function lerpHex(a: number, b: number, t: number, out: THREE.Color) {
  ca.setHex(a);
  cb.setHex(b);
  return out.copy(ca).lerp(cb, t);
}

export class Sky {
  hour = 12;
  /** Real seconds per game hour. */
  secondsPerHour = 60;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly fog: THREE.Fog;
  readonly group = new THREE.Group();
  private dome: THREE.Mesh;
  private uniforms: { top: { value: THREE.Color }; horizon: { value: THREE.Color }; sunDir: { value: THREE.Vector3 }; sunColor: { value: THREE.Color } };
  private stars: THREE.Points;
  private moon: THREE.Mesh;
  private sunDisc: THREE.Mesh;
  /** 0 = full day, 1 = full night. */
  night = 0;
  /** Weather darkening 0..1 (set by Weather). */
  overcast = 0;
  readonly sunDir = new THREE.Vector3();

  constructor(shadowSize: number) {
    this.hour = new Date().getHours() + new Date().getMinutes() / 60;
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = shadowSize > 0;
    if (shadowSize > 0) {
      this.sun.shadow.mapSize.set(shadowSize, shadowSize);
      const s = 34;
      const cam = this.sun.shadow.camera;
      cam.left = -s;
      cam.right = s;
      cam.top = s;
      cam.bottom = -s;
      cam.near = 1;
      cam.far = 160;
      this.sun.shadow.bias = -0.0006;
      this.sun.shadow.normalBias = 0.04;
    }
    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5a7a4a, 1);
    this.fog = new THREE.Fog(0xcde6ef, 90, 260);

    this.uniforms = {
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color() },
    };
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.2, 1.0);
          float t = pow(max(h, 0.0), 0.55);
          vec3 col = mix(horizon, top, t);
          if (h < 0.0) col = mix(horizon, horizon * 0.7, -h * 4.0);
          float d = max(dot(vDir, normalize(sunDir)), 0.0);
          col += sunColor * (pow(d, 64.0) * 0.6 + pow(d, 6.0) * 0.18);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;

    const starGeo = new THREE.BufferGeometry();
    const pts: number[] = [];
    for (let i = 0; i < 700; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(Math.random() * 0.95);
      pts.push(Math.sin(v) * Math.cos(u) * 380, Math.cos(v) * 380, Math.sin(v) * Math.sin(u) * 380);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false;

    this.moon = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf4f0dc, fog: false }));
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff4d0, fog: false }));

    this.group.add(this.dome, this.stars, this.moon, this.sunDisc, this.hemi, this.sun, this.sun.target);
  }

  attach(scene: THREE.Scene) {
    scene.add(this.group);
    scene.fog = this.fog;
  }

  /** Jump to a given hour (used by "wait until night"). */
  setHour(h: number) {
    this.hour = ((h % 24) + 24) % 24;
  }

  update(dt: number, focus: THREE.Vector3, camera: THREE.Camera) {
    this.hour = (this.hour + dt / this.secondsPerHour) % 24;
    const h = this.hour;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const t = THREE.MathUtils.smoothstep(h, a.h, b.h);
    const oc = this.overcast;
    const grey = new THREE.Color(0x8a94a0);
    lerpHex(a.top, b.top, t, this.uniforms.top.value).lerp(grey.clone().multiplyScalar(1 - this.night * 0.8), oc * 0.6);
    lerpHex(a.horizon, b.horizon, t, this.uniforms.horizon.value).lerp(grey.clone().multiplyScalar(1.1 - this.night * 0.8), oc * 0.6);
    lerpHex(a.sun, b.sun, t, this.uniforms.sunColor.value);
    lerpHex(a.fog, b.fog, t, this.fog.color).lerp(grey.clone().multiplyScalar(1 - this.night * 0.75), oc * 0.55);
    this.fog.near = 90 - oc * 55;
    this.fog.far = 260 - oc * 120;

    // Sun path: rises in the east (+x) at 6, sets in the west at 18.
    const ang = ((h - 6) / 12) * Math.PI;
    this.sunDir.set(Math.cos(ang), Math.sin(ang), 0.35).normalize();
    const sunUp = this.sunDir.y;
    this.night = THREE.MathUtils.clamp(1 - (sunUp + 0.12) / 0.3, 0, 1);
    const moonDir = this.sunDir.clone().negate();
    moonDir.z = -0.3;
    moonDir.normalize();
    const lightDir = this.night > 0.5 ? moonDir : this.sunDir;

    this.uniforms.sunDir.value.copy(this.night > 0.5 ? moonDir : this.sunDir);
    if (this.night > 0.5) this.uniforms.sunColor.value.multiplyScalar(0.25);
    this.sun.color.copy(this.uniforms.sunColor.value);
    if (this.night > 0.5) this.sun.color.setHex(0x9aa8ff);
    const sunI = THREE.MathUtils.lerp(a.sunI, b.sunI, t);
    this.sun.intensity = sunI * (1 - oc * 0.6) * 0.95;
    // Toon shading needs a lower fill light or the ramp flattens out.
    this.hemi.intensity = THREE.MathUtils.lerp(a.hemiI, b.hemiI, t) * (1 - oc * 0.2) * 0.62;
    this.hemi.color.copy(this.uniforms.top.value).lerp(new THREE.Color(0xffffff), 0.55);
    this.hemi.groundColor.setHex(this.night > 0.5 ? 0x1a2236 : 0x5a6a42);

    // Lights and dome follow the player so shadows stay crisp near them.
    this.sun.position.copy(focus).addScaledVector(lightDir, 70);
    this.sun.target.position.copy(focus);
    this.dome.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    (this.stars.material as THREE.PointsMaterial).opacity = this.night * (1 - oc);
    this.sunDisc.position.copy(camera.position).addScaledVector(this.sunDir, 360);
    this.sunDisc.visible = sunUp > -0.1 && oc < 0.7;
    this.moon.position.copy(camera.position).addScaledVector(moonDir, 360);
    this.moon.visible = moonDir.y > -0.05 && oc < 0.8;
  }

  /** Colours for shaders that fake sky reflections (water). */
  get colors() {
    return { top: this.uniforms.top.value, horizon: this.uniforms.horizon.value, night: this.night, sunDir: this.uniforms.sunDir.value };
  }

  /** Label like "07:42" for the HUD. */
  clockLabel() {
    const hh = Math.floor(this.hour);
    const mm = Math.floor((this.hour - hh) * 60);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  phaseLabel() {
    const h = this.hour;
    if (h < 5) return "Night";
    if (h < 7.5) return "Dawn";
    if (h < 11.5) return "Morning";
    if (h < 14) return "Noon";
    if (h < 17.5) return "Afternoon";
    if (h < 20) return "Evening";
    return "Night";
  }
}
