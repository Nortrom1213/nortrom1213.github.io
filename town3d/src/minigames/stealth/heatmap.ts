import * as THREE from "three";
import type { Grid } from "./grid";
import type { FieldLayer, PotentialFields } from "./fields";

// Floor overlay that makes the potential field visible: one thin glowing tile per
// walkable cell (a single InstancedMesh), additively blended so cold cells vanish
// into the dark floor and hot cells glow.

const RAMP = [0x070a1c, 0x1c3a8c, 0x169e8c, 0xf2c14e, 0xff4f38].map((h) => new THREE.Color(h));

/** Field value 0..1 -> ramp colour (linear space). */
export function rampColor(v: number, out: THREE.Color): THREE.Color {
  const x = THREE.MathUtils.clamp(v, 0, 1) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  return out.copy(RAMP[i]).lerp(RAMP[i + 1], x - i);
}

/** CSS gradient matching the ramp, for the HUD legend. */
export function rampCss(): string {
  const stops = RAMP.map((c, i) => `#${c.getHexString(THREE.SRGBColorSpace)} ${(i / (RAMP.length - 1)) * 100}%`);
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

export class Heatmap {
  readonly mesh: THREE.InstancedMesh;
  private shown: Float32Array;
  private mat: THREE.MeshBasicMaterial;
  private opacity = 0;
  on = false;
  layer: FieldLayer = "combined";
  private tmp = new THREE.Color();

  constructor(private grid: Grid) {
    const geo = new THREE.PlaneGeometry(0.9, 0.9);
    geo.rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cells = grid.open;
    this.mesh = new THREE.InstancedMesh(geo, this.mat, cells.length);
    const m = new THREE.Matrix4();
    cells.forEach((c, k) => {
      m.makeTranslation(grid.cx(c), 0.03, grid.cz(c));
      this.mesh.setMatrixAt(k, m);
      this.mesh.setColorAt(k, RAMP[0]);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.shown = new Float32Array(cells.length);
  }

  /** Per frame: ease displayed values toward the live field and fade the overlay. */
  update(dt: number, fields: PotentialFields) {
    const want = this.on ? 0.95 : 0;
    this.opacity += (want - this.opacity) * Math.min(1, dt * 6);
    this.mat.opacity = this.opacity;
    this.mesh.visible = this.opacity > 0.01;
    if (!this.mesh.visible) return;
    const k = Math.min(1, dt * 5);
    const cells = this.grid.open;
    for (let i = 0; i < cells.length; i++) {
      const v = fields.value(cells[i], this.layer);
      this.shown[i] += (v - this.shown[i]) * k;
      this.mesh.setColorAt(i, rampColor(this.shown[i], this.tmp));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  snap(fields: PotentialFields) {
    const cells = this.grid.open;
    for (let i = 0; i < cells.length; i++) this.shown[i] = fields.value(cells[i], this.layer);
  }
}
