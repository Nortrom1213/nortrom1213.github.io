import * as THREE from "three";
import type { TownData } from "../data";
import { Input } from "./input";
import { CameraRig, INTERIOR_LIMITS, OUTDOOR_LIMITS } from "./camera";
import { CharacterController } from "./physics";
import { AudioSystem } from "./audio";
import { save } from "./save";
import { preload } from "./assets";
import { PostFX } from "./render";
import { toonify } from "./toon";
import type { Interactable, Stage } from "./stage";
import { Sky } from "../world/sky";
import { Weather, type WeatherKind } from "../world/weather";
import { buildChibi, type Chibi, type ChibiOptions } from "../actors/chibi";
import { VISITORS } from "../actors/visitors";
import { UI, el } from "../ui/ui";
import * as panels from "../ui/panels";
import { avatarPicker } from "../ui/avatarPicker";

export interface Place {
  id: string;
  label: string;
  icon: string;
  desc: string;
  stage: string;
  spawn: string;
}

export interface BadgeDef {
  id: string;
  label: string;
  icon: string;
  desc: string;
}

export const BADGES: BadgeDef[] = [
  { id: "archive", label: "Night Watch", icon: "🗝️", desc: "Recovered the manuscript from The Archive." },
  { id: "tower", label: "Summit", icon: "🚩", desc: "Reached the top of a generated PCG Tower." },
  { id: "whodunit", label: "Sharp Reasoner", icon: "🐺", desc: "Unmasked the werewolf in the Tavern." },
  { id: "fireflies", label: "Firefly Keeper", icon: "✨", desc: "Filled a jar in the Firefly Meadow." },
  { id: "explorer", label: "Explorer", icon: "🧭", desc: "Visited every building in town." },
  { id: "cat", label: "Cat Friend", icon: "🐈", desc: "Petted Perlin the cat." },
];

export type Quality = "high" | "low";

