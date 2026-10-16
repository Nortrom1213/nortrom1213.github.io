import * as THREE from "three";
import type { PhysicsWorld } from "./physics";

export interface CameraLimits {
  minDist: number;
  maxDist: number;
  minPitch: number;
  maxPitch: number;
  /** Raycast against world boxes and pull in when blocked. */
  collide: boolean;
}

export const OUTDOOR_LIMITS: CameraLimits = { minDist: 3.5, maxDist: 16, minPitch: 0.08, maxPitch: 1.25, collide: true };
export const INTERIOR_LIMITS: CameraLimits = { minDist: 4, maxDist: 11, minPitch: 0.55, maxPitch: 1.3, collide: false };

/** Third-person orbit camera that follows a target with smoothing and collision. */
export class CameraRig {
  camera: THREE.PerspectiveCamera;
  yaw = 0; // camera sits south (+z) of the player, looking north
  pitch = 0.42;
  dist = 9;
  private curDist = 9;
  private focus = new THREE.Vector3();
  limits: CameraLimits = OUTDOOR_LIMITS;
  /** Optional fixed override (cutscenes, mini-game overviews). */
  override: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 600);
  }

  setLimits(l: CameraLimits) {
    this.limits = l;
    this.dist = THREE.MathUtils.clamp(this.dist, l.minDist, l.maxDist);
    this.pitch = THREE.MathUtils.clamp(this.pitch, l.minPitch, l.maxPitch);
  }

  snap(target: THREE.Vector3, yaw?: number) {
    if (yaw !== undefined) this.yaw = yaw;
    this.focus.copy(target).add(new THREE.Vector3(0, 1.3, 0));
    this.curDist = this.dist;
    this.apply(null);
  }

  look(dx: number, dy: number, zoom: number) {
    this.yaw -= dx * 0.0055;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, this.limits.minPitch, this.limits.maxPitch);
    if (zoom) this.dist = THREE.MathUtils.clamp(this.dist * (zoom > 0 ? 1.12 : 1 / 1.12), this.limits.minDist, this.limits.maxDist);
  }

  /** Gently swing behind the walking direction when the player isn't steering the camera. */
  autoFollow(moveYaw: number, dt: number, strength: number) {
    let d = moveYaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * strength);
  }

  update(target: THREE.Vector3, dt: number, world: PhysicsWorld | null) {
    const want = target.clone().add(new THREE.Vector3(0, 1.3, 0));
    this.focus.lerp(want, 1 - Math.exp(-10 * dt));
    this.curDist += (this.dist - this.curDist) * (1 - Math.exp(-8 * dt));
    this.apply(world);
  }

  /** Horizontal forward vector of the camera (for camera-relative movement). */
  forward(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  private apply(world: PhysicsWorld | null) {
    const cam = this.camera;
    if (this.override) {
      cam.position.copy(this.override.pos);
      cam.lookAt(this.override.look);
      return;
    }
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    let d = this.curDist;
    if (world && this.limits.collide) {
      const hit = world.raycastBoxes(this.focus, dir, d);
      if (hit < d) d = Math.max(0.45, hit - 0.3);
    }
    cam.position.copy(this.focus).addScaledVector(dir, d);
    const ground = world ? world.groundHeight(cam.position.x, cam.position.z) + 0.4 : -Infinity;
    if (cam.position.y < ground) cam.position.y = ground;
    cam.lookAt(this.focus);
  }
}
