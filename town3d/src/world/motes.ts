import * as THREE from "three";
import { radialTexture } from "./town";

/** Sunlit dust / pollen drifting around the player by day (soft additive points). */
export class Motes {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private seed: Float32Array;
  private readonly R = 16;

  constructor(count: number) {
    this.pos = new Float32Array(count * 3);
    this.seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * this.R * 2;
      this.pos[i * 3 + 1] = 0.4 + Math.random() * 5;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * this.R * 2;
      this.seed[i] = Math.random() * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(
      g,
      new THREE.PointsMaterial({ map: radialTexture(), color: 0xfff2c0, size: 0.16, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.points.frustumCulled = false;
  }

  update(dt: number, t: number, center: THREE.Vector3, night: number, overcast: number) {
    const m = this.points.material as THREE.PointsMaterial;
    m.opacity = (1 - night) * (1 - overcast) * 0.55;
    this.points.visible = m.opacity > 0.02;
    if (!this.points.visible) return;
    const n = this.seed.length;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const s = this.seed[i];
      this.pos[o] += (Math.sin(t * 0.3 + s) * 0.25 + 0.12) * dt;
      this.pos[o + 1] += Math.sin(t * 0.7 + s * 1.7) * 0.12 * dt;
      this.pos[o + 2] += Math.cos(t * 0.25 + s) * 0.2 * dt;
      // Wrap around the player so the cloud follows them.
      const dx = this.pos[o] - center.x;
      const dz = this.pos[o + 2] - center.z;
      if (dx > this.R) this.pos[o] -= this.R * 2;
      if (dx < -this.R) this.pos[o] += this.R * 2;
      if (dz > this.R) this.pos[o + 2] -= this.R * 2;
      if (dz < -this.R) this.pos[o + 2] += this.R * 2;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
