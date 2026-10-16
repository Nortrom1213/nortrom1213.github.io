import * as THREE from "three";
import { Stage } from "../../core/stage";
import type { Kit } from "../../core/assets";
import { centered } from "../../core/assets";
import { buildRoom, labelPlane, type Room } from "../../interiors/room";
import { buildChibi, flatMat, type Chibi } from "../../actors/chibi";
import type { Cylinder } from "../../core/physics";
import { el } from "../../ui/ui";
import * as panels from "../../ui/panels";
import type { Publication } from "../../data";
import { bits, candidates, DEFAULT_COMPLEXITY, generateCase, LOC_NAME, N, type Case, type Complexity, type LocId } from "./logic";
import { BARKEEP, REGULARS, spokenText, statementText } from "./cast";
import { boardBody, chainHtml, ensureStyle, type BoardState } from "./board";
import { deductionViz } from "./report";
import { awardBadge, formatClock, paperAction, showResult, type ResultAction } from "../../ui/results";
import { difficultyPicker, howToPlay } from "../../ui/howto";
import { boardKey, DIFFICULTIES, DIFF_ICON, DIFF_LABEL, getDifficulty, type Difficulty } from "../../ui/leaderboard";

// The Crooked Lantern: a cosy tavern where one of five regulars is a werewolf.
// Social-deduction mini-game after CSP4SDG (AAAI 2026) and Expected Target Entropy (CoG 2026).

const FURN = ["kitchenBar", "kitchenBarEnd", "stoolBar", "tableRound", "chair", "tableCloth", "bench", "rugRectangle", "rugRound", "loungeChair", "pottedPlant", "plantSmall2"];
const W = 16;
const D = 12;
const GAME_ID = "tavern";

/** Difficulty: how tangled the testimony is, and whether the reasoning assist may be used. */
const LEVELS: Record<Difficulty, { cx: Complexity; assist: "on" | "off" | "never"; desc: string }> = {
  easy: {
    cx: {
      meta: 0,
      minSteps: 2,
      fallbackSteps: 2,
      spicy: false,
      weights: [["not", 3], ["either", 2.2], ["together", 2], ["seatIs", 0.6], ["seatNot", 0.6], ["mySpot", 0.4], ["is", 0.4]],
    },
    assist: "on",
    desc: "Plain claims only (no “X is lying”), short proofs of 2–3 testimonies, and the reasoning assist starts switched on.",
  },
  normal: {
    cx: DEFAULT_COMPLEXITY,
    assist: "off",
    desc: "The full statement mix, including the occasional “X is lying”; most cases need 3 testimonies. The assist is optional.",
  },
  hard: {
    cx: {
      meta: 0.35,
      minSteps: 4,
      fallbackSteps: 3,
      spicy: false,
      weights: [["not", 1.6], ["either", 3], ["together", 2], ["seatIs", 2.2], ["seatNot", 2.2], ["mySpot", 1.6], ["is", 0.3]],
    },
    assist: "never",
    desc: "More meta and seating statements, proofs of 3–4 testimonies, and <b>no reasoning assist</b> — you are the constraint solver.",
  },
};

/** Where regulars stand for each seating area: x, z, idle yaw. */
const SLOTS: Record<LocId, [number, number, number][]> = {
  bar: [[-4.6, -2.05, 0], [-3.3, -2.05, 0.1], [-2.0, -2.05, -0.15]],
  hearth: [[5.6, -3.1, -Math.PI / 2 - 0.5], [5.6, 0.1, -Math.PI / 2 + 0.5]],
  window: [[-6.9, 1.1, 0.5], [-4.55, 2.85, -Math.PI / 2 - 0.3]],
};

interface Patron {
  chibi: Chibi;
  pos: THREE.Vector3;
  yaw: number;
  facing: number;
  body: Cylinder;
  ears: THREE.Group;
}

export class TavernStage extends Stage {
  readonly id = "tavern";
  readonly title = "The Tavern";
  private room!: Room;
  private patrons: Patron[] = [];
  private barkeep!: Chibi;
  private barkeepFacing = 0;
  private fireLight!: THREE.PointLight;
  private flames: THREE.Mesh[] = [];
  private flash!: THREE.PointLight;
  private boardTex!: THREE.CanvasTexture;
  private boardCanvas = document.createElement("canvas");

  private kase!: Case;
  private heard: boolean[] = [];
  private marks: string[] = [];
  private assist = false;
  private closed = false;
  private boardOpen = false;
  private hud: HTMLElement | null = null;
  private timers = new Set<number>();
  private active = false;
  private diff: Difficulty = getDifficulty(GAME_ID);
  /** Regulars in the order their testimony was first heard. */
  private order: number[] = [];
  /** Seconds since the first interview of this case. */
  private caseT = 0;

  requiredModels(): [Kit, string][] {
    return FURN.map((n) => ["furniture", n]);
  }

