import * as THREE from "three";
import { PhysicsWorld } from "./physics";
import type { CameraLimits } from "./camera";
import type { Game } from "./game";

export interface Interactable {
  id: string;
  /** World position of the thing (prompt marker floats above it). */
  pos: THREE.Vector3;
  /** Interaction reach from the player, metres. */
  radius: number;
  /** Prompt text, e.g. "Read the notice board". */
  label: string | (() => string);
  onInteract: () => void;
  enabled?: () => boolean;
  /** Marker height above pos. */
  markerHeight?: number;
}

export interface SpawnPoint {
  pos: THREE.Vector3;
  yaw: number;
}

/**
 * A place the player can be: the town, an interior, a mini-game level.
 * Each owns its THREE.Scene, collision world and interactables.
 */
export abstract class Stage {
  abstract readonly id: string;
  abstract readonly title: string;
  scene = new THREE.Scene();
  world = new PhysicsWorld();
  interactables: Interactable[] = [];
  spawns: Record<string, SpawnPoint> = {};
  /** Uses the shared sky / day-night system. */
  outdoor = false;
  /** Interiors hide the wall facing the camera. */
  cutawayWalls: { mesh: THREE.Object3D; normal: THREE.Vector3; point: THREE.Vector3 }[] = [];
  cameraLimits?: CameraLimits;
  music: "day" | "night" | "interior" | "tense" | "silent" | "auto" = "auto";
  /** Player can jump here (towers etc.). Defaults on. */
  allowJump = true;
  /** A fully pushed touch stick runs. Off where running is loud (stealth). */
  allowAutoRun = true;
  game!: Game;
  private built = false;

  /** Optional minimap renderer (outdoor stages). */
  drawMinimap?(ctx: CanvasRenderingContext2D, size: number, player: THREE.Vector3, facing: number, camYaw: number): void;
  /** Click on the minimap at normalised (u, v) in 0..1. */
  minimapClick?(u: number, v: number): void;
  /** Called when the player falls below world.killY. */
  onFall?(): void;

  /** Build geometry once. Called on first entry, after models are loaded. */
  protected abstract build(): void | Promise<void>;

  /** Models this stage needs before build(). */
  requiredModels(): [import("./assets").Kit, string][] {
    return [];
  }

  async ensureBuilt(game: Game) {
    this.game = game;
    if (this.built) return;
    await this.build();
    this.built = true;
  }

  /** Called after the player is placed in the stage. */
  onEnter(_from: string | null) {}
  onExit() {}
  update(_dt: number, _t: number) {}

  addInteractable(i: Interactable) {
    this.interactables.push(i);
    return i;
  }

  addCutawayWall(mesh: THREE.Object3D, normal: THREE.Vector3, point: THREE.Vector3) {
    this.cutawayWalls.push({ mesh, normal: normal.clone().normalize(), point: point.clone() });
  }
}
