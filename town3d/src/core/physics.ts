import * as THREE from "three";

// Tiny character physics: a vertical cylinder body against axis-aligned boxes and
// vertical cylinders, with gravity, step-up and landing on box tops. Enough for a
// walkable town, interiors and a platforming tower, and cheap on phones.

export interface Box {
  min: THREE.Vector3;
  max: THREE.Vector3;
  /** Camera rays ignore boxes with noCamera (thin props, interior walls). */
  noCamera?: boolean;
  tag?: string;
}

export interface Cylinder {
  x: number;
  z: number;
  r: number;
  y0: number;
  y1: number;
  tag?: string;
}

export class PhysicsWorld {
  boxes: Box[] = [];
  cylinders: Cylinder[] = [];
  /** Keep the player inside a circle (outdoor) or rectangle (interiors). */
  boundsCircle?: { x: number; z: number; r: number };
  boundsRect?: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Below this height the controller reports a fall (tower). */
  killY = -50;
  groundHeight: (x: number, z: number) => number = () => 0;

  addBox(cx: number, cz: number, sx: number, sz: number, y0 = 0, y1 = 3, opts: Partial<Box> = {}): Box {
    const b: Box = {
      min: new THREE.Vector3(cx - sx / 2, y0, cz - sz / 2),
      max: new THREE.Vector3(cx + sx / 2, y1, cz + sz / 2),
      ...opts,
    };
    this.boxes.push(b);
    return b;
  }

  addCylinder(x: number, z: number, r: number, y0 = 0, y1 = 3, tag?: string): Cylinder {
    const c = { x, z, r, y0, y1, tag };
    this.cylinders.push(c);
    return c;
  }

  removeTagged(tag: string) {
    this.boxes = this.boxes.filter((b) => b.tag !== tag);
    this.cylinders = this.cylinders.filter((c) => c.tag !== tag);
  }

  /** Distance along a ray (origin + dir * t) to the first camera-blocking box, or maxT. */
  raycastBoxes(origin: THREE.Vector3, dir: THREE.Vector3, maxT: number): number {
    let best = maxT;
    for (const b of this.boxes) {
      if (b.noCamera) continue;
      let tmin = 0;
      let tmax = best;
      let hit = true;
      for (const axis of ["x", "y", "z"] as const) {
        const o = origin[axis];
        const d = dir[axis];
        const lo = b.min[axis];
        const hi = b.max[axis];
        if (Math.abs(d) < 1e-6) {
          if (o < lo || o > hi) {
            hit = false;
            break;
          }
        } else {
          let t1 = (lo - o) / d;
          let t2 = (hi - o) / d;
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) {
            hit = false;
            break;
          }
        }
      }
      if (hit && tmin > 0 && tmin < best) best = tmin;
    }
    // Tall cylinders (trees) block the camera with their canopy width.
    const dl = Math.hypot(dir.x, dir.z);
    if (dl > 1e-4) {
      for (const c of this.cylinders) {
        if (c.y1 < 5.5) continue;
        const r = 1.7;
        const ox = origin.x - c.x;
        const oz = origin.z - c.z;
        const a = dir.x * dir.x + dir.z * dir.z;
        const b = 2 * (ox * dir.x + oz * dir.z);
        const cc = ox * ox + oz * oz - r * r;
        const disc = b * b - 4 * a * cc;
        if (disc < 0 || cc < 0) continue;
        const t = (-b - Math.sqrt(disc)) / (2 * a);
        if (t > 0 && t < best && origin.y + dir.y * t < c.y1 + 1.5) best = t;
      }
    }
    return best;
  }
}

const STEP_UP = 0.36;
const SKIN = 0.001;

export class CharacterController {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  radius = 0.35;
  height = 1.5;
  onGround = true;
  /** Seconds since leaving the ground; used for coyote-time jumps. */
  airTime = 0;
  jumpBuffer = 0;
  gravity = 26;
  jumpSpeed = 9.2;
  /** Set when the controller fell below world.killY this step. */
  fell = false;
  /** Velocity at the moment of landing (negative y), for land effects. */
  landedSpeed = 0;

