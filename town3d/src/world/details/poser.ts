import * as THREE from "three";
import type { Ctx } from "./kit";

// Takes over the avatar / camera for a moment: sitting on a bench (camera eases
// out, a thought appears) and peering through the telescope (camera override).
// Either ends with E, Space or by moving.

interface Seat {
  x: number;
  z: number;
  yaw: number;
}

const SEAT_Y = 0.48;

export class Poser {
  private sitting: { seat: Seat; t: number; prevDist: number; prevPitch: number; thought: string; said: boolean } | null = null;
  private scope: {
    t: number;
    eye: THREE.Vector3;
    look: THREE.Vector3;
    fromPos: THREE.Vector3;
    fromLook: THREE.Vector3;
    prevFov: number;
    text: string;
    said: boolean;
    view: { pos: THREE.Vector3; look: THREE.Vector3 };
  } | null = null;
  private legs: THREE.Object3D[] | null = null;
  private vignette: HTMLDivElement | null = null;

  private legsOwner: THREE.Object3D | null = null;

  constructor(private ctx: Ctx) {
    ctx.every((dt) => this.update(dt));
    // Ticks only run in town, so travel must cancel poses explicitly.
    ctx.game.onStageChange.add(() => this.cancel());
  }

  /** Stand up / leave the telescope without the usual exit animation. */
  cancel() {
    const g = this.ctx.game;
    if (this.sitting) {
      g.rig.dist = this.sitting.prevDist;
      for (const l of this.findLegs()) l.rotation.x = 0;
      this.sitting = null;
      g.frozen = false;
    }
    if (this.scope) this.endScope(false);
  }

  get busy() {
    return !!this.sitting || !!this.scope;
  }

  private hint() {
    const g = this.ctx.game;
    return g.input.isTouch ? "Tap <b>E</b> or move to get up." : "Press <b>E</b> or move to get up.";
  }

  sit(seat: Seat, thought: string) {
    const g = this.ctx.game;
    if (this.busy || g.frozen) return;
    g.frozen = true;
    this.sitting = { seat, t: 0, prevDist: g.rig.dist, prevPitch: g.rig.pitch, thought, said: false };
    g.player.pos.set(seat.x, SEAT_Y, seat.z);
    g.player.vel.set(0, 0, 0);
    g.setFacing(seat.yaw);
    g.rig.dist = Math.min(g.rig.limits.maxDist, Math.max(g.rig.dist, 8) + 4);
    this.ctx.say(this.hint(), 2400);
  }

  /** Swing the camera to the telescope eyepiece and look along `dir`. */
  peer(eye: THREE.Vector3, dir: THREE.Vector3, text: string) {
    const g = this.ctx.game;
    if (this.busy || g.frozen) return;
    const cam = g.rig.camera;
    g.frozen = true;
    const fromPos = cam.position.clone();
    const fromLook = fromPos.clone().add(cam.getWorldDirection(new THREE.Vector3()).multiplyScalar(10));
    const view = { pos: fromPos.clone(), look: fromLook.clone() };
    g.rig.override = view;
    this.scope = { t: 0, eye, look: eye.clone().addScaledVector(dir.clone().normalize(), 80), fromPos, fromLook, prevFov: cam.fov, text, said: false, view };
  }