  protected build() {
    this.room = buildRoom(this, { w: W, d: D, h: 4.4, floor: "wood", wall: 0xd8b890, trim: 0x4a2a14, exit: { stage: "town", spawn: "from-tavern" }, windows: 2, lightColor: 0xffc080 });
    this.buildBar();
    this.buildFireplace(W / 2 - 0.45, -1.5);
    this.buildTables();
    this.buildBarrels();
    this.buildCaseBoard(3.2);

    // Regulars and the barkeep.
    REGULARS.forEach((r, i) => {
      const chibi = buildChibi(r.look);
      this.scene.add(chibi.root);
      const ears = this.wolfEars();
      ears.visible = false;
      // Attach to the animated body group (first child) so the ears follow emotes.
      (chibi.root.children[0] ?? chibi.root).add(ears);
      const pos = new THREE.Vector3();
      const p: Patron = { chibi, pos, yaw: 0, facing: 0, body: this.world.addCylinder(0, 0, 0.35, 0, 1.6, "npc"), ears };
      this.patrons.push(p);
      this.addInteractable({
        id: `regular-${i}`,
        pos,
        radius: 1.8,
        markerHeight: 2.1,
        label: () => (this.heard[i] ? `Ask ${r.short} again` : `Question ${r.name}`),
        onInteract: () => this.interview(i),
      });
    });
    this.barkeep = buildChibi(BARKEEP.look);
    this.barkeep.root.position.set(-6.0, 0, -4.5);
    this.scene.add(this.barkeep.root);
    this.addInteractable({
      id: "barkeep",
      pos: new THREE.Vector3(-6.0, 0, -3.4),
      radius: 2.0,
      markerHeight: 2.5,
      label: `Talk to ${BARKEEP.name} (barkeep)`,
      onInteract: () => this.talkBarkeep(),
    });
    this.flash = new THREE.PointLight(0xff3020, 0, 5, 2);
    this.scene.add(this.flash);
    this.newCase(false);
  }

  // ---- Set dressing ----------------------------------------------------------------