  step(dt: number, wish: THREE.Vector2, wantJump: boolean, world: PhysicsWorld, accel = 14) {
    this.fell = false;
    this.landedSpeed = 0;
    if (wantJump) this.jumpBuffer = 0.14;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    const control = this.onGround ? accel : accel * 0.55;
    const k = 1 - Math.exp(-control * dt);
    this.vel.x += (wish.x - this.vel.x) * k;
    this.vel.z += (wish.y - this.vel.z) * k;

    if (this.jumpBuffer > 0 && (this.onGround || this.airTime < 0.12)) {
      this.vel.y = this.jumpSpeed;
      this.onGround = false;
      this.airTime = 1;
      this.jumpBuffer = 0;
    }
    this.vel.y -= this.gravity * dt;
    this.vel.y = Math.max(this.vel.y, -40);

    const steps = Math.max(1, Math.ceil((Math.hypot(this.vel.x, this.vel.z) * dt) / 0.2));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.pos.x += this.vel.x * h;
      this.pos.z += this.vel.z * h;
      this.resolveHorizontal(world);
    }
    this.resolveVertical(dt, world);
    this.applyBounds(world);
    if (this.pos.y < world.killY) this.fell = true;
  }

  private resolveHorizontal(world: PhysicsWorld) {
    const p = this.pos;
    const r = this.radius;
    const feet = p.y + STEP_UP;
    const head = p.y + this.height;
    for (const b of world.boxes) {
      if (b.max.y <= feet || b.min.y >= head) continue;
      const cx = Math.max(b.min.x, Math.min(p.x, b.max.x));
      const cz = Math.max(b.min.z, Math.min(p.z, b.max.z));
      let dx = p.x - cx;
      let dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        const push = r - d + SKIN;
        p.x += (dx / d) * push;
        p.z += (dz / d) * push;
        const n = dx / d * this.vel.x + dz / d * this.vel.z;
        if (n < 0) {
          this.vel.x -= (dx / d) * n;
          this.vel.z -= (dz / d) * n;
        }
      } else {
        // Centre inside the box: leave by the nearest face.
        const exits = [
          [b.min.x - r - p.x, 0],
          [b.max.x + r - p.x, 0],
          [0, b.min.z - r - p.z],
          [0, b.max.z + r - p.z],
        ];
        exits.sort((a, c) => Math.hypot(a[0], a[1]) - Math.hypot(c[0], c[1]));
        p.x += exits[0][0];
        p.z += exits[0][1];
      }
    }
    for (const c of world.cylinders) {
      if (c.y1 <= feet || c.y0 >= head) continue;
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const min = r + c.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 1e-4;
      const push = min - d + SKIN;
      p.x += (dx / d) * push;
      p.z += (dz / d) * push;
    }
  }

  private resolveVertical(dt: number, world: PhysicsWorld) {
    const p = this.pos;
    const prevY = p.y;
    const nextY = p.y + this.vel.y * dt;
    // Highest support under the body: terrain or a box top we were above.
    let support = world.groundHeight(p.x, p.z);
    const r = this.radius * 0.8;
    for (const b of world.boxes) {
      if (p.x + r <= b.min.x || p.x - r >= b.max.x || p.z + r <= b.min.z || p.z - r >= b.max.z) continue;
      if (b.max.y <= prevY + STEP_UP + 0.01 && b.max.y > support) support = b.max.y;
    }
    for (const c of world.cylinders) {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      if (dx * dx + dz * dz > (c.r + r) * (c.r + r)) continue;
      if (c.y1 <= prevY + STEP_UP + 0.01 && c.y1 > support) support = c.y1;
    }
    if (this.vel.y > 0) {
      // Bump the head on box undersides.
      for (const b of world.boxes) {
        if (p.x + r <= b.min.x || p.x - r >= b.max.x || p.z + r <= b.min.z || p.z - r >= b.max.z) continue;
        if (b.min.y >= prevY + this.height - 0.01 && b.min.y < nextY + this.height) {
          this.vel.y = 0;
          p.y = b.min.y - this.height;
          return;
        }
      }
    }
    if (nextY <= support) {
      if (!this.onGround) this.landedSpeed = this.vel.y;
      // Snap up small steps while grounded; otherwise land.
      p.y = support;
      this.vel.y = 0;
      this.onGround = true;
      this.airTime = 0;
    } else if (this.onGround && this.vel.y <= 0 && nextY - support < STEP_UP && prevY - support < STEP_UP) {
      // Walking down a small step: stick to the ground.
      p.y = support;
      this.vel.y = 0;
    } else {
      p.y = nextY;
      this.onGround = false;
      this.airTime += dt;
    }
  }

  private applyBounds(world: PhysicsWorld) {
    const p = this.pos;
    if (world.boundsCircle) {
      const { x, z, r } = world.boundsCircle;
      const dx = p.x - x;
      const dz = p.z - z;
      const d = Math.hypot(dx, dz);
      if (d > r) {
        p.x = x + (dx / d) * r;
        p.z = z + (dz / d) * r;
      }
    }
    if (world.boundsRect) {
      const b = world.boundsRect;
      p.x = Math.min(Math.max(p.x, b.minX + this.radius), b.maxX - this.radius);
      p.z = Math.min(Math.max(p.z, b.minZ + this.radius), b.maxZ - this.radius);
    }
  }
}