  private findLegs(): THREE.Object3D[] {
    if (this.legs && this.legsOwner === this.ctx.game.avatar.root) return this.legs;
    this.legsOwner = this.ctx.game.avatar.root;
    // Leg pivots sit at the hips (x ≈ ±0.1, y ≈ 0.46). If the avatar changes shape we
    // simply skip the pose.
    const found: THREE.Object3D[] = [];
    this.ctx.game.avatar.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) return;
      if (Math.abs(Math.abs(o.position.x) - 0.1) < 0.03 && Math.abs(o.position.y - 0.46) < 0.05 && Math.abs(o.position.z) < 0.05) found.push(o);
    });
    this.legs = found.length === 2 ? found : [];
    return this.legs;
  }

  private wantsOut(): boolean {
    const g = this.ctx.game;
    if (g.ui.modalOpen) return false;
    const mv = g.input.move();
    const e = g.input.pressed("interact");
    const j = g.input.pressed("jump");
    return Math.hypot(mv.x, mv.y) > 0.3 || e || j;
  }

  private update(dt: number) {
    const g = this.ctx.game;
    const inTown = g.stage === this.ctx.town;
    if (this.sitting) {
      const s = this.sitting;
      s.t += dt;
      if (!inTown || !g.frozen) {
        // Someone else took over (travel, a mini-game): just stand up.
        this.cancel();
        return;
      }
      const fx = Math.sin(s.seat.yaw);
      const fz = Math.cos(s.seat.yaw);
      g.player.pos.set(s.seat.x, SEAT_Y, s.seat.z);
      g.player.vel.set(0, 0, 0);
      g.setFacing(s.seat.yaw);
      // Pose: hips on the seat, legs forward.
      const root = g.avatar.root;
      root.position.set(s.seat.x - fx * 0.05, SEAT_Y - 0.43, s.seat.z - fz * 0.05);
      root.rotation.y = s.seat.yaw;
      for (const l of this.findLegs()) l.rotation.x = -1.45;
      if (s.t < 2.2) {
        let d = s.seat.yaw + 0.55 - g.rig.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        g.rig.yaw += d * Math.min(1, dt * 2.2);
        g.rig.pitch += (0.3 - g.rig.pitch) * Math.min(1, dt * 2);
      }
      if (!s.said && s.t > 1.0) {
        s.said = true;
        this.ctx.say(`💭 <i>${s.thought}</i>`, 4600);
      }
      if (s.t > 0.5 && this.wantsOut()) {
        g.player.pos.set(s.seat.x + fx * 0.85, 0, s.seat.z + fz * 0.85);
        g.rig.dist = s.prevDist;
        g.frozen = false;
        this.sitting = null;
      }
      return;
    }
    if (this.scope) {
      const s = this.scope;
      s.t += dt;
      const cam = g.rig.camera;
      if (!inTown || g.rig.override !== s.view) {
        this.endScope(false);
        return;
      }
      const k = THREE.MathUtils.smoothstep(s.t, 0, 1.6);
      s.view.pos.lerpVectors(s.fromPos, s.eye, k);
      s.view.look.lerpVectors(s.fromLook, s.look, k);
      cam.fov = THREE.MathUtils.lerp(s.prevFov, 16, THREE.MathUtils.smoothstep(s.t, 0.9, 2.4));
      cam.updateProjectionMatrix();
      this.setVignette(THREE.MathUtils.smoothstep(s.t, 0.9, 2.0));
      if (!s.said && s.t > 2.0) {
        s.said = true;
        this.ctx.say(`🔭 ${s.text}`, 4800);
      }
      if (s.t > 8 || (s.t > 1.2 && this.wantsOut())) this.endScope(true);
    }
  }

  private endScope(restore: boolean) {
    const g = this.ctx.game;
    const s = this.scope;
    if (!s) return;
    this.scope = null;
    const cam = g.rig.camera;
    cam.fov = s.prevFov;
    cam.updateProjectionMatrix();
    // Let the game recompute its responsive FOV.
    window.dispatchEvent(new Event("resize"));
    this.setVignette(0);
    if (restore) {
      if (g.rig.override === s.view) g.rig.override = null;
      g.frozen = false;
    }
  }

  private setVignette(k: number) {
    if (!this.vignette) {
      if (k <= 0) return;
      const v = document.createElement("div");
      v.style.cssText =
        "position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;background:radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0, rgba(0,0,0,0) 30vmin, rgba(5,6,12,0.96) 36vmin)";
      document.body.append(v);
      this.vignette = v;
    }
    this.vignette.style.opacity = String(k);
  }
}