  private buildBar() {
    const z = -3.4;
    for (let i = 0; i < 6; i++) {
      const bar = centered("furniture", i === 5 ? "kitchenBarEnd" : "kitchenBar", 2.4);
      bar.position.set(-6.5 + i, 0, z);
      bar.rotation.y = Math.PI;
      this.scene.add(bar);
    }
    this.world.addBox(-4.0, z, 6.0, 0.8, 0, 1.1);
    for (const x of [-5.25, -3.95, -2.65, -1.35]) {
      const s = centered("furniture", "stoolBar", 2.4);
      s.position.set(x, 0, z + 0.75);
      this.scene.add(s);
    }
    // Mugs on the counter.
    const mug = flatMat(0xc8a060);
    const foam = flatMat(0xfff8e8);
    for (const x of [-4.7, -3.2, -2.1, -5.6]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 8), mug);
      m.position.set(x, 1.08, z + 0.15);
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.03, 8), foam);
      f.position.set(x, 1.17, z + 0.15);
      this.scene.add(m, f);
    }
    // Back shelf with bottles.
    const shelf = new THREE.Group();
    const wood = flatMat(0x5a3418);
    for (const y of [0.9, 1.6, 2.3]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 0.45), wood);
      b.position.y = y;
      shelf.add(b);
    }
    for (const sx of [-2.1, 2.1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.45), wood);
      side.position.set(sx, 1.25, 0);
      shelf.add(side);
    }
    const glassCols = [0x3a7a4a, 0x8a3a2a, 0xd8a040, 0x4a5a9a, 0x7a4a7a];
    for (const y of [0.94, 1.64, 2.34]) {
      for (let k = 0; k < 9; k++) {
        const hgt = 0.3 + ((k * 7 + y * 10) % 5) * 0.04;
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, hgt, 6), flatMat(glassCols[(k + Math.round(y * 3)) % glassCols.length], { rough: 0.3, emissive: 0x100804 }));
        bottle.position.set(-1.8 + k * 0.45, y + hgt / 2, 0);
        shelf.add(bottle);
      }
    }
    shelf.position.set(-4.4, 0, -D / 2 + 0.3);
    this.scene.add(shelf);
    this.world.addBox(-4.4, -D / 2 + 0.3, 4.3, 0.5, 0, 2.5);
    const sign = labelPlane(
      [{ text: "The Crooked Lantern", size: 64 }, { text: "ales · cider · questionable alibis", size: 26, font: "600 26px Nunito, sans-serif", color: "#f0d8a8" }],
      900, 200, "#3a2010", 4.2);
    sign.position.set(-4.4, 3.45, -D / 2 + 0.03);
    this.scene.add(sign);
  }

  private buildFireplace(x: number, z: number) {
    const g = new THREE.Group();
    const stone = flatMat(0x8a8078);
    const stoneDark = flatMat(0x5a524c);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 2.8), stone);
    body.position.set(0, 1.1, 0);
    const hole = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 1.5), flatMat(0x1a1210));
    hole.position.set(-0.25, 0.6, 0);
    const mantel = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.16, 3.1), flatMat(0x4a2a14));
    mantel.position.set(-0.1, 2.25, 0);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.1, 1.6), stoneDark);
    chimney.position.set(0.1, 3.4, 0);
    const hearth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 3.0), stoneDark);
    hearth.position.set(-0.75, 0.04, 0);
    g.add(body, hole, mantel, chimney, hearth);
    // Stone blocks for texture.
    for (let i = 0; i < 14; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.42), i % 2 ? stoneDark : flatMat(0x9a9088));
      b.position.set(-0.46, 1.3 + (i % 4) * 0.22, -1.25 + Math.floor(i / 4) * 0.8 + (i % 2) * 0.2);
      if (Math.abs(b.position.z) > 0.8 || b.position.y > 1.25) g.add(b);
    }
    // Logs + flames.
    const logMat = flatMat(0x4a2a14);
    for (const [lz, rot] of [[-0.2, 0.3], [0.2, -0.3]]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 6), logMat);
      log.rotation.set(Math.PI / 2, rot, 0);
      log.position.set(-0.3, 0.14, lz);
      g.add(log);
    }
    const fireCols: [number, number][] = [[0xff5a1a, 0.5], [0xff9a2a, 0.38], [0xffd860, 0.24]];
    fireCols.forEach(([col, hgt], k) => {
      for (const fz of [-0.25, 0.05, 0.3]) {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.12 - k * 0.025, hgt, 5), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9 }));
        f.position.set(-0.3 - k * 0.02, 0.2 + hgt / 2, fz + k * 0.03);
        f.userData.base = hgt;
        g.add(f);
        this.flames.push(f);
      }
    });
    // Mantel ornaments: candles and a tiny wolf-free portrait.
    for (const cz of [-1.1, 1.1]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6), flatMat(0xf4ecd8));
      c.position.set(-0.2, 2.44, cz);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd070 }));
      fl.position.set(-0.2, 2.59, cz);
      g.add(c, fl);
    }
    g.position.set(x, 0, z);
    g.traverse((o) => ((o as THREE.Mesh).castShadow = !(o as THREE.Mesh).isMesh || !((o as THREE.Mesh).material instanceof THREE.MeshBasicMaterial)));
    this.scene.add(g);
    this.world.addBox(x, z, 1.0, 3.0, 0, 2.4);
    this.fireLight = new THREE.PointLight(0xff8a3a, 7, 10, 1.6);
    this.fireLight.position.set(x - 1.0, 0.9, z);
    this.scene.add(this.fireLight);

    // A rug and an armchair facing the fire.
    const rug = centered("furniture", "rugRound", 3.2);
    rug.position.set(x - 2.2, 0.01, z);
    this.scene.add(rug);
    const chair = centered("furniture", "loungeChair", 2.4);
    chair.position.set(x - 3.0, 0, z);
    chair.rotation.y = Math.PI / 2;
    this.scene.add(chair);
    this.world.addBox(x - 3.0, z, 1.0, 1.0, 0, 0.9);
  }

  private buildTables() {
    // Window table (west wall).
    const wt = centered("furniture", "tableRound", 2.4);
    wt.position.set(-5.8, 0, 2.6);
    this.scene.add(wt);
    this.world.addCylinder(-5.8, 2.6, 0.75, 0, 0.9);
    for (const [cx, cz, rot] of [[-7.0, 2.6, Math.PI / 2], [-5.8, 3.85, Math.PI]] as const) {
      const c = centered("furniture", "chair", 2.4);
      c.position.set(cx, 0, cz);
      c.rotation.y = rot;
      this.scene.add(c);
    }
    // Long table in the middle with benches.
    const rug = centered("furniture", "rugRectangle", 4.4);
    rug.position.set(1.4, 0.01, 1.2);
    this.scene.add(rug);
    const lt = centered("furniture", "tableCloth", 2.4);
    lt.position.set(1.4, 0, 1.2);
    this.scene.add(lt);
    this.world.addBox(1.4, 1.2, 2.1, 1.1, 0, 0.85);
    for (const bz of [0.3, 2.1]) {
      const b = centered("furniture", "bench", 2.3);
      b.position.set(1.4, 0, bz);
      this.scene.add(b);
    }
    // Small round table near the door.
    const st = centered("furniture", "tableRound", 2.2);
    st.position.set(4.6, 0, 3.6);
    this.scene.add(st);
    this.world.addCylinder(4.6, 3.6, 0.7, 0, 0.9);
    for (const a of [0.6, 0.6 + Math.PI]) {
      const c = centered("furniture", "chair", 2.2);
      c.position.set(4.6 + Math.sin(a) * 1.25, 0, 3.6 + Math.cos(a) * 1.25);
      c.rotation.y = a + Math.PI;
      this.scene.add(c);
    }
    // Candles + hanging lanterns.
    const wax = flatMat(0xf4ecd8);
    for (const [x, z, y] of [[-5.8, 2.6, 0.9], [1.0, 1.2, 0.85], [4.6, 3.6, 0.85]]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 6), wax);
      c.position.set(x, y + 0.08, z);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffc860 }));
      f.position.set(x, y + 0.2, z);
      this.scene.add(c, f);
    }
    for (const [x, z] of [[1.4, 1.2], [-5.8, 2.6], [-3.3, -2.6]]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 4), flatMat(0x2a2a2a));
      chain.position.set(x, 3.95, z);
      const lan = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.24), new THREE.MeshStandardMaterial({ color: 0xffd080, emissive: 0xffa040, emissiveIntensity: 1.2 }));
      lan.position.set(x, 3.35, z);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.14, 4), flatMat(0x2a2a2a));
      cap.position.set(x, 3.58, z);
      cap.rotation.y = Math.PI / 4;
      this.scene.add(chain, lan, cap);
      const l = new THREE.PointLight(0xffb060, 2.4, 6, 1.8);
      l.position.set(x, 3.1, z);
      this.scene.add(l);
    }
    for (const [x, z, n] of [[7.2, 5.2, "pottedPlant"], [-7.4, -0.4, "plantSmall2"]] as const) {
      const p = centered("furniture", n, 2.4);
      p.position.set(x, 0, z);
      this.scene.add(p);
    }
  }

  private buildBarrels() {
    const woodM = flatMat(0x8a5a30);
    const hoop = flatMat(0x3a3a3a);
    const barrel = (x: number, y: number, z: number, lying = false) => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 10), woodM);
      const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.5, 10), woodM);
      g.add(b, mid);
      for (const hy of [-0.38, 0.38]) {
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.445, 0.445, 0.06, 10), hoop);
        h.position.y = hy;
        g.add(h);
      }
      g.position.set(x, y + (lying ? 0.46 : 0.5), z);
      if (lying) g.rotation.z = Math.PI / 2;
      g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      this.scene.add(g);
    };
    barrel(7.1, 0, -5.1);
    barrel(6.1, 0, -5.2);
    barrel(6.6, 1.0, -5.15);
    this.world.addBox(6.6, -5.15, 2.0, 1.0, 0, 2.0);
    barrel(-7.2, 0, 5.0);
    barrel(-6.1, 0, 5.2, true);
    this.world.addBox(-6.8, 5.1, 1.8, 1.0, 0, 1.0);
  }

  private buildCaseBoard(x: number) {
    this.boardCanvas.width = 1024;
    this.boardCanvas.height = 640;
    this.boardTex = new THREE.CanvasTexture(this.boardCanvas);
    this.boardTex.colorSpace = THREE.SRGBColorSpace;
    this.boardTex.anisotropy = 4;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0), new THREE.MeshStandardMaterial({ map: this.boardTex, roughness: 0.95 }));
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.08), flatMat(0x4a2a14));
    const g = new THREE.Group();
    frame.position.z = -0.03;
    board.position.z = 0.02;
    g.add(frame, board);
    g.position.set(x, 2.1, -D / 2 + 0.06);
    this.scene.add(g);
    this.addInteractable({
      id: "case-board",
      pos: new THREE.Vector3(x, 0, -D / 2 + 1.0),
      radius: 2.0,
      markerHeight: 3.4,
      label: "Study the Case board",
      onInteract: () => this.openBoard(),
    });
  }

  private wolfEars() {
    const g = new THREE.Group();
    const fur = flatMat(0x6a5040);
    const pink = flatMat(0xd88080);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 4), fur);
      ear.position.set(sx * 0.17, 1.53, -0.02);
      ear.rotation.z = -sx * 0.3;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.15, 4), pink);
      inner.position.set(sx * 0.165, 1.52, 0.03);
      inner.rotation.z = -sx * 0.3;
      g.add(ear, inner);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 5), fur);
    tail.position.set(0, 0.55, -0.3);
    tail.rotation.x = -2.2;
    g.add(tail);
    return g;
  }

  private drawBoard() {
    const g = this.boardCanvas.getContext("2d")!;
    const w = this.boardCanvas.width;
    const h = this.boardCanvas.height;
    const rng = (k: number) => ((Math.sin(k * 12.9898) * 43758.5453) % 1 + 1) % 1;
    g.fillStyle = "#b9875a";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = rng(i) < 0.5 ? "rgba(90,50,20,0.25)" : "rgba(255,220,170,0.2)";
      g.fillRect(rng(i + 0.3) * w, rng(i + 0.7) * h, 3, 3);
    }
    g.fillStyle = "#3a2010";
    g.fillRect(0, 0, w, 86);
    g.fillStyle = "#fbf0d8";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "700 44px Fraunces, Georgia, serif";
    g.fillText(this.closed ? "CASE CLOSED" : "CASE BOARD — who is the werewolf?", w / 2, 45);
    const cw = 186;
    for (let i = 0; i < N; i++) {
      const cx = 18 + i * (cw + 15);
      const cy = 112;
      g.save();
      g.translate(cx + cw / 2, cy + 240);
      g.rotate((rng(i + this.kase.seed % 97) - 0.5) * 0.06);
      g.fillStyle = this.heard[i] ? "#fff7dc" : "#e8dcc4";
      g.fillRect(-cw / 2, -240, cw, 480);
      g.fillStyle = "#c0503a";
      g.beginPath();
      g.arc(0, -228, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#3a2a1e";
      g.font = "800 32px Nunito, sans-serif";
      g.fillText(REGULARS[i].short, 0, -190);
      g.font = "600 22px Nunito, sans-serif";
      g.fillStyle = "#6e5a48";
      g.fillText(LOC_NAME[this.kase.seats[i]], 0, -158);
      if (this.heard[i]) {
        g.fillStyle = "#3a2a1e";
        g.font = "600 24px Nunito, sans-serif";
        this.wrap(g, `“${statementText(this.kase.statements[i], this.kase.seats)}”`, 0, -110, cw - 22, 30, 9);
      } else {
        g.fillStyle = "#a89880";
        g.font = "800 120px Fraunces, Georgia, serif";
        g.fillText("?", 0, 20);
      }
      if (this.closed && i === this.kase.culprit) {
        g.rotate(-0.25);
        g.strokeStyle = "#b02a1a";
        g.lineWidth = 6;
        g.strokeRect(-cw / 2 + 6, 120, cw - 12, 64);
        g.fillStyle = "#b02a1a";
        g.font = "900 34px Nunito, sans-serif";
        g.fillText("WEREWOLF", 0, 152);
      }
      g.restore();
    }
    this.boardTex.needsUpdate = true;
  }

  private wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) {
    const words = text.split(/\s+/);
    let line = "";
    let n = 0;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (g.measureText(test).width > maxW && line) {
        g.fillText(line, x, y + n * lh);
        n++;
        line = word;
        if (n >= maxLines) return;
      } else line = test;
    }
    if (line) g.fillText(line, x, y + n * lh);
  }

  // ---- Case flow ---------------------------------------------------------------------

  private newCase(announce: boolean) {
    if (this.revealing) return;
    const seed = (Math.random() * 0x7fffffff) >>> 0;
    const lv = LEVELS[this.diff];
    try {
      this.kase = generateCase(seed, lv.cx);
    } catch {
      this.kase = generateCase(seed);
    }
    this.assist = lv.assist === "on";
    this.order = [];
    this.caseT = 0;
    this.heard = new Array(N).fill(false);
    this.marks = new Array(N).fill("");
    this.closed = false;
    this.flash.intensity = 0;
    // Seat everyone according to the new case.
    const used: Record<LocId, number> = { bar: 0, hearth: 0, window: 0 };
    this.patrons.forEach((p, i) => {
      const loc = this.kase.seats[i];
      const [x, z, yaw] = SLOTS[loc][used[loc]++];
      p.pos.set(x, 0, z);
      p.yaw = p.facing = yaw;
      p.body.x = x;
      p.body.z = z;
      p.ears.visible = false;
      p.chibi.root.position.copy(p.pos);
      p.chibi.root.rotation.y = yaw;
    });
    this.drawBoard();
    this.updateHud();
    if (announce) {
      this.game.audio.sfx("coin");
      this.game.ui.toast(`🌕 New case #${this.caseNo()}: the regulars shuffle seats. One of them is a werewolf…`, 3400);
    }
  }

  private caseNo() {
    return (this.kase.seed % 10000).toString().padStart(4, "0");
  }

  private interview(i: number) {
    const r = REGULARS[i];
    const st = this.kase.statements[i];
    const first = !this.heard[i];
    if (first && !this.closed) this.order.push(i);
    this.heard[i] = true;
    this.patrons[i].chibi.emote("talk");
    this.drawBoard();
    this.updateHud();
    const open = r.openers[(this.kase.seed + i) % r.openers.length];
    const close = r.closers[(this.kase.seed >> 3) % r.closers.length];
    const lines = this.closed ? [spokenText(st, this.kase.seats), "Case's closed though, isn't it? Ask Marigold for a fresh one."] : [open, spokenText(st, this.kase.seats), close];
    this.game.ui.dialogue(r.name, r.role, lines, () => {
      if (!first || this.closed) return;
      const n = this.heard.filter(Boolean).length;
      this.game.ui.toast(`📝 Noted ${r.short}'s testimony (${n}/${N}).`);
      if (n === N) this.game.ui.toast("All testimony collected — study the <b>Case board</b>, then accuse.", 3600);
    });
  }

  private boardState(): BoardState {
    const lv = LEVELS[this.diff];
    const allowed = lv.assist !== "never";
    return { case: this.kase, heard: this.heard, assist: this.assist && allowed, assistAllowed: allowed, metaRate: lv.cx.meta, marks: this.marks, closed: this.closed };
  }

  private boardPanel() {
    return {
      title: "Case Board",
      kicker: `Tavern Whodunit · case #${this.caseNo()}`,
      wide: true,
      body: boardBody(this.boardState(), {
        toggleAssist: () => {
          if (LEVELS[this.diff].assist === "never") return;
          this.assist = !this.assist;
          this.game.audio.sfx("click");
          this.refreshBoard();
          this.updateHud();
        },
        cycleMark: (h) => {
          this.marks[h] = this.marks[h] === "" ? "x" : this.marks[h] === "x" ? "?" : "";
          this.game.audio.sfx("click");
          this.refreshBoard();
        },
        accuse: (h) => this.confirmAccuse(h),
        newCase: () => {
          this.game.ui.closeAllPanels();
          this.newCase(true);
        },
      }),
      onClose: () => {
        this.boardOpen = false;
        this.game.audio.sfx("close");
      },
    };
  }

  private revealing = false;

  private openBoard() {
    if (!this.active || this.revealing) return;
    this.game.audio.sfx("open");
    this.boardOpen = true;
    this.game.ui.openPanel(this.boardPanel());
  }

  private refreshBoard() {
    if (!this.boardOpen) return;
    // Keep the scroll position while re-rendering.
    const body = document.querySelector("#panel-layer .panel-body");
    const top = body?.scrollTop ?? 0;
    this.game.ui.replacePanel(this.boardPanel());
    const nb = document.querySelector("#panel-layer .panel-body");
    if (nb) nb.scrollTop = top;
  }

  private accusePicker() {
    if (!this.active || this.revealing) return;
    const body = el("div");
    body.append(el("p", undefined, "Who do you want thrown out into the moonlight?"));
    const row = el("div", "mg-row");
    REGULARS.forEach((r, h) => {
      const b = el("button", "btn small warm", `🐺 ${r.short}`);
      b.addEventListener("click", () => this.confirmAccuse(h));
      row.append(b);
    });
    body.append(row);
    const n = this.heard.filter(Boolean).length;
    if (n < N) body.append(el("p", "wd-note", `You have heard ${n} of ${N} regulars. You can accuse early — if you're sure.`));
    this.game.ui.openPanel({ title: "Make an accusation", kicker: "Tavern Whodunit", body });
  }

  private confirmAccuse(h: number) {
    const r = REGULARS[h];
    const body = el("div");
    body.append(el("p", undefined, `Accuse <b>${r.name}</b> of being the werewolf? This closes case #${this.caseNo()}.`));
    const row = el("div", "mg-row");
    const yes = el("button", "btn small warm", `Yes, it's ${r.short}`);
    yes.addEventListener("click", () => this.resolve(h));
    const no = el("button", "btn small secondary", "Wait, not yet");
    no.addEventListener("click", () => this.game.ui.closePanel());
    row.append(yes, no);
    body.append(row);
    this.game.audio.sfx("alert");
    this.game.ui.openPanel({ title: "Final answer?", kicker: "Accusation", body });
  }

  private resolve(h: number) {
    if (!this.active || this.revealing) return;
    this.revealing = true;
    const ui = this.game.ui;
    ui.closeAllPanels();
    this.closed = true;
    const c = this.kase;
    const wolf = this.patrons[c.culprit];
    const right = h === c.culprit;
    this.drawBoard();
    this.updateHud();
    this.game.frozen = true;
    // Reveal: ears + tail pop out, a red flash, and the culprit jumps.
    wolf.ears.visible = true;
    wolf.chibi.emote("jump");
    this.flash.position.set(wolf.pos.x, 1.8, wolf.pos.z);
    this.flash.intensity = 9;
    this.game.audio.sfx(right ? "coin" : "alert");
    if (!right) this.patrons[h].chibi.emote("talk");
    else this.patrons.forEach((p, i) => i !== c.culprit && p.chibi.emote("wave"));
    const time = Math.round(this.caseT * 10) / 10;
    const order = [...this.order];
    const usedAssist = this.assist && LEVELS[this.diff].assist !== "never";
    // Only a proven accusation makes the leaderboard (no lucky guesses).
    const certain = candidates(order.map((i) => c.statements[i]), c.seats).length === 1;
    this.later(1300, () => {
      this.revealing = false;
      this.game.frozen = false;
      const g = this.game;
      let earnedNow = false;
      if (right) {
        earnedNow = awardBadge(g, "whodunit");
        if (!earnedNow) g.audio.sfx("success");
      } else g.audio.sfx("fail");
      const rep = deductionViz(c, order, h, LEVELS[this.diff].cx.meta);
      const extra = el("div", "mgx-box");
      extra.append(el("h4", undefined, "The deduction"), el("div", undefined, chainHtml(c)));
      const acts: (ResultAction | null)[] = [
        { id: "new", label: right ? "🎲 New case" : "🎲 Try another case", onClick: () => this.newCase(true) },
        { id: "difficulty", label: "Change difficulty", kind: "secondary", onClick: () => this.openIntro() },
        { id: "town", label: "Back to town", kind: "secondary", onClick: () => void g.goTo("town", "from-tavern") },
        paperAction(g, /CSP4SDG/i, "Tavern Whodunit · the research", "📄 CSP4SDG"),
        paperAction(g, /Expected Target Entropy/i, "Tavern Whodunit · the research", "📄 Expected Target Entropy"),
      ];
      const q = order.length;
      showResult({
        game: g,
        name: "Tavern Whodunit",
        icon: right ? "🐺" : "🌕",
        kicker: `Case #${this.caseNo()} · result`,
        title: right ? "Case closed!" : "The werewolf got away",
        win: right,
        difficulty: this.diff,
        subtitle: right
          ? certain
            ? `<b>${REGULARS[c.culprit].name}</b> sprouts ears and bolts for the door. The tavern cheers — your reasoning was airtight.`
            : `<b>${REGULARS[c.culprit].name}</b> sprouts ears and bolts! A lucky guess, though — the testimony you heard didn't pin it down yet, so it isn't logged on the leaderboard.`
          : `${REGULARS[h].name} is just a grumpy villager. The real werewolf was <b>${REGULARS[c.culprit].name}</b>, who slips out into the night.`,
        stats: [
          { icon: "🗣️", label: "Questions", value: `${q}/${N}`, hint: `solver needed ${c.minimal.length}` },
          { icon: "⏱", label: "Time", value: formatClock(time) },
          { icon: "★", label: "Entropy picks", value: `${rep.matches}/${rep.steps.filter((x) => x.matched !== null).length}`, hint: "matched the look-ahead" },
          { icon: "🧠", label: "Assist", value: usedAssist ? "on" : "off" },
        ],
        boards: {
          list: DIFFICULTIES.map((d) => ({ key: boardKey(GAME_ID, d), label: `${DIFF_ICON[d]} ${DIFF_LABEL[d]}` })),
          active: boardKey(GAME_ID, this.diff),
          heading: "Sharpest detectives · fewest questions, then fastest",
        },
        score: right && certain ? { value: q * 1000 + Math.min(999, time), text: `${q} question${q === 1 ? "" : "s"}`, note: `${formatClock(time)}${usedAssist ? " · assist" : ""}` } : undefined,
        badge: { id: "whodunit", earnedNow, lockedHint: "Unmask the werewolf to earn it." },
        viz: rep.viz,
        extra,
        actions: acts.filter((a): a is ResultAction => !!a),
      });
    });
  }

  private paper(re: RegExp): Publication | undefined {
    return this.game.data.publications.find((p) => re.test(p.title));
  }

  private rulesLines() {
    const csp = this.paper(/CSP4SDG/i);
    const lines: (string | { text: string; choices: { label: string; action: () => void }[] })[] = [
      "Welcome to the Crooked Lantern, love. Bad news: one of my five regulars is a werewolf tonight.",
      "Villagers always tell the truth. The werewolf always lies. Each regular will tell you one thing about the others.",
      "Question them, then study the Case board on the wall. Turn on the reasoning assist if you want to see the constraints at work.",
      "When you're certain, come back and tell me who to throw out — or accuse straight from the board.",
    ];
    if (csp) {
      lines.push({
        text: "Kaijie says this is how his CSP4SDG paper works: treat roles as a constraint problem, then use information theory to pick the next question. Want to read it?",
        choices: [
          { label: "📄 Read the paper", action: () => panels.publicationPanel(this.game.ui, csp, "Tavern Whodunit · the research") },
          { label: "Let's play", action: () => this.game.ui.toast("Walk up to a regular and press <b>E</b> to question them.") },
        ],
      });
    }
    return lines;
  }

  /** Intro panel: rules, the animated demo and the difficulty picker. */
  private openIntro() {
    const g = this.game;
    const ui = g.ui;
    const body = el("div");
    body.append(
      el("p", undefined, "One of the five regulars of the Crooked Lantern is a <b>werewolf</b>. Question everyone, reason over what they say, and throw the right one out into the moonlight."),
      howToPlay({
        demo: "deduction",
        rules: [
          "Walk up to a regular and press <b>E</b> (or tap) to hear their one piece of testimony.",
          "<b>Villagers always tell the truth; the werewolf always lies.</b> Exactly one suspect fits every statement.",
          "Cross suspects off on the <b>Case board</b>, then accuse — from the board or via Marigold at the bar.",
        ],
      }),
      difficultyPicker({
        gameId: GAME_ID,
        descriptions: { easy: LEVELS.easy.desc, normal: LEVELS.normal.desc, hard: LEVELS.hard.desc },
        onClick: () => g.audio.sfx("click"),
        onChange: (d) => {
          this.diff = d;
          this.newCase(false);
          ui.toast(`🌕 New ${DIFF_LABEL[d].toLowerCase()} case #${this.caseNo()} — the regulars shuffle seats.`, 2600);
        },
      }),
      el("p", "wd-note", "Changing difficulty deals a fresh case."),
    );
    const row = el("div", "mg-row");
    const start = el("button", "btn", "Start questioning");
    start.addEventListener("click", () => ui.closePanel());
    const welcome = el("button", "btn small secondary", "💬 Marigold's welcome");
    welcome.addEventListener("click", () => {
      ui.closeAllPanels();
      ui.dialogue(BARKEEP.name, BARKEEP.role, this.rulesLines());
    });
    row.append(start, welcome);
    const csp = this.paper(/CSP4SDG/i);
    if (csp) {
      const b = el("button", "btn small secondary", `📄 CSP4SDG${csp.venue ? ` · ${csp.venue}` : ""}`);
      b.addEventListener("click", () => panels.publicationPanel(ui, csp, "Tavern Whodunit · the research"));
      row.append(b);
    }
    body.append(row);
    ui.openPanel({
      title: "Tavern Whodunit",
      kicker: "Social-deduction mini-game",
      body,
      wide: true,
      onClose: () => {
        g.audio.sfx("close");
        if (this.active && !this.order.length && !this.closed) ui.toast("Walk up to a regular and press <b>E</b> to question them.");
      },
    });
  }

  private talkBarkeep() {
    this.barkeep.emote("talk");
    const ui = this.game.ui;
    const choices: { label: string; action: () => void }[] = [];
    if (!this.closed) choices.push({ label: "🐺 Accuse someone", action: () => this.accusePicker() });
    else choices.push({ label: "🎲 New case", action: () => this.newCase(true) });
    choices.push({ label: "📋 Case board", action: () => this.openBoard() });
    choices.push({ label: "❓ Rules & difficulty", action: () => this.openIntro() });
    const csp = this.paper(/CSP4SDG/i);
    const ete = this.paper(/Expected Target Entropy/i);
    if (csp || ete) {
      choices.push({
        label: "📄 The research",
        action: () =>
          ui.dialogue(BARKEEP.name, BARKEEP.role, [
            {
              text: "Two of Kaijie's papers are behind this game: one on solving roles as constraints, one on choosing actions by expected target entropy.",
              choices: [
                ...(csp ? [{ label: "CSP4SDG (AAAI 2026)", action: () => panels.publicationPanel(ui, csp, "Tavern Whodunit · the research") }] : []),
                ...(ete ? [{ label: "Expected Target Entropy (CoG 2026)", action: () => panels.publicationPanel(ui, ete, "Tavern Whodunit · the research") }] : []),
              ],
            },
          ]),
      });
    }
    const n = this.heard.filter(Boolean).length;
    const greet = this.closed ? "That case is closed. Fancy another?" : n === 0 ? "Go on, talk to the regulars. They don't bite. Well… one might." : `${n} of ${N} testimonies so far. What'll it be, detective?`;
    ui.dialogue(BARKEEP.name, BARKEEP.role, [{ text: greet, choices }]);
  }

  // ---- HUD -------------------------------------------------------------------------

  private updateHud() {
    if (!this.hud || !this.kase) return;
    const n = this.heard.filter(Boolean).length;
    const cands = candidates(this.kase.statements.filter((_, i) => this.heard[i]), this.kase.seats);
    const info = this.assist && LEVELS[this.diff].assist !== "never"
      ? `<br/><span style="font-size:0.82rem">Suspects left: <b>${cands.length}</b> · ${bits(cands.length).toFixed(2)} bits</span>`
      : "";
    const status = this.closed ? " · <b>closed</b>" : "";
    this.hudText.innerHTML = `<b>🐺 Tavern Whodunit</b><br/>Case #${this.caseNo()}${status} · Testimony <b>${n}/${N}</b>${info}`;
  }

  private hudText = el("div");

  private mountHud() {
    this.unmountHud();
    ensureStyle();
    const card = el("div", "mg-card");
    const row = el("div", "mg-row");
    const board = el("button", "btn small", "📋 Case board");
    board.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.game.ui.modalOpen) this.openBoard();
    });
    const nc = el("button", "btn small secondary", "🎲 New case");
    nc.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.game.ui.modalOpen) this.newCase(true);
    });
    row.append(board, nc);
    card.append(this.hudText, row);
    this.game.ui.mgLayer.append(card);
    this.hud = card;
    this.updateHud();
  }

  private unmountHud() {
    this.hud?.remove();
    this.hud = null;
  }

  private later(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (this.active) fn();
    }, ms);
    this.timers.add(id);
  }

  // ---- Stage hooks -----------------------------------------------------------------

  onEnter() {
    this.active = true;
    if (this.closed) this.newCase(false);
    this.boardOpen = false;
    this.mountHud();
    if (getDifficulty(GAME_ID) !== this.diff) {
      this.diff = getDifficulty(GAME_ID);
      this.newCase(false);
    }
    this.later(650, () => {
      if (!this.game.ui.modalOpen) this.openIntro();
    });
  }

  onExit() {
    this.active = false;
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    this.unmountHud();
    this.boardOpen = false;
    this.flash.intensity = 0;
    this.game.frozen = false;
  }

  update(dt: number, t: number) {
    this.room.update(this.game.sky.night);
    if (this.order.length && !this.closed) this.caseT += dt;
    const pp = this.game.player.pos;
    for (const p of this.patrons) {
      const d = Math.hypot(pp.x - p.pos.x, pp.z - p.pos.z);
      const target = d < 3.2 ? Math.atan2(pp.x - p.pos.x, pp.z - p.pos.z) : p.yaw;
      let dy = target - p.facing;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      p.facing += dy * Math.min(1, dt * 5);
      p.chibi.root.rotation.y = p.facing;
      p.chibi.animate(dt, 0, false);
    }
    const bk = this.barkeep.root.position;
    const bd = Math.hypot(pp.x - bk.x, pp.z - bk.z);
    const bt = bd < 4 ? Math.atan2(pp.x - bk.x, pp.z - bk.z) : 0;
    let bdy = bt - this.barkeepFacing;
    bdy = Math.atan2(Math.sin(bdy), Math.cos(bdy));
    this.barkeepFacing += bdy * Math.min(1, dt * 4);
    this.barkeep.root.rotation.y = this.barkeepFacing;
    this.barkeep.animate(dt, 0, false);

    // Fire flicker.
    const f = 0.82 + Math.sin(t * 11.3) * 0.08 + Math.sin(t * 6.7 + 1.3) * 0.07 + Math.sin(t * 23.1) * 0.04;
    this.fireLight.intensity = 7 * f;
    this.flames.forEach((m, i) => {
      const k = 0.85 + Math.sin(t * (9 + i) + i * 1.7) * 0.18;
      m.scale.set(1, k, 1);
      m.position.y = 0.2 + ((m.userData.base as number) * k) / 2;
    });
    if (this.flash.intensity > 0) this.flash.intensity = Math.max(0, this.flash.intensity - dt * 6);
  }
}
