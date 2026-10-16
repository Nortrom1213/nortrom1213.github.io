import * as THREE from "three";
import { Stage, type Interactable } from "../core/stage";
import type { Kit } from "../core/assets";
import { instanced, model, type Placement } from "../core/assets";
import { BUILDINGS, POI, PLAY_RADIUS, TILE, doorOf, pathNetwork, type BuildingDef } from "./layout";
import { buildGround, buildWater, groundHeight, onPath } from "./terrain";
import { buildGrass, grassWind } from "./grass";
import { Motes } from "./motes";
import { buildBuilding, buildSign, setWindowGlow } from "./buildings";
import { NPC, type ScheduleEntry } from "../actors/npc";
import { buildCat, buildChibi, buildKaijie, type Chibi } from "../actors/chibi";
import { kaijieConversation } from "../actors/kaijie";
import * as panels from "../ui/panels";

// The outdoor town: buildings, plaza, notice board, portal, nature, villagers.

/** Something extra living in the town (mini-games hook in here). */
export interface TownSystem {
  update(dt: number, t: number): void;
}

const TOWN_MODELS: [Kit, string][] = [
  ...[
    "wall", "wall-door", "wall-window-shutters", "wall-window-glass", "wall-window-round", "wall-detail-cross",
    "wall-wood", "wall-wood-door", "wall-wood-window-shutters", "wall-wood-window-glass", "wall-wood-window-round", "wall-wood-detail-cross",
    "wall-doorway-round", "roof-gable", "roof-high-gable", "roof-high-point", "roof-point", "chimney", "banner-red", "banner-green",
    "fountain-round-detail", "lantern", "stall-red", "stall-green", "stall-bench", "cart", "windmill", "fence", "hedge",
    "pillar-stone", "stairs-stone", "rock-large", "rock-wide",
  ].map((n) => ["town", n] as [Kit, string]),
  ...[
    "tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "tree_pineDefaultA", "tree_pineRoundA", "tree_pineTallA",
    "tree_oak_fall", "tree_default_fall", "tree_detailed_fall", "tree_fat_fall",
    "rock_largeA", "rock_largeB", "rock_tallA", "rock_smallA", "rock_smallC", "stone_largeA",
    "flower_redA", "flower_yellowA", "flower_purpleA", "flower_yellowB", "grass", "grass_large", "plant_bush", "plant_bushLarge", "plant_bushDetailed",
    "mushroom_red", "mushroom_tanGroup", "lily_large", "lily_small", "log", "stump_round", "log_stack",
    "fence_simple", "crop_pumpkin", "statue_obelisk", "campfire_stones", "canoe", "bridge_wood",
  ].map((n) => ["nature", n] as [Kit, string]),
];

interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class TownStage extends Stage {
  readonly id = "town";
  readonly title = "Xu Town";
  outdoor = true;
  npcs: NPC[] = [];
  private cat!: { chibi: Chibi; pos: THREE.Vector3; target: THREE.Vector3; wait: number; facing: number };
  private water!: ReturnType<typeof buildWater>;
  private blades: THREE.Object3D | null = null;
  private portalSwirl!: THREE.ShaderMaterial;
  private portalRunes: THREE.Object3D[] = [];
  private lampGlows: THREE.Sprite[] = [];
  private lampLights: THREE.PointLight[] = [];
  private fountainJet!: THREE.Mesh;
  private keepOut: Rect[] = [];
  readonly systems = new Set<TownSystem>();
  private minimapBase: HTMLCanvasElement | null = null;
  private motes!: Motes;

  requiredModels() {
    return TOWN_MODELS;
  }

  protected build() {
    const scene = this.scene;
    const world = this.world;
    world.groundHeight = groundHeight;
    world.boundsCircle = { x: 0, z: 0, r: PLAY_RADIUS };

    scene.add(buildGround());
    this.water = buildWater();
    scene.add(this.water.mesh);
    this.addPondColliders();

    for (const def of BUILDINGS) this.addBuilding(def);
    this.addWindmill();
    this.addPlaza();
    this.addNoticeBoard();
    this.addPortal();
    this.addWelcome();
    this.addLamps();
    this.addMeadow();
    this.addNature();
    this.scene.add(buildGrass(this.game.quality === "high" ? 22000 : 8000));
    this.motes = new Motes(this.game.quality === "high" ? 220 : 90);
    this.scene.add(this.motes.points);
    this.addVillagers();

    this.spawns.default = { pos: new THREE.Vector3(POI.spawn.x, 0, POI.spawn.z), yaw: Math.PI };
  }

  // ---- Buildings -----------------------------------------------------------------

  private addBuilding(def: BuildingDef) {
    const b = buildBuilding(def);
    this.scene.add(b.group);
    const W = def.w * TILE;
    const D = def.d * TILE;
    this.world.addBox(def.x, def.z, W - 0.15, D - 0.15, 0, b.height);
    this.keepOut.push({ minX: def.x - W / 2 - 3, maxX: def.x + W / 2 + 3, minZ: def.z - D / 2 - 3, maxZ: def.z + D / 2 + 3 });
    const door = b.door;
    const out = new THREE.Vector3(Math.sin(door.yaw), 0, Math.cos(door.yaw));
    this.spawns[`from-${def.id}`] = { pos: new THREE.Vector3(door.x, 0, door.z).addScaledVector(out, 1.2), yaw: door.yaw };

    // Name sign beside the path to the door.
    const side = new THREE.Vector3(out.z, 0, -out.x);
    const sign = buildSign(def.label, { width: 2.6 });
    sign.position.set(door.x, 0, door.z).addScaledVector(out, 2.6).addScaledVector(side, 2.6);
    sign.rotation.y = door.yaw;
    this.scene.add(sign);
    this.world.addCylinder(sign.position.x, sign.position.z, 0.25, 0, 2.4);

    const target = def.id;
    this.addInteractable({
      id: `door-${def.id}`,
      pos: new THREE.Vector3(door.x, 0, door.z),
      radius: 2.2,
      label: def.id === "archive" ? "Sneak into The Archive" : def.id === "tower" ? "Climb the PCG Tower" : `Enter ${def.label}`,
      markerHeight: 2.9,
      onInteract: () => {
        if (this.game.getStage(target)) void this.game.goTo(target, "default");
        else this.game.ui.toast(`${def.label} is closed for renovation.`);
      },
    });
    const inside = ["library", "cafe", "hall", "tavern"].includes(def.id);
    this.game.places.push({ id: def.id, label: def.label, icon: def.icon, desc: placeDesc(def.id), stage: inside ? def.id : "town", spawn: inside ? "default" : `from-${def.id}` });
  }

  private addWindmill() {
    const def: BuildingDef = { id: "windmill", label: "Windmill", x: POI.windmill.x, z: POI.windmill.z, w: 2, d: 2, floors: 2, door: "s", roof: "point", roofColor: 0xc0503a, style: "wood", windows: "shutters", icon: "" };
    const b = buildBuilding(def);
    this.scene.add(b.group);
    this.world.addBox(def.x, def.z, 2 * TILE, 2 * TILE, 0, 8);
    this.keepOut.push({ minX: def.x - 6, maxX: def.x + 6, minZ: def.z - 6, maxZ: def.z + 9 });
    const blades = model("town", "windmill", 2.2);
    // Blade disc faces +x in the model; turn it to face the plaza (south).
    const pivot = new THREE.Group();
    pivot.position.set(def.x, 2 * TILE + 0.6, def.z + TILE + 0.5);
    pivot.rotation.y = -Math.PI / 2;
    pivot.add(blades);
    this.scene.add(pivot);
    this.blades = blades;
    // Pumpkin patch (it is autumn somewhere).
    const pumpkins: Placement[] = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) pumpkins.push({ x: def.x + 6 + i * 1.6, z: def.z + 4 + j * 1.5, rotY: Math.random() * 6, scale: 2.2 + Math.random() * 0.8 });
    this.scene.add(instanced("nature", "crop_pumpkin", pumpkins));
    const fence: Placement[] = [];
    for (let i = 0; i < 4; i++) fence.push({ x: def.x + 7.6 + (i - 1.5) * 2.4 + 0.7, z: def.z + 2.6, scale: 2.4 });
    this.scene.add(instanced("nature", "fence_simple", fence));
  }

  // ---- Plaza ---------------------------------------------------------------------

  private addPlaza() {
    const f = model("town", "fountain-round-detail", 3.4);
    this.scene.add(f);
    this.world.addCylinder(0, 0, 3.3, 0, 1.0);
    // Water surface and a little jet.
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.9, 24), new THREE.MeshStandardMaterial({ color: 0x5ab0d8, roughness: 0.1, transparent: true, opacity: 0.85 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.55;
    this.scene.add(water);
    this.fountainJet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.35, 1.8, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.55, emissive: 0x3a7090, emissiveIntensity: 0.2 }));
    this.fountainJet.position.y = 1.4;
    this.scene.add(this.fountainJet);
    this.addInteractable({
      id: "fountain",
      pos: new THREE.Vector3(0, 0, 0),
      radius: 4.6,
      label: "Toss a coin in the fountain",
      markerHeight: 3.2,
      onInteract: () => {
        this.game.audio.sfx("coin");
        const wishes = [
          "You wish for a camera-ready deadline extension.",
          "You wish for Reviewer #2 to be kind.",
          "You wish for reproducible results on the first try.",
          "You wish for one more GPU.",
          "The fountain gurgles approvingly.",
        ];
        this.game.ui.toast(wishes[Math.floor(Math.random() * wishes.length)]);
      },
    });

    // Market stalls and benches around the rim.
    const ring = (a: number, r: number) => new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r);
    const stalls: [string, number][] = [["stall-red", -2.35], ["stall-green", 2.35], ["stall-red", 3.6]];
    for (const [name, a] of stalls) {
      const p = ring(a, 10.8);
      const s = model("town", name, 2.6);
      s.position.copy(p);
      s.rotation.y = a + Math.PI;
      this.scene.add(s);
      this.world.addCylinder(p.x, p.z, 1.3, 0, 3);
    }
    for (const a of [0.9, -0.9, 2.9, -2.9]) {
      const p = ring(a, 7.6);
      const s = model("town", "stall-bench", 2.4);
      s.position.copy(p);
      s.rotation.y = a + Math.PI / 2;
      this.scene.add(s);
      this.world.addCylinder(p.x, p.z, 0.6, 0, 0.9);
    }
    const cart = model("town", "cart", 2.6);
    cart.position.set(10.5, 0, 5.5);
    cart.rotation.y = -0.4;
    this.scene.add(cart);
    this.world.addCylinder(10.5, 5.5, 1.1, 0, 1.4);
    this.keepOut.push({ minX: -13, maxX: 13, minZ: -13, maxZ: 13 });
  }

  // ---- Notice board ----------------------------------------------------------------

  private addNoticeBoard() {
    const { x, z } = POI.notice;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = -0.5;
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.9, flatShading: true });
    for (const sx of [-1.6, 1.6]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), wood);
      post.position.set(sx, 1.6, 0);
      g.add(post);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 0.9, 4, 1), new THREE.MeshStandardMaterial({ color: 0x3f7d5a, flatShading: true }));
    roof.position.y = 3.55;
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.35;
    g.add(roof);
    // Cork with paper notes painted from the news.
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#b9875a";
    ctx.fillRect(0, 0, 1024, 640);
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? "rgba(90,50,20,0.25)" : "rgba(255,220,170,0.2)";
      ctx.fillRect(Math.random() * 1024, Math.random() * 640, 3, 3);
    }
    const notes = this.game.data.news.slice(0, 6);
    const colors = ["#fff7dc", "#fdf0f0", "#eef7ff", "#f2ffe8", "#fff3d6", "#f8eefc"];
    notes.forEach((n, i) => {
      const cx = 30 + (i % 3) * 330;
      const cy = 30 + Math.floor(i / 3) * 300;
      ctx.save();
      ctx.translate(cx + 150, cy + 135);
      ctx.rotate((Math.random() - 0.5) * 0.12);
      ctx.fillStyle = colors[i % colors.length];
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 8;
      ctx.fillRect(-150, -130, 300, 260);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#c0503a";
      ctx.beginPath();
      ctx.arc(0, -112, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a2a1e";
      ctx.font = "700 26px Fraunces, Georgia, serif";
      ctx.fillText(String(n.year), -130, -72);
      ctx.font = "500 21px Nunito, sans-serif";
      wrapText(ctx, n.text, -130, -38, 262, 26, 7);
      ctx.restore();
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2, 0.12), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), wood]);
    board.position.y = 2;
    g.add(board);
    g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    this.scene.add(g);
    this.world.addBox(x, z, 3.2, 1.0, 0, 3.4);
    this.keepOut.push({ minX: x - 4, maxX: x + 4, minZ: z - 4, maxZ: z + 5 });
    this.addInteractable({
      id: "notice",
      pos: new THREE.Vector3(x, 0, z),
      radius: 3.4,
      label: "Read the notice board",
      markerHeight: 4.3,
      onInteract: () => panels.newsPanel(this.game.ui, this.game.data),
    });
    this.game.places.push({ id: "notice", label: "Notice Board", icon: "📌", desc: "News", stage: "town", spawn: "notice" });
    this.spawns.notice = { pos: new THREE.Vector3(x - 1, 0, z + 3.2), yaw: Math.PI };
  }

  // ---- Portal ------------------------------------------------------------------------

  private addPortal() {
    const { x, z } = POI.portal;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = -Math.PI / 2;
    const stone = new THREE.MeshStandardMaterial({ color: 0x9a94a8, roughness: 0.9, flatShading: true });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.38, 6, 16), stone);
    ring.position.y = 2.3;
    g.add(ring);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.4, 10), stone);
    base.position.y = 0.2;
    g.add(base);
    this.portalSwirl = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: { t: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float t; varying vec2 vUv;
        void main(){
          vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
          float s = sin(a * 3.0 + r * 10.0 - t * 3.0) * 0.5 + 0.5;
          vec3 c = mix(vec3(0.35, 0.2, 0.75), vec3(0.55, 0.9, 1.0), s * (1.0 - r));
          float alpha = smoothstep(1.0, 0.85, r) * 0.92;
          gl_FragColor = vec4(c + (1.0 - r) * 0.35, alpha);
        }`,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.75, 32), this.portalSwirl);
    disc.position.y = 2.3;
    g.add(disc);
    const light = new THREE.PointLight(0x9a7aff, 6, 9, 2);
    light.position.y = 2.3;
    g.add(light);
    for (let i = 0; i < 4; i++) {
      const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0xc8b8ff, emissive: 0x6a4ad0, emissiveIntensity: 0.9, flatShading: true }));
      rune.userData.k = i;
      g.add(rune);
      this.portalRunes.push(rune);
    }
    this.scene.add(g);
    this.world.addCylinder(x, z - 1.9, 0.5, 0, 4.5);
    this.world.addCylinder(x, z + 1.9, 0.5, 0, 4.5);
    this.keepOut.push({ minX: x - 5, maxX: x + 5, minZ: z - 5, maxZ: z + 5 });
    this.addInteractable({
      id: "portal",
      pos: new THREE.Vector3(x, 0, z),
      radius: 3.6,
      label: "Step into the Travel Portal",
      markerHeight: 4.8,
      onInteract: () => panels.linksPanel(this.game.ui, this.game.data),
    });
    this.game.places.push({ id: "portal", label: "Travel Portal", icon: "🌀", desc: "Links", stage: "town", spawn: "portal" });
    this.spawns.portal = { pos: new THREE.Vector3(x - 4, 0, z), yaw: Math.PI / 2 };
    const sign = buildSign("Travel Portal", { width: 2.4, sub: "GitHub · Scholar · Email" });
    sign.position.set(x - 4.5, 0, z + 3.6);
    sign.rotation.y = -Math.PI / 2 + 0.4;
    this.scene.add(sign);
  }

  // ---- Welcome sign / About -------------------------------------------------------------

  private addWelcome() {
    const { x, z } = POI.welcome;
    const sign = buildSign("Welcome to Xu Town", { width: 3.6, sub: "Kaijie (Jay) Xu · PhD, McGill" });
    sign.position.set(x + 3.2, 0, z + 0.5);
    sign.rotation.y = -0.25;
    sign.scale.setScalar(1.15);
    this.scene.add(sign);
    this.world.addBox(x + 3.2, z + 0.5, 3.8, 0.6, 0, 2.8);
    this.addInteractable({
      id: "about",
      pos: new THREE.Vector3(x + 3.2, 0, z + 0.5),
      radius: 3.2,
      label: "Read the welcome sign (About)",
      markerHeight: 3.3,
      onInteract: () => panels.aboutPanel(this.game.ui, this.game.data),
    });
    this.game.places.unshift({ id: "plaza", label: "Town Plaza", icon: "⛲", desc: "Start here", stage: "town", spawn: "default" });
  }

  // ---- Lamps -------------------------------------------------------------------------------

  private addLamps() {
    const spots: [number, number][] = [];
    for (const p of pathNetwork()) {
      for (let i = 0; i < p.pts.length - 1; i++) {
        const [ax, az] = p.pts[i];
        const [bx, bz] = p.pts[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.floor(len / 11);
        for (let k = 1; k <= n; k++) {
          const t = k / (n + 1);
          const nx = -(bz - az) / len;
          const nz = (bx - ax) / len;
          const off = p.w / 2 + 0.8;
          spots.push([ax + (bx - ax) * t + nx * off, az + (bz - az) * t + nz * off]);
        }
      }
    }
    for (let a = 0; a < 6; a++) spots.push([Math.sin(a * 1.047 + 0.5) * 9.3, Math.cos(a * 1.047 + 0.5) * 9.3]);
    const filtered = spots.filter(([x, z], i) => spots.findIndex(([x2, z2]) => Math.hypot(x - x2, z - z2) < 4) === i && !this.blocked(x, z, 0.5));
    const glowTex = radialTexture();
    filtered.forEach(([x, z], i) => {
      const l = model("town", "lantern", 2.1);
      l.position.set(x, 0, z);
      this.scene.add(l);
      this.world.addCylinder(x, z, 0.22, 0, 3);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      glow.position.set(x, 3.05, z);
      glow.scale.setScalar(1.6);
      this.scene.add(glow);
      this.lampGlows.push(glow);
      if (i % 3 === 0 && this.lampLights.length < (this.game.quality === "high" ? 8 : 3)) {
        const pl = new THREE.PointLight(0xffb060, 0, 11, 1.6);
        pl.position.set(x, 2.9, z);
        this.scene.add(pl);
        this.lampLights.push(pl);
      }
    });
  }

  // ---- Meadow + pond -------------------------------------------------------------------

  private addPondColliders() {
    const p = POI.pond;
    for (let i = -3; i <= 3; i++) {
      const fx = i / 3.5;
      const half = Math.sqrt(Math.max(0, 1 - fx * fx));
      // Taller than the 0.36 m step-up so the player can't climb onto the water.
      this.world.addCylinder(p.x + fx * p.rx, p.z, half * p.rz * 0.95, -1, 0.8);
    }
    this.keepOut.push({ minX: p.x - p.rx - 2.5, maxX: p.x + p.rx + 2.5, minZ: p.z - p.rz - 2.5, maxZ: p.z + p.rz + 2.5 });
    const lilies: Placement[] = [];
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.6;
      lilies.push({ x: p.x + Math.cos(a) * p.rx * r, y: 0.1, z: p.z + Math.sin(a) * p.rz * r, rotY: Math.random() * 6, scale: 2.5 });
    }
    this.scene.add(instanced("nature", "lily_large", lilies, 1, false));
    const canoe = model("nature", "canoe", 3);
    canoe.position.set(p.x + p.rx + 0.8, 0, p.z - 1);
    canoe.rotation.y = 1.2;
    this.scene.add(canoe);
  }

  private addMeadow() {
    const m = POI.meadow;
    const flowers: Record<string, Placement[]> = { flower_redA: [], flower_yellowA: [], flower_purpleA: [], flower_yellowB: [] };
    const names = Object.keys(flowers);
    for (let i = 0; i < 140; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * m.r;
      const x = m.x + Math.cos(a) * r;
      const z = m.z + Math.sin(a) * r;
      if (onPath(x, z, 0.3)) continue;
      const pdx = (x - POI.pond.x) / (POI.pond.rx + 1.5);
      const pdz = (z - POI.pond.z) / (POI.pond.rz + 1.5);
      if (pdx * pdx + pdz * pdz < 1) continue;
      flowers[names[i % names.length]].push({ x, z, rotY: Math.random() * 6, scale: 1.5 + Math.random() * 0.8 });
    }
    for (const n of names) this.scene.add(instanced("nature", n, flowers[n], 1, false));
    const sign = buildSign("Firefly Meadow", { width: 2.6, sub: "Best visited at night" });
    sign.position.set(POI.fireflySign.x, 0, POI.fireflySign.z);
    sign.rotation.y = 0.2;
    this.scene.add(sign);
    this.world.addCylinder(POI.fireflySign.x, POI.fireflySign.z, 0.4, 0, 2.4);
    const camp = model("nature", "campfire_stones", 3);
    camp.position.set(m.x - 6, 0, m.z + 2);
    this.scene.add(camp);
    this.game.places.push({ id: "meadow", label: "Firefly Meadow", icon: "✨", desc: "Mini-game (night)", stage: "town", spawn: "meadow" });
    this.spawns.meadow = { pos: new THREE.Vector3(POI.fireflySign.x + 1.5, 0, POI.fireflySign.z - 2), yaw: 0 };
  }

  // ---- Nature ---------------------------------------------------------------------------------

  private blocked(x: number, z: number, margin: number) {
    for (const r of this.keepOut) if (x > r.minX - margin && x < r.maxX + margin && z > r.minZ - margin && z < r.maxZ + margin) return true;
    return false;
  }

  private addNature() {
    const month = new Date().getMonth();
    const autumn = month >= 8 && month <= 10;
    const leafy = ["tree_oak", "tree_default", "tree_detailed", "tree_fat"];
    const fall = ["tree_oak_fall", "tree_default_fall", "tree_detailed_fall", "tree_fat_fall"];
    const pines = ["tree_cone", "tree_pineDefaultA", "tree_pineRoundA", "tree_pineTallA"];
    const buckets = new Map<string, Placement[]>();
    const put = (name: string, p: Placement) => {
      if (!buckets.has(name)) buckets.set(name, []);
      buckets.get(name)!.push(p);
    };
    const rnd = mulberry(1213);
    // Inner trees.
    let placed = 0;
    for (let tries = 0; tries < 900 && placed < 46; tries++) {
      const a = rnd() * Math.PI * 2;
      const r = 18 + rnd() * (PLAY_RADIUS - 18);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (onPath(x, z, 2.5) || this.blocked(x, z, 1.5)) continue;
      if (Math.hypot(x - POI.meadow.x, z - POI.meadow.z) < POI.meadow.r - 2) continue;
      const pool = rnd() < 0.25 ? pines : autumn && rnd() < 0.5 ? fall : leafy;
      const name = pool[Math.floor(rnd() * pool.length)];
      const s = 3.6 + rnd() * 2;
      put(name, { x, z, rotY: rnd() * 6, scale: s });
      this.world.addCylinder(x, z, 0.4, 0, 6);
      this.keepOut.push({ minX: x - 1.5, maxX: x + 1.5, minZ: z - 1.5, maxZ: z + 1.5 });
      placed++;
    }
    // Forest ring beyond the edge of the play area.
    const ring = this.game.quality === "high" ? 520 : 300;
    for (let i = 0; i < ring; i++) {
      const a = rnd() * Math.PI * 2;
      const r = PLAY_RADIUS + 3 + Math.pow(rnd(), 0.8) * 60;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const pool = rnd() < 0.45 ? pines : autumn && rnd() < 0.45 ? fall : leafy;
      put(pool[Math.floor(rnd() * pool.length)], { x, y: groundHeight(x, z) - 0.1, z, rotY: rnd() * 6, scale: 4 + rnd() * 3 });
    }
    // Ground cover.
    const cover = ["grass", "grass_large", "plant_bush", "plant_bushDetailed", "flower_redA", "flower_yellowA", "mushroom_red", "rock_smallA", "rock_smallC"];
    for (let i = 0; i < (this.game.quality === "high" ? 700 : 380); i++) {
      const a = rnd() * Math.PI * 2;
      const r = 6 + rnd() * (PLAY_RADIUS + 10);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (onPath(x, z, 0.4) || this.blocked(x, z, -1)) continue;
      const name = cover[Math.floor(rnd() * cover.length)];
      put(name, { x, y: groundHeight(x, z), z, rotY: rnd() * 6, scale: name.startsWith("rock") ? 1.6 + rnd() * 1.6 : name.startsWith("flower") || name.startsWith("mush") ? 1.4 + rnd() * 0.8 : 2 + rnd() * 1.2 });
    }
    // Boulders at the edge.
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const r = PLAY_RADIUS + 1 + rnd() * 5;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      put(rnd() < 0.5 ? "rock_largeA" : rnd() < 0.5 ? "rock_tallA" : "stone_largeA", { x, y: groundHeight(x, z) - 0.2, z, rotY: rnd() * 6, scale: 3 + rnd() * 3 });
    }
    // A few logs and stumps.
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 20 + rnd() * 34;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (onPath(x, z, 2) || this.blocked(x, z, 1)) continue;
      put(rnd() < 0.5 ? "log" : "stump_round", { x, z, rotY: rnd() * 6, scale: 2.6 });
    }
    for (const [name, list] of buckets) {
      const small = !name.startsWith("tree") && !name.startsWith("rock_l") && !name.startsWith("stone");
      this.scene.add(instanced("nature", name, list, 1, !small));
    }
  }

  // ---- Villagers -----------------------------------------------------------------------------

  private addVillagers() {
    const lib = doorOf(BUILDINGS.find((b) => b.id === "library")!);
    const tav = doorOf(BUILDINGS.find((b) => b.id === "tavern")!);
    const make = (name: string, role: string, chibi: Chibi, schedule: ScheduleEntry[], lines: string[]) => {
      const npc = new NPC(name, role, chibi, schedule, this.world, lines);
      this.scene.add(chibi.root);
      this.npcs.push(npc);
      const it: Interactable = {
        id: `npc-${name}`,
        pos: npc.pos,
        radius: 2.2,
        label: `Talk to ${name}`,
        markerHeight: 2.3,
        enabled: () => npc.visible,
        onInteract: () => this.talk(npc),
      };
      this.addInteractable(it);
    };
    make(
      "Verbrugge·Wizard",
      "Advisor",
      buildChibi({ robe: 0x4a3a7a, top: 0x4a3a7a, hat: "wizard", hatColor: 0x3a2a6a, beard: 0xe8e4dc, hair: "none", prop: "staff", skin: 0xf0c8a8 }),
      [
        { from: 7.5, route: [[lib.x + 2, lib.z + 3], [lib.x + 3, lib.z + 5]], wander: 2 },
        { from: 17.5, route: [[-8, -2], [-4, -4.5]], wander: 1.5 },
        { from: 22, route: [[-8, -2], [lib.x, lib.z + 3], [lib.x, lib.z]], hidden: true },
      ],
      [
        "Ah — another procedural dungeon, you say? Show me the constraints first.",
        "Stealth has math. Potential fields don't lie.",
        "Mission, level, narrative — three layers, one design formula.",
        "The Archive to the north keeps its guards on composite potential fields. Try not to raise their confidence map.",
      ],
    );
    make(
      "Town Chronicler",
      "Town Historian",
      buildChibi({ top: 0x5a6a8a, hair: "short", hairColor: 0x5a4a38, hat: "beret", hatColor: 0x8a3a3a, prop: "scroll", glasses: { frame: 0x3a2a1a, lens: 0xddeeff, lensOpacity: 0.3 } }),
      [
        { from: 7, route: [[POI.notice.x - 2, POI.notice.z + 3]], wander: 2 },
        { from: 19, route: [[10, -6], [-20, -2], [tav.x + 2.5, tav.z + 1.5]], wander: 1 },
        { from: 23.5, route: [[tav.x, tav.z]], hidden: true },
      ],
      [
        "I keep the town's chronicle — every paper, every festival, every stray cat.",
        "Fresh on the board: a survey of stealth in games, out in IEEE Transactions on Games.",
        "They say the PCG Tower on the north-east hill is never the same climb twice.",
        "Mind if I add your journey to the ledger?",
      ],
    );
    make(
      "Bard of CHI",
      "Reviewer #2",
      buildChibi({ top: 0x3b6a8e, hair: "long", hairColor: 0x6a3a20, hat: "feather", hatColor: 0x2f5a3a, hatAccent: 0xe8c060, prop: "lute", pants: 0x5a3a2a }),
      [
        { from: 9.5, route: [[-5.5, 9.5]], wander: 1 },
        { from: 17, route: [[-12, 4], [tav.x + 3, tav.z - 2]], wander: 1 },
        { from: 1.5, route: [[tav.x, tav.z]], hidden: true },
      ],
      [
        "Have you considered a thematic analysis?",
        "Reject? No, no — major revision. With love.",
        "There's a werewolf among the regulars at the Tavern. Only careful reasoning will unmask them.",
      ],
    );
    make(
      "Innkeeper Berkeley",
      "Old Friend",
      buildChibi({ top: 0x2a4a7a, apron: 0xf0e6d0, hair: "bun", hairColor: 0x3a2a18, scarf: 0xe8b830, prop: "tray" }),
      [
        { from: 6, route: [[tav.x + 1.8, tav.z + 2.2]], wander: 1.5 },
        { from: 23, route: [[tav.x, tav.z]], hidden: true },
      ],
      [
        "Math 110 still haunts me. Did you finish the linear algebra dungeon?",
        "Free coffee for PhDs. We know.",
        "Come back after dark — the fireflies by the pond move like they share one mind. Perlin noise, apparently.",
      ],
    );
    // Kaijie himself greets visitors on the plaza by day, and sits by the
    // meadow campfire at night.
    make(
      "Kaijie (Jay) Xu",
      "PhD candidate · McGill",
      buildKaijie(),
      [
        { from: 7, route: [[5.8, 9.4]], wander: 0.8 },
        { from: 20.5, route: [[6, 14], [0, 24], [POI.meadow.x - 4.6, POI.meadow.z + 1.2]], wander: 0.6 },
      ],
      ["Hi!"],
    );
    const kaijie = this.npcs[this.npcs.length - 1];
    kaijie.onTalk = () => kaijieConversation(this.game);

    const hour = this.game.sky.hour;
    for (const n of this.npcs) n.place(hour);

    const chibi = buildCat();
    this.scene.add(chibi.root);
    this.cat = { chibi, pos: new THREE.Vector3(3, 0, 5), target: new THREE.Vector3(3, 0, 5), wait: 2, facing: 0 };
    this.addInteractable({
      id: "cat",
      pos: this.cat.pos,
      radius: 1.8,
      label: "Pet Perlin the cat",
      markerHeight: 1.1,
      onInteract: () => {
        this.game.audio.sfx("purr");
        chibi.emote("talk");
        this.cat.wait = 4;
        const lines = ["mrrow.", "(Perlin noise intensifies)", "purr~ (a wild gradient appears)", "Perlin rolls over. Smooth, continuous, coherent."];
        this.game.ui.toast(`🐈 ${lines[Math.floor(Math.random() * lines.length)]}`);
        this.game.award("cat");
      },
    });
  }

  private talk(npc: NPC) {
    npc.talking = true;
    npc.chibi.emote("talk");
    if (npc.onTalk) {
      npc.onTalk();
      const done = () => {
        if (!this.game.ui.modalOpen) npc.talking = false;
        else requestAnimationFrame(done);
      };
      requestAnimationFrame(done);
      return;
    }
    const i = (this.talkCount.get(npc.name) ?? 0) % npc.lines.length;
    this.talkCount.set(npc.name, i + 1);
    const greeting = this.game.sky.night > 0.6 ? "Out late, aren't we?" : null;
    const lines = [greeting, npc.lines[i]].filter(Boolean) as string[];
    this.game.ui.dialogue(npc.name, npc.role, lines, () => (npc.talking = false));
    // Ensure talking resets if dialogue is closed early.
    const check = () => {
      if (!this.game.ui.dialogueOpen) npc.talking = false;
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }
  private talkCount = new Map<string, number>();

  // ---- Per-frame -----------------------------------------------------------------------------

  update(dt: number, t: number) {
    const night = this.game.sky.night;
    this.water.update(t, this.game.sky.colors);
    this.motes.update(dt, t, this.game.player.pos, night, this.game.sky.overcast);
    grassWind(t, this.game.weather.kind === "breeze" || this.game.weather.kind === "rain" ? 1.8 : 1);
    if (this.blades) this.blades.rotation.x += dt * 0.6;
    this.portalSwirl.uniforms.t.value = t;
    for (const c of this.portalRunes) {
      const k = c.userData.k as number;
      const a = t * 0.8 + (k * Math.PI) / 2;
      c.position.set(Math.cos(a) * 2.6, 2.3 + Math.sin(t * 2 + k) * 0.3, Math.sin(a) * 2.6);
      c.rotation.y = t * 2;
    }
    this.fountainJet.scale.y = 1 + Math.sin(t * 4) * 0.08;
    const lampOn = THREE.MathUtils.smoothstep(night, 0.2, 0.7);
    for (const g of this.lampGlows) (g.material as THREE.SpriteMaterial).opacity = lampOn * (0.85 + Math.sin(t * 3 + g.position.x) * 0.08);
    for (const l of this.lampLights) {
      l.intensity = lampOn * 9;
      l.visible = lampOn > 0.01;
    }
    setWindowGlow(night);

    const hour = this.game.sky.hour;
    for (const n of this.npcs) n.update(dt, hour, this.game.player.pos);
    this.updateCat(dt);
    for (const s of this.systems) s.update(dt, t);
  }

  private updateCat(dt: number) {
    const c = this.cat;
    const player = this.game.player.pos;
    const dx = c.target.x - c.pos.x;
    const dz = c.target.z - c.pos.z;
    const d = Math.hypot(dx, dz);
    let speed = 0;
    if (c.wait > 0) {
      c.wait -= dt;
    } else if (d > 0.2) {
      speed = 1.6;
      c.pos.x += (dx / d) * speed * dt;
      c.pos.z += (dz / d) * speed * dt;
      const target = Math.atan2(dx, dz);
      let df = target - c.facing;
      df = Math.atan2(Math.sin(df), Math.cos(df));
      c.facing += df * Math.min(1, dt * 5);
    } else {
      c.wait = 2 + Math.random() * 5;
      // Sometimes trot after the player, otherwise roam the plaza edge.
      if (Math.random() < 0.35 && Math.hypot(player.x, player.z) < 25) c.target.set(player.x + (Math.random() - 0.5) * 3, 0, player.z + (Math.random() - 0.5) * 3);
      else {
        const a = Math.random() * Math.PI * 2;
        const r = 4 + Math.random() * 6;
        c.target.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      }
    }
    c.chibi.root.position.copy(c.pos);
    c.chibi.root.rotation.y = c.facing;
    c.chibi.animate(dt, speed, false);
  }

  // ---- Minimap -------------------------------------------------------------------------------

  /** Click a place on the minimap to travel there (after confirming). */
  minimapClick(u: number, v: number) {
    const R = PLAY_RADIUS + 4;
    const x = u * 2 * R - R;
    const z = v * 2 * R - R;
    const spots: { label: string; x: number; z: number; spawn: string }[] = [
      ...BUILDINGS.map((b) => ({ label: b.label, x: b.x, z: b.z, spawn: `from-${b.id}` })),
      { label: "Notice Board", x: POI.notice.x, z: POI.notice.z, spawn: "notice" },
      { label: "Travel Portal", x: POI.portal.x, z: POI.portal.z, spawn: "portal" },
      { label: "Firefly Meadow", x: POI.meadow.x, z: POI.meadow.z, spawn: "meadow" },
      { label: "Town Plaza", x: 0, z: 0, spawn: "default" },
    ];
    let best = spots[0];
    let bd = Infinity;
    for (const s of spots) {
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (bd > 14) return;
    this.game.audio.sfx("click");
    this.game.ui.dialogue("Town map", "Fast travel", [
      {
        text: `Walk to ${best.label}?`,
        choices: [
          { label: "Go", action: () => void this.game.goTo("town", best.spawn) },
          { label: "Stay here", action: () => {} },
        ],
      },
    ]);
  }

  drawMinimap(ctx: CanvasRenderingContext2D, size: number, player: THREE.Vector3, facing: number) {
    const R = PLAY_RADIUS + 4;
    const k = size / (R * 2);
    if (!this.minimapBase) {
      const base = document.createElement("canvas");
      base.width = base.height = size;
      const b = base.getContext("2d")!;
      const toPx = (x: number, z: number): [number, number] => [(x + R) * k, (z + R) * k];
      b.fillStyle = "#6f9f55";
      b.fillRect(0, 0, size, size);
      b.strokeStyle = "#d8c08a";
      b.lineCap = "round";
      for (const p of pathNetwork()) {
        b.lineWidth = p.w * k;
        b.beginPath();
        p.pts.forEach(([x, z], i) => (i ? b.lineTo(...toPx(x, z)) : b.moveTo(...toPx(x, z))));
        b.stroke();
      }
      b.fillStyle = "#d9cdb4";
      b.beginPath();
      b.arc(...toPx(0, 0), POI.plaza.r * k, 0, Math.PI * 2);
      b.fill();
      b.fillStyle = "#5ab0d8";
      b.beginPath();
      b.ellipse(...toPx(POI.pond.x, POI.pond.z), POI.pond.rx * k, POI.pond.rz * k, 0, 0, Math.PI * 2);
      b.fill();
      for (const def of BUILDINGS) {
        const [x0, z0] = toPx(def.x - (def.w * TILE) / 2, def.z - (def.d * TILE) / 2);
        b.fillStyle = "#" + def.roofColor.toString(16).padStart(6, "0");
        b.fillRect(x0, z0, def.w * TILE * k, def.d * TILE * k);
      }
      b.font = `${Math.round(size * 0.075)}px sans-serif`;
      b.textAlign = "center";
      b.textBaseline = "middle";
      for (const def of BUILDINGS) b.fillText(def.icon, ...toPx(def.x, def.z));
      b.fillText("📌", ...toPx(POI.notice.x, POI.notice.z));
      b.fillText("🌀", ...toPx(POI.portal.x, POI.portal.z));
      b.fillText("✨", ...toPx(POI.meadow.x, POI.meadow.z));
      this.minimapBase = base;
    }
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(this.minimapBase, 0, 0);
    // Night tint.
    const night = this.game.sky.night;
    if (night > 0) {
      ctx.fillStyle = `rgba(20,24,60,${night * 0.45})`;
      ctx.fillRect(0, 0, size, size);
    }
    const px = (player.x + R) * k;
    const pz = (player.z + R) * k;
    // Villagers: small dots (Kaijie in gold), the cat in orange.
    for (const n of this.npcs) {
      if (!n.visible) continue;
      const isK = n.name.startsWith("Kaijie");
      ctx.fillStyle = isK ? "#f4c430" : "#fbf4e4";
      ctx.strokeStyle = "#3a2a1e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc((n.pos.x + R) * k, (n.pos.z + R) * k, isK ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#e8a04a";
    ctx.beginPath();
    ctx.arc((this.cat.pos.x + R) * k, (this.cat.pos.z + R) * k, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(px, pz);
    ctx.rotate(-facing + Math.PI);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#c0503a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(9, 10);
    ctx.lineTo(0, 5);
    ctx.lineTo(-9, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function placeDesc(id: string) {
  return (
    {
      library: "Publications",
      cafe: "Research notebook",
      hall: "Indie games",
      tavern: "Mini-game: Whodunit",
      archive: "Mini-game: Stealth",
      tower: "Mini-game: Parkour",
    } as Record<string, string>
  )[id] ?? "";
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) {
  const words = text.split(/\s+/);
  let line = "";
  let n = 0;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(n === maxLines - 1 ? line + " …" : line, x, y);
      line = w;
      y += lh;
      if (++n >= maxLines) return;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
}

let radial: THREE.Texture | null = null;
export function radialTexture(): THREE.Texture {
  if (radial) return radial;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.3, "rgba(255,255,255,0.6)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  radial = new THREE.CanvasTexture(c);
  return radial;
}

/** Deterministic PRNG so the town looks the same on every visit. */
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

