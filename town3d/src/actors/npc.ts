import * as THREE from "three";
import type { Chibi } from "./chibi";
import type { Cylinder, PhysicsWorld } from "../core/physics";

export interface ScheduleEntry {
  /** Active from this hour (0-24) until the next entry. */
  from: number;
  /** Route walked in order, then the NPC idles near the last point. */
  route: [number, number][];
  /** Hidden at the destination (gone indoors). */
  hidden?: boolean;
  wander?: number;
}

/** A villager that follows a daily schedule and blocks the player like a post. */
export class NPC {
  pos = new THREE.Vector3();
  facing = 0;
  private route: [number, number][] = [];
  private routeIdx = 0;
  private current: ScheduleEntry | null = null;
  private idleT = 0;
  private wanderTarget: THREE.Vector3 | null = null;
  private home = new THREE.Vector3();
  private body: Cylinder;
  talking = false;
  /** Custom conversation (replaces cycling through `lines`). */
  onTalk: (() => void) | null = null;
  /** Waves once when the player walks up; resets when they leave. */
  private greeted = false;
  speed = 1.5;

  constructor(
    readonly name: string,
    readonly role: string,
    readonly chibi: Chibi,
    readonly schedule: ScheduleEntry[],
    world: PhysicsWorld,
    readonly lines: string[],
  ) {
    this.body = world.addCylinder(0, 0, 0.35, 0, 1.6, "npc");
    this.schedule.sort((a, b) => a.from - b.from);
  }

  private entryFor(hour: number) {
    let e = this.schedule[this.schedule.length - 1];
    for (const s of this.schedule) if (hour >= s.from) e = s;
    return e;
  }

  /** Teleport to where the schedule says they should be now. */
  place(hour: number) {
    const e = this.entryFor(hour);
    this.current = e;
    const last = e.route[e.route.length - 1];
    this.pos.set(last[0], 0, last[1]);
    this.home.copy(this.pos);
    this.route = [];
    this.chibi.setVisible(!e.hidden);
    this.sync();
  }

  update(dt: number, hour: number, player: THREE.Vector3) {
    const e = this.entryFor(hour);
    if (e !== this.current) {
      this.current = e;
      this.route = e.route.slice();
      this.routeIdx = 0;
      this.chibi.setVisible(true);
    }
    let speed = 0;
    const toPlayer = Math.hypot(player.x - this.pos.x, player.z - this.pos.z);
    if (toPlayer > 7) this.greeted = false;
    if (this.talking) {
      this.faceTo(player.x, player.z, dt);
    } else if (this.routeIdx < this.route.length) {
      const [tx, tz] = this.route[this.routeIdx];
      speed = this.walkTo(tx, tz, dt);
      if (speed === 0) {
        this.routeIdx++;
        if (this.routeIdx >= this.route.length) {
          this.home.set(tx, 0, tz);
          if (e.hidden) this.chibi.setVisible(false);
        }
      }
    } else if (!e.hidden) {
      // Idle: occasionally amble around home; turn to greet a nearby player.
      if (toPlayer < 3.2) {
        this.faceTo(player.x, player.z, dt);
        if (!this.greeted) {
          this.greeted = true;
          this.chibi.emote("wave");
        }
      } else if (this.wanderTarget) {
        speed = this.walkTo(this.wanderTarget.x, this.wanderTarget.z, dt, 0.8);
        if (speed === 0) this.wanderTarget = null;
      } else {
        this.idleT -= dt;
        if (this.idleT <= 0 && (e.wander ?? 1.5) > 0) {
          const r = e.wander ?? 1.5;
          const a = Math.random() * Math.PI * 2;
          this.wanderTarget = new THREE.Vector3(this.home.x + Math.cos(a) * r * Math.random(), 0, this.home.z + Math.sin(a) * r * Math.random());
          this.idleT = 3 + Math.random() * 5;
        }
      }
    }
    this.chibi.animate(dt, speed, false);
    this.sync();
  }

  private walkTo(x: number, z: number, dt: number, speedK = 1): number {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) return 0;
    const v = Math.min(d / dt, this.speed * speedK);
    this.pos.x += (dx / d) * v * dt;
    this.pos.z += (dz / d) * v * dt;
    this.faceTo(x, z, dt);
    return v;
  }

  private faceTo(x: number, z: number, dt: number) {
    const target = Math.atan2(x - this.pos.x, z - this.pos.z);
    let d = target - this.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.facing += d * Math.min(1, dt * 6);
  }

  private sync() {
    this.chibi.root.position.copy(this.pos);
    this.chibi.root.rotation.y = this.facing;
    this.body.x = this.pos.x;
    this.body.z = this.pos.z;
    this.body.y1 = this.chibi.root.visible ? 1.6 : -10;
  }

  get visible() {
    return this.chibi.root.visible;
  }
}