const WALK = 4.6;
const RUN = 7.2;

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly input: Input;
  readonly ui: UI;
  readonly audio = new AudioSystem();
  readonly rig: CameraRig;
  readonly sky: Sky;
  readonly weather: Weather;
  readonly player = new CharacterController();
  avatar: Chibi;
  readonly quality: Quality;
  readonly post: PostFX;
  private toonTimer = 0;
  /** Frame-time probe for automatic downgrade on slow machines. */
  private perf = { t: 0, frames: 0, checked: false };
  stage: Stage | null = null;
  private stages = new Map<string, Stage>();
  readonly places: Place[] = [];
  private marker: THREE.Mesh;
  /** Soft light from the camera so faces never go fully dark. */
  private fill = new THREE.DirectionalLight(0xfff4e8, 0.55);
  private clock = new THREE.Clock();
  private elapsed = 0;
  private stepTimer = 0;
  private transitioning = false;
  private facing = 0;
  private visited = new Set<string>();
  /** Re-capture the mouse when the panel that released it closes. */
  private relock = false;
  /** Set by main.ts once the visitor has entered the town. */
  started = false;
  /** Mini-games may freeze the player (cutscenes, results). */
  frozen = false;
  /** Called every frame after the stage update (mini-game overlays). */
  readonly tickers = new Set<(dt: number) => void>();
  /** Called just before the player leaves the current stage (cancel poses, overlays). */
  readonly onStageChange = new Set<(from: string | null, to: string) => void>();

  constructor(readonly canvas: HTMLCanvasElement, readonly data: TownData) {
    const pref = save.get().quality;
    const weak = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.hardwareConcurrency ?? 8) <= 4;
    this.quality = pref === "auto" ? (weak ? "low" : "high") : pref;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality === "high", powerPreference: "high-performance" });
    // Post-processing at DPR 2 is 4x the pixels of DPR 1; 1.5 looks the same through the AA + outline pass.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality === "high" ? 1.5 : 1.25));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.post = new PostFX(this.renderer, this.quality === "high" ? "high" : "low");
    this.input = new Input(canvas);
    this.ui = new UI(this.input);
    this.rig = new CameraRig(window.innerWidth / window.innerHeight);
    this.sky = new Sky(this.quality === "high" ? 2048 : 1024);
    this.weather = new Weather(this.quality === "low");
    this.avatar = buildChibi(Game.avatarOptions());

    const markerMat = new THREE.MeshStandardMaterial({ color: 0xffd25a, emissive: 0xc08010, emissiveIntensity: 0.8, flatShading: true });
    this.marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), markerMat);
    this.marker.scale.y = 1.6;
    this.marker.visible = false;

    const s = save.get();
    this.input.mouseMode = s.mouseMode;
    this.ui.onModalClosed = () => {
      if (this.relock) this.input.lock();
      this.relock = false;
    };
    this.input.onLockChange = (locked) => {
      if (locked) this.relock = false;
    };
    this.audio.muted = s.muted;
    this.audio.volume = s.volume;

    window.addEventListener("resize", () => this.onResize());
    this.ui.onPromptClick = () => this.input.press("interact");
    this.ui.onCancel = () => {};
    this.buildHudButtons();
    this.onResize();
    this.ui.minimap.addEventListener("click", (e) => {
      const r = this.ui.minimap.getBoundingClientRect();
      this.stage?.minimapClick?.((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    });
  }

  // ---- Stages ------------------------------------------------------------------

  register(stage: Stage) {
    this.stages.set(stage.id, stage);
  }

  getStage<T extends Stage>(id: string): T | undefined {
    return this.stages.get(id) as T | undefined;
  }

  async goTo(id: string, spawn = "default", opts: { fade?: boolean } = {}) {
    if (this.transitioning) return;
    const next = this.stages.get(id);
    if (!next) throw new Error(`unknown stage ${id}`);
    this.transitioning = true;
    const fade = opts.fade ?? this.stage !== null;
    if (fade) {
      this.audio.sfx("door");
      await this.ui.fade(true);
    }
    const prev = this.stage;
    // Load and build before tearing down the current stage, so a failure
    // (e.g. a dropped connection) leaves the player where they were.
    try {
      const need = next.requiredModels();
      if (need.length) await preload(need, undefined, true);
      await next.ensureBuilt(this);
    } catch (e) {
      console.error("stage failed to load", id, e);
      this.transitioning = false;
      if (fade) await this.ui.fade(false);
      this.ui.toast("That place couldn't load. Check your connection and try again.");
      if (!prev) throw e;
      return;
    }
    // Nothing from the old stage may survive the trip: dialogue, panels, poses.
    this.ui.closeDialogue(false);
    this.ui.closeAllPanels();
    for (const f of this.onStageChange) {
      try {
        f(prev?.id ?? null, id);
      } catch (e) {
        console.error(e);
      }
    }
    prev?.onExit();
    if (prev) prev.scene.remove(this.avatar.root, this.marker, this.fill, this.fill.target);
    this.stage = next;
    toonify(next.scene);
    this.post.setScene(next.scene, this.rig.camera);
    this.post.configure({ tilt: next.outdoor ? 1 : 0.35, outline: 1 });
    if (next.outdoor) {
      this.sky.attach(next.scene);
      next.scene.add(this.weather.group);
    }
    next.scene.add(this.avatar.root, this.marker, this.fill, this.fill.target);
    this.fill.intensity = next.outdoor ? 0.6 : 0.35;
    const sp = next.spawns[spawn] ?? next.spawns.default;
    if (sp) {
      this.player.pos.copy(sp.pos);
      this.player.vel.set(0, 0, 0);
      this.facing = sp.yaw;
    }
    this.rig.setLimits(next.cameraLimits ?? (next.outdoor ? OUTDOOR_LIMITS : INTERIOR_LIMITS));
    this.rig.override = null;
    this.rig.snap(this.player.pos, (sp?.yaw ?? 0) + Math.PI);
    this.ui.setPlace(next.title);
    this.ui.setMinimapVisible(!!next.drawMinimap);
    this.frozen = false;
    next.onEnter(prev?.id ?? null);
    this.markVisited(next.id);
    if (fade) await this.ui.fade(false);
    this.transitioning = false;
  }

  private markVisited(id: string) {
    this.visited.add(id);
    const need = ["library", "cafe", "hall", "tavern"];
    if (need.every((n) => this.visited.has(n))) this.award("explorer");
  }

  // ---- Loop ----------------------------------------------------------------------

  start() {
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    this.elapsed += dt;
    const stage = this.stage;
    if (!stage) return;
    this.ui.update(dt);

    // Camera input.
    const look = this.input.consumeLook();
    if (!this.ui.modalOpen) this.rig.look(look.dx, look.dy, look.zoom);
    const turn = this.input.keyTurn();
    if (turn) this.rig.yaw -= turn * dt * 2.2;

    // Movement relative to the camera.
    const mv = this.input.move();
    const fwd = this.rig.forward();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const dir = new THREE.Vector3().addScaledVector(fwd, mv.y).addScaledVector(right, mv.x);
    const frozen = this.frozen || this.transitioning;
    const run = mv.run && (mv.runKey || stage.allowAutoRun);
    const speed = frozen ? 0 : run ? RUN : WALK;
    const wish = new THREE.Vector2(dir.x * speed, dir.z * speed);
    const jump = !frozen && stage.allowJump && this.input.pressed("jump");
    const wasGround = this.player.onGround;
    // Menus pause the player (and so mini-game physics) rather than the whole world.
    if (!this.ui.modalOpen) this.player.step(dt, wish, jump, stage.world);
    if (jump && !this.player.onGround && wasGround) this.audio.sfx("jump");
    if (this.player.landedSpeed < -8) this.audio.sfx("land", Math.min(1, -this.player.landedSpeed / 20));

    const hSpeed = Math.hypot(this.player.vel.x, this.player.vel.z);
    if (dir.lengthSq() > 0.01 && !frozen) {
      const target = Math.atan2(dir.x, dir.z);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 12);
      // Swing the camera behind the player when they haven't touched it for a while.
      if (performance.now() - this.input.lastLookTime > 2500 && Math.abs(mv.y) > 0.2) {
        this.rig.autoFollow(this.facing + Math.PI, dt, 0.6 * (mv.y > 0 ? 1 : 0));
      }
    }
    this.avatar.root.position.copy(this.player.pos);
    this.avatar.root.rotation.y = this.facing;
    this.avatar.animate(dt, hSpeed, !this.player.onGround);
    if (this.player.onGround && hSpeed > 1) {
      this.stepTimer -= dt * hSpeed;
      if (this.stepTimer <= 0) {
        this.stepTimer = 1.7;
        this.audio.sfx("step", 0.7);
      }
    }

    // World systems.
    if (stage.outdoor) {
      this.weather.update(dt, this.player.pos, this.sky);
    }
    this.sky.update(dt, this.player.pos, this.rig.camera);
    if (!this.transitioning) {
      stage.update(dt, this.elapsed);
      for (const t of this.tickers) t(dt);
    }

    this.rig.update(this.player.pos, dt, stage.world);
    this.fill.position.copy(this.rig.camera.position);
    this.fill.target.position.copy(this.player.pos);
    this.updateCutaway(stage);
    this.updateInteraction(stage);

    // Audio mood.
    const mood = stage.music === "auto" ? (stage.outdoor ? (this.sky.night > 0.6 ? "night" : "day") : "interior") : stage.music;
    this.audio.setMood(mood);
    const lv = this.weather.audioLevels();
    this.audio.setWeather(stage.outdoor ? lv.rain : lv.rain * 0.25, stage.outdoor ? lv.wind : 0);
    this.audio.tickAmbience(dt, this.sky.night, stage.outdoor);

    this.ui.setClock(this.sky.clockLabel(), this.sky.phaseLabel(), this.weather.label());
    if (stage.drawMinimap && this.elapsed % 0.1 < dt) this.drawMinimap(stage);

    if (this.input.pressed("menu") && !this.ui.modalOpen) this.openMenu();
    if (this.input.pressed("toggleView")) this.setMouseMode(this.input.mouseMode === "immersive" ? "drag" : "immersive");
    if (this.ui.modalOpen && this.input.locked) {
      this.relock = true;
      this.input.unlock();
    }
    this.ui.setLockHint(this.started && !this.input.isTouch && this.input.mouseMode === "immersive" && !this.input.locked && !this.ui.modalOpen && !this.frozen);
    if (this.player.fell) stage.onFall?.();

    this.watchPerformance(dt);
    // Objects created at runtime (mini-games, details) get toon shading too.
    this.toonTimer -= dt;
    if (this.toonTimer <= 0) {
      this.toonTimer = 2;
      toonify(stage.scene);
    }
    if (stage.outdoor) this.post.configure({ night: this.sky.night, bloom: 0.28 + this.sky.night * 0.45 });
    this.post.render(stage.scene, this.rig.camera);
  }

  /**
   * After a few seconds of play, if the frame rate is poor with full effects on,
   * drop post-processing and pixel ratio once (and remember it for next time).
   */
  private watchPerformance(dt: number) {
    if (this.perf.checked || this.frozen || !this.post.enabled || document.hidden) return;
    // Respect an explicit Graphics choice; never probe in dev snapshot mode.
    if (save.get().quality !== "auto" || location.search.includes("debug")) return;
    this.perf.t += dt;
    this.perf.frames++;
    if (this.perf.t < 6) return;
    this.perf.checked = true;
    const fps = this.perf.frames / this.perf.t;
    if (fps < 32) {
      this.post.enabled = false;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
      this.onResize();
      save.set("quality", "low");
      this.ui.toast("Switched to performance mode for smoother play. You can change Graphics in the Menu.");
    }
  }

  private updateCutaway(stage: Stage) {
    if (!stage.cutawayWalls.length) return;
    const cam = this.rig.camera.position;
    for (const w of stage.cutawayWalls) {
      const side = new THREE.Vector3().subVectors(cam, w.point).dot(w.normal);
      w.mesh.visible = side < 0.5;
    }
  }

  private updateInteraction(stage: Stage) {
    let best: Interactable | null = null;
    let bestD = Infinity;
    if (!this.ui.modalOpen && !this.frozen && !this.transitioning) {
      for (const it of stage.interactables) {
        if (it.enabled && !it.enabled()) continue;
        const dx = it.pos.x - this.player.pos.x;
        const dz = it.pos.z - this.player.pos.z;
        const dy = Math.abs(it.pos.y - this.player.pos.y);
        const d = Math.hypot(dx, dz);
        if (d < it.radius && dy < 3 && d < bestD) {
          best = it;
          bestD = d;
        }
      }
    }
    if (best) {
      this.marker.visible = true;
      this.marker.position.copy(best.pos);
      this.marker.position.y += (best.markerHeight ?? 2.2) + Math.sin(this.elapsed * 3) * 0.1;
      this.marker.rotation.y += 0.04;
      this.ui.setPrompt(typeof best.label === "function" ? best.label() : best.label);
      if (this.input.pressed("interact")) {
        this.audio.sfx("interact");
        best.onInteract();
      }
    } else {
      this.marker.visible = false;
      this.ui.setPrompt(null);
      if (!this.ui.modalOpen) this.input.pressed("interact");
    }
  }

  private drawMinimap(stage: Stage) {
    const c = this.ui.minimap;
    const ctx = c.getContext("2d")!;
    stage.drawMinimap!(ctx, c.width, this.player.pos, this.facing, this.rig.yaw);
  }

  private onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.post?.setSize(window.innerWidth, window.innerHeight);
    const aspect = window.innerWidth / window.innerHeight;
    this.rig.camera.aspect = aspect;
    // Portrait phones get a wider view so the town isn't a keyhole.
    this.rig.camera.fov = aspect < 0.8 ? 66 : aspect < 1.2 ? 58 : 50;
    this.rig.camera.updateProjectionMatrix();
  }

  /** Chibi options for the saved visitor look (defaults to the first preset). */
  static avatarOptions(): ChibiOptions {
    const a = save.get().avatar;
    const preset = VISITORS.find((v) => v.id === a?.preset) ?? VISITORS[0];
    const o: ChibiOptions = { ...preset.opts };
    if (a?.hair !== undefined) o.hairColor = a.hair;
    if (a?.top !== undefined) o.top = a.top;
    return o;
  }

  /** Download the models of every registered stage while the visitor walks around. */
  prefetchStages() {
    const lists = [...this.stages.values()].filter((s) => s !== this.stage).map((s) => s.requiredModels());
    const idle = (cb: () => void) => ("requestIdleCallback" in window ? (window as unknown as { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(cb) : setTimeout(cb, 300));
    const next = () => {
      const l = lists.shift();
      if (!l) return;
      void preload(l).finally(() => idle(next));
    };
    idle(next);
  }

  /** Swap the player's look in place (avatar picker). */
  setAvatar(preset: string, hair?: number, top?: number) {
    save.set("avatar", { preset, hair, top });
    const old = this.avatar;
    const parent = old.root.parent;
    const pos = old.root.position.clone();
    const rot = old.root.rotation.y;
    parent?.remove(old.root);
    // Free the old avatar's geometry and its uncached materials (glasses etc.).
    old.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) if (!mat.userData.cached) mat.dispose();
    });
    this.avatar = buildChibi(Game.avatarOptions());
    this.avatar.root.position.copy(pos);
    this.avatar.root.rotation.y = rot;
    toonify(this.avatar.root);
    parent?.add(this.avatar.root);
  }

  setMouseMode(mode: "immersive" | "drag") {
    this.input.mouseMode = mode;
    save.set("mouseMode", mode);
    if (mode === "drag") this.input.unlock();
    this.ui.toast(mode === "immersive" ? "🖱️ Immersive mouse: click to capture, Esc to release." : "🖱️ Drag mode: hold the mouse button and drag to look.");
  }

  /** Turn the avatar (e.g. after a respawn). */
  setFacing(yaw: number) {
    this.facing = yaw;
  }

  // ---- Progress ------------------------------------------------------------------

  award(id: string) {
    const def = BADGES.find((b) => b.id === id);
    if (!def) return;
    if (save.addBadge(id)) {
      this.audio.sfx("success");
      this.ui.toast(`${def.icon} Badge earned: <b>${def.label}</b>`, 3600);
    }
  }

  // ---- HUD + menu --------------------------------------------------------------------

  private buildHudButtons() {
    this.ui.addButton({ id: "menu", label: "☰ Menu", title: "Town Menu (M)", onClick: () => this.openMenu() });
    const snd = this.ui.addButton({
      id: "sound",
      label: this.audio.muted ? "🔇" : "🔊",
      title: "Sound on/off",
      onClick: () => {
        this.audio.start();
        this.audio.setMuted(!this.audio.muted);
        save.set("muted", this.audio.muted);
        snd.textContent = this.audio.muted ? "🔇" : "🔊";
      },
    });
    this.ui.addButton({ id: "classic", label: "Classic", title: "Classic academic site", onClick: () => (window.location.href = "/") });
  }

  openMenu() {
    this.audio.sfx("open");
    const d = this.data;
    const body = el("div");
    const tile = (icon: string, label: string, sub: string, fn: () => void, cls = "") => {
      const b = el("button", "menu-tile " + cls, `<span class="ico">${icon}</span>${label}<small>${sub}</small>`);
      b.addEventListener("click", () => {
        this.audio.sfx("click");
        fn();
      });
      return b;
    };
    const section = (title: string) => el("h3", undefined, title);
    const read = el("div", "menu-grid");
    read.append(
      tile("👋", "About", "Who I am", () => panels.aboutPanel(this.ui, d)),
      tile("📚", "Publications", `${d.publications.length} papers`, () => panels.publicationsPanel(this.ui, d)),
      tile("📌", "News", "Latest updates", () => panels.newsPanel(this.ui, d)),
      tile("☕", "Notebook", "Venues & journals", () => panels.notebookPanel(this.ui, d)),
      tile("🎮", "Indie Games", "Night Shift trailer", () => panels.gamesPanel(this.ui, d)),
      tile("🌀", "Links", "GitHub, Scholar, email", () => panels.linksPanel(this.ui, d)),
      tile("🧑‍🎨", "Change look", "Pick your avatar", () => this.ui.openPanel({ title: "Your look", kicker: "Avatar", body: avatarPicker(this) })),
    );
    const travel = el("div", "menu-grid");
    for (const p of this.places) {
      travel.append(
        tile(p.icon, p.label, p.desc, () => {
          this.ui.closeAllPanels();
          void this.goTo(p.stage, p.spawn);
        }),
      );
    }
    const badges = el("div", "menu-grid");
    for (const b of BADGES) {
      const got = save.hasBadge(b.id);
      badges.append(tile(got ? b.icon : "🔒", b.label, b.desc, () => {}, got ? "done" : ""));
    }
    const settings = el("div");
    const timeRow = el("div", "settings-row", "<label>Time</label>");
    for (const [label, hour] of [["Dawn", 6.2], ["Noon", 12], ["Dusk", 18.6], ["Night", 22]] as const) {
      const b = el("button", "btn small secondary", label);
      b.addEventListener("click", () => {
        this.sky.setHour(hour);
        this.ui.toast(`Time skips to ${label.toLowerCase()}.`);
      });
      timeRow.append(b);
    }
    const wxRow = el("div", "settings-row", "<label>Weather</label>");
    for (const k of ["clear", "cloudy", "rain", "snow", "breeze"] as WeatherKind[]) {
      const b = el("button", "btn small secondary", k[0].toUpperCase() + k.slice(1));
      b.addEventListener("click", () => this.weather.set(k));
      wxRow.append(b);
    }
    const mouseRow = el("div", "settings-row", "<label>Mouse</label>");
    if (!this.input.isTouch) {
      for (const [mode, label] of [["immersive", "Immersive (hidden cursor)"], ["drag", "Drag to look"]] as const) {
        const b = el("button", "btn small " + (this.input.mouseMode === mode ? "" : "secondary"), label);
        b.addEventListener("click", () => {
          this.setMouseMode(mode);
          mouseRow.querySelectorAll("button").forEach((x) => x.classList.toggle("secondary", x !== b));
        });
        mouseRow.append(b);
      }
    }
    const volRow = el("div", "settings-row", "<label>Volume</label>");
    const vol = el("input") as HTMLInputElement;
    vol.type = "range";
    vol.min = "0";
    vol.max = "1";
    vol.step = "0.05";
    vol.value = String(this.audio.volume);
    vol.addEventListener("input", () => {
      this.audio.start();
      this.audio.setVolume(Number(vol.value));
      save.set("volume", Number(vol.value));
    });
    volRow.append(vol);
    const qRow = el("div", "settings-row", "<label>Graphics</label>");
    for (const q of ["auto", "high", "low"] as const) {
      const b = el("button", "btn small " + (save.get().quality === q ? "" : "secondary"), q[0].toUpperCase() + q.slice(1));
      b.addEventListener("click", () => {
        save.set("quality", q);
        window.location.reload();
      });
      qRow.append(b);
    }
    settings.append(timeRow, wxRow, ...(this.input.isTouch ? [] : [mouseRow]), volRow, qRow);
    const other = el("div", undefined, `
      <p style="margin:0.4rem 0">
        <a class="btn small" href="/">Classic site</a>
        <a class="btn small secondary" href="/xu-town-2d/">Old 2D town</a>
      </p>
      <p style="font-size:0.85rem;color:var(--ink-soft)">Controls: WASD / arrows to move, Shift to run, Space to jump, E to interact, mouse to look (click to capture, Esc to release, V toggles drag mode), wheel to zoom, Q / R to turn, M for this menu.
      <br/>3D models: <a href="https://kenney.nl" target="_blank" rel="noopener">Kenney</a> (CC0). Built with three.js.</p>`);
    body.append(section("Read"), read, section("Travel"), travel, section("Badges"), badges, section("Settings"), settings, section("More"), other);
    this.ui.openPanel({ title: "Town Menu", kicker: "Xu Town", body, wide: true, onClose: () => this.audio.sfx("close") });
  }
}
