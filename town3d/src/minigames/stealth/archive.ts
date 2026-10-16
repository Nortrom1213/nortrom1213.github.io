import * as THREE from "three";
import { Stage } from "../../core/stage";
import type { Kit } from "../../core/assets";
import type { CameraLimits } from "../../core/camera";
import { save } from "../../core/save";
import { flatMat } from "../../actors/chibi";
import { el } from "../../ui/ui";
import { publicationPanel } from "../../ui/panels";
import { escapeHtml } from "../../data";
import { awardBadge, paperAction, showResult, type ResultAction } from "../../ui/results";
import { difficultyPicker, howToPlay } from "../../ui/howto";
import { boardKey, DIFFICULTIES, DIFF_ICON, DIFF_LABEL, getDifficulty, topEntries, type Difficulty } from "../../ui/leaderboard";
import { Grid, X0, Z0 } from "./grid";
import { PotentialFields } from "./fields";
import { DEFAULT_TUNING, Guard, type GuardSpawn, type GuardTuning } from "./guards";
import { Heatmap } from "./heatmap";
import { ArchiveHud, LAYERS, formatTime } from "./hud";
import { buildScenery, FURNITURE, type ArchiveScenery } from "./scenery";
import { StealthTelemetry, stealthViz } from "./report";

// The Archive: a night-time museum heist. Guards patrol with composite potential
// fields (Xu et al., AIIDE 2025 Best Student Paper; multi-guard extension, CoG 2026).
// Steal the manuscript from the far gallery and walk it back out of the entrance.

const LIMITS: CameraLimits = { minDist: 9, maxDist: 17, minPitch: 0.9, maxPitch: 1.35, collide: false };
const SPAWN = new THREE.Vector3(0, 0, 9.2);
const LECTERN = new THREE.Vector3(0, 0, Z0 + 2.5);
const EXIT = new THREE.Vector3(0, 0, 11.2);
const NOISE_SPEED = 5.5;
const GAME_ID = "archive";
const GUARDS: GuardSpawn[] = [
  { x: 0.5, z: Z0 + 5.5, heading: Math.PI / 2, accent: 0x6ad8ff }, // north gallery
  { x: X0 + 5.5, z: Z0 + 13.5, heading: 0, accent: 0xff7ad8 }, // west gallery
  { x: X0 + 26.5, z: Z0 + 13.5, heading: Math.PI, accent: 0xb4ff6a }, // east gallery
  { x: -0.5, z: Z0 + 13.5, heading: -Math.PI / 2, accent: 0xffb84a }, // central gallery (Hard only)
];

/** What each difficulty changes: team size, guard speed / vision, meter and hearing. */
interface StealthLevel {
  guards: number;
  tuning: GuardTuning;
  /** Detection-meter fill multiplier. */
  meter: number;
  /** How far running footsteps carry (m). */
  hear: number;
  desc: string;
}

const deg = THREE.MathUtils.degToRad;
const LEVELS: Record<Difficulty, StealthLevel> = {
  easy: {
    guards: 2,
    tuning: { fov: deg(58), range: 5.5, alertRange: 7, patrolSpeed: 1.8, chaseSpeed: 3.0 },
    meter: 0.7,
    hear: 4.5,
    desc: "2 slower guards with short 58° / 5.5 m vision cones; the meter fills gently and footsteps carry 4.5 m.",
  },
  normal: {
    guards: 3,
    tuning: { ...DEFAULT_TUNING },
    meter: 1,
    hear: 6,
    desc: "3 guards with 70° / 7 m vision cones. Running is heard 6 m away.",
  },
  hard: {
    guards: 4,
    tuning: { fov: deg(80), range: 8, alertRange: 9.5, patrolSpeed: 2.45, chaseSpeed: 4.0 },
    meter: 1.35,
    hear: 7.5,
    desc: "4 faster guards (one in the central gallery) with wide 80° / 8 m cones; the meter fills 35% faster and footsteps carry 7.5 m.",
  },
};

const PAPER = /Generic Guard AI/i;

type Phase = "intro" | "play" | "caught" | "over" | "won";

interface NoiseRing {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
}

export class ArchiveStage extends Stage {
  readonly id = "archive";
  readonly title = "The Archive";
  music: Stage["music"] = "tense";
  allowJump = false;
  cameraLimits = LIMITS;

  private grid!: Grid;
  private fields!: PotentialFields;
  /** Active patrol team (a prefix of allGuards, chosen by difficulty). */
  private guards: Guard[] = [];
  private allGuards: Guard[] = [];
  private diff: Difficulty = getDifficulty(GAME_ID);
  private tel = new StealthTelemetry();
  private heatmap!: Heatmap;
  private hud!: ArchiveHud;
  private sc!: ArchiveScenery;
  private carried = new THREE.Group();
  private rings: NoiseRing[] = [];

  private phase: Phase = "intro";
  private time = 0;
  private meter = 0;
  private carrying = false;
  private attempt = 0;
  private caughtT = 0;
  private fieldT = 0;
  private noiseT = 0;
  private layerIdx = 0;
  private toldNoise = false;

  requiredModels(): [Kit, string][] {
    return FURNITURE.map((n) => ["furniture", n] as [Kit, string]);
  }

  protected build() {
    this.grid = new Grid();
    this.sc = buildScenery(this, this.grid, this.game.quality);
    this.fields = new PotentialFields(this.grid);
    this.heatmap = new Heatmap(this.grid);
    this.scene.add(this.heatmap.mesh);
    this.allGuards = GUARDS.map((s) => new Guard(this.grid, s, this.scene));
    this.applyDifficulty(this.diff);

    // The manuscript, carried above the player's head once taken.
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.34), flatMat(0x7a1e2a));
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.3), flatMat(0xfff2c8, { emissive: 0xd0902a }));
    pages.position.y = 0.06;
    this.carried.add(cover, pages);
    this.carried.visible = false;
    this.scene.add(this.carried);

    // Expanding rings show how far running footsteps carry (the hearing radius).
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffa54a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40).rotateX(-Math.PI / 2), mat);
      mesh.visible = false;
      mesh.renderOrder = 6;
      this.scene.add(mesh);
      this.rings.push({ mesh, mat, life: 0 });
    }

    this.spawns.default = { pos: SPAWN.clone(), yaw: Math.PI };
    this.addInteractable({
      id: "manuscript",
      pos: LECTERN.clone(),
      radius: 1.9,
      label: "Take the manuscript",
      markerHeight: 1.9,
      enabled: () => this.phase === "play" && !this.carrying,
      onInteract: () => this.takeManuscript(),
    });
    this.addInteractable({
      id: "exit",
      pos: EXIT.clone(),
      radius: 1.6,
      label: () => (this.carrying ? "Escape with the manuscript" : "Leave the Archive"),
      markerHeight: 2.6,
      onInteract: () => {
        if (this.carrying && this.phase === "play") this.win();
        else this.leave();
      },
    });

    this.hud = new ArchiveHud({
      onHeatmap: () => this.cycleHeatmap(),
      onRestart: () => this.restart(),
      onLeave: () => this.leave(),
    });
  }

  // ---- Lifecycle -------------------------------------------------------------------

  onEnter() {
    const g = this.game;
    this.applyDifficulty(getDifficulty(GAME_ID));
    this.attempt = 0;
    this.layerIdx = 0;
    this.toldNoise = false;
    this.applyLayer();
    this.resetRun();
    this.hud.mount(g.ui.mgLayer);
    g.rig.pitch = 1.12;
    g.rig.dist = 13;
    g.rig.snap(g.player.pos);
    window.addEventListener("keydown", this.onKey);
    this.showIntro();
  }

  onExit() {
    this.hud.unmount();
    window.removeEventListener("keydown", this.onKey);
    this.game.frozen = false;
    this.phase = "intro";
  }

  private onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    if (e.key.toLowerCase() === "h" && !e.repeat && !this.game.ui.modalOpen) this.cycleHeatmap();
  };

  /** Pick the team and tune every guard for a difficulty. */
  private applyDifficulty(d: Difficulty) {
    this.diff = d;
    const lv = LEVELS[d];
    this.guards = this.allGuards.slice(0, lv.guards);
    this.allGuards.forEach((gd, i) => {
      gd.tuning = { ...lv.tuning };
      gd.setActive(i < lv.guards);
    });
  }

  /** Fresh run: guards home, fields re-seeded, manuscript back on its lectern. */
  private resetRun() {
    this.attempt++;
    this.time = 0;
    this.meter = 0;
    this.carrying = false;
    this.caughtT = 0;
    this.fieldT = 0;
    this.noiseT = 0;
    this.fields.reset();
    for (const gd of this.guards) {
      gd.reset();
      gd.sweep(this.fields);
    }
    this.tel.reset(this.guards);
    this.sc.book.visible = true;
    this.carried.visible = false;
    for (const r of this.rings) {
      r.life = 0;
      r.mesh.visible = false;
    }
    const p = this.game.player;
    p.pos.copy(SPAWN);
    p.vel.set(0, 0, 0);
    this.heatmap.snap(this.fields);
    this.hud.setAttempt(this.attempt);
    this.hud.setObjective("Steal the manuscript from the <b>north gallery</b>.");
    this.hud.setMeter(0, false);
    this.hud.setTime(0, this.best());
  }

  private startPlay() {
    this.phase = "play";
    this.game.frozen = false;
  }

  private restart() {
    if (this.phase === "won" || this.phase === "over" || this.game.ui.modalOpen) return;
    this.game.audio.sfx("click");
    this.resetRun();
    this.startPlay();
  }

  private leave() {
    void this.game.goTo("town", "from-archive");
  }

  /** Legacy best-time stat on Normal; separate keys for the other difficulties. */
  private statKey() {
    return this.diff === "normal" ? "archive_time" : `archive_time_${this.diff}`;
  }

  private bestCache: { diff: unknown; v: number | undefined; at: number } | null = null;

  private best(): number | undefined {
    const now = performance.now();
    if (!this.bestCache || this.bestCache.diff !== this.diff || now - this.bestCache.at > 2000) {
      this.bestCache = { diff: this.diff, v: topEntries(boardKey(GAME_ID, this.diff))[0]?.score ?? save.get().stats[this.statKey()], at: now };
    }
    return this.bestCache.v;
  }

  // ---- Panels ------------------------------------------------------------------------

  private showIntro() {
    const g = this.game;
    this.phase = "intro";
    g.frozen = false;
    const body = el("div");
    body.append(
      el(
        "p",
        undefined,
        "The original <b>manuscript on composite potential fields</b> rests on a lectern in the far north gallery. Sneak in, take it, and walk it back out through the entrance without filling the detection meter.",
      ),
      howToPlay({
        demo: "stealth",
        rules: [
          "Sneak to the <b>north gallery</b>, take the manuscript (<b>E</b> / tap), then walk it out through the <b>entrance</b>.",
          "Stay out of the <b>vision cones</b>: the meter fills faster the closer a guard is. Walls, shelves and cabinets block sight.",
          "<b>Shift</b> runs but is loud — guards hear you and their belief map spikes. <b>H</b> / Heatmap shows what they think.",
        ],
      }),
      difficultyPicker({
        gameId: GAME_ID,
        descriptions: { easy: LEVELS.easy.desc, normal: LEVELS.normal.desc, hard: LEVELS.hard.desc },
        onClick: () => g.audio.sfx("click"),
        onChange: (d) => {
          this.applyDifficulty(d);
          this.attempt = 0;
          this.resetRun();
        },
      }),
    );
    const how = el("details");
    how.innerHTML = `<summary style="cursor:pointer;font-weight:800">How the guards think</summary>
      <p style="font-size:0.9rem;line-height:1.5;background:rgba(42,90,138,0.08);border-radius:10px;padding:8px 10px;margin:6px 0 0">
        Each guard scores every floor cell by how long it has gone unseen (<i>information</i>)
        and how likely you are to be there (<i>confidence</i>), minus how far it has to walk (<i>connectivity</i>), and avoids cells its team-mates already cover.
        Seeing or hearing you spikes the confidence map; once they lose you it spreads out, so they search where you could have gone.</p>`;
    body.append(how);
    const row = el("div", "mg-row");
    row.style.marginTop = "12px";
    const start = el("button", "btn", "Start the heist");
    start.addEventListener("click", () => g.ui.closePanel());
    row.append(start);
    const pubs = g.data.publications;
    const papers: [string, string][] = [
      ["Generic Guard AI", "Guard AI paper"],
      ["Multi-Guard Patrol", "Multi-guard patrol"],
      ["Stealth in Games", "Stealth survey"],
    ];
    for (const [needle, label] of papers) {
      const pub = pubs.find((p) => p.title.toLowerCase().includes(needle.toLowerCase()));
      if (!pub) continue;
      const b = el("button", "btn small secondary", `📄 ${escapeHtml(label)}${pub.venue ? ` · ${escapeHtml(pub.venue)}` : ""}`);
      b.title = pub.title;
      b.addEventListener("click", () => {
        g.audio.sfx("click");
        publicationPanel(g.ui, pub, "Research behind The Archive");
      });
      row.append(b);
    }
    body.append(row);
    g.ui.openPanel({
      title: "The Archive",
      kicker: "Stealth mini-game",
      body,
      wide: true,
      onClose: () => {
        if (this.phase === "intro" && this.game.stage === this) this.startPlay();
      },
    });
  }

  /** Shared buttons for both result screens. */
  private resultActions(again: string): ResultAction[] {
    const acts: (ResultAction | null)[] = [
      { id: "again", label: again, onClick: () => {} },
      {
        id: "difficulty",
        label: "Change difficulty",
        kind: "secondary",
        onClick: () => {
          this.attempt = 0;
          this.resetRun();
          this.showIntro();
        },
      },
      { id: "town", label: "Back to town", kind: "secondary", onClick: () => this.leave() },
      paperAction(this.game, PAPER, "Research behind The Archive"),
    ];
    return acts.filter((a): a is ResultAction => !!a);
  }

  private boards() {
    return {
      list: DIFFICULTIES.map((d) => ({ key: boardKey(GAME_ID, d), label: `${DIFF_ICON[d]} ${DIFF_LABEL[d]}` })),
      active: boardKey(GAME_ID, this.diff),
      heading: "Fastest heists · local top 5",
    };
  }

  /** How many guards went to full alarm at some point this round. */
  private alarmedGuards() {
    return this.tel.states.filter((lane) => lane.includes(2)).length;
  }

  /** Closing a result (✕, Esc or "Play again") starts a fresh run. */
  private afterResult = (via: string | null) => {
    if (via === "town" || via === "difficulty" || this.game.stage !== this) return;
    if (this.phase === "won") this.attempt = 0;
    this.resetRun();
    this.startPlay();
  };

  private win() {
    const g = this.game;
    this.phase = "won";
    g.frozen = true;
    const secs = Math.round(this.time * 10) / 10;
    const p = g.player.pos;
    this.tel.finish(secs, false, this.fields, this.grid, this.guards, p.x, p.z);
    g.audio.sfx("success");
    const earnedNow = awardBadge(g, "archive");
    save.bestStat(this.statKey(), secs, true);
    this.hud.setObjective("Escaped! 🎉");
    const alarms = this.alarmedGuards();
    showResult({
      game: g,
      name: "The Archive",
      icon: "🗝️",
      kicker: "Stealth mini-game · result",
      title: "Manuscript recovered!",
      win: true,
      difficulty: this.diff,
      subtitle: `You slipped past ${this.guards.length} potential-field guards with the manuscript.`,
      stats: [
        { icon: "⏱", label: "Time", value: formatTime(secs) },
        { icon: "🔁", label: "Attempt", value: String(this.attempt) },
        { icon: "🚨", label: "Alarms", value: `${alarms}/${this.guards.length}`, hint: alarms ? "guards that chased you" : "never chased — clean!" },
        { icon: "📜", label: "Grab → exit", value: this.tel.takenAt !== null ? formatTime(Math.max(0, secs - this.tel.takenAt)) : "—" },
      ],
      boards: this.boards(),
      score: { value: secs, text: formatTime(secs), note: `attempt ${this.attempt}` },
      badge: { id: "archive", earnedNow },
      viz: stealthViz(this.tel, this.grid, LECTERN),
      actions: this.resultActions("Play again"),
      onClose: this.afterResult,
    });
    this.hud.setTime(secs, this.best());
  }

  private caught(by: Guard | null) {
    const g = this.game;
    this.phase = "caught";
    this.caughtT = 1.3;
    g.frozen = true;
    g.audio.sfx("fail");
    by?.chibi.emote("talk");
    this.hud.setMeter(1, true);
    const p = g.player.pos;
    this.tel.finish(Math.round(this.time * 10) / 10, true, this.fields, this.grid, this.guards, p.x, p.z);
    g.ui.toast("🔦 <b>Spotted!</b>", 1400);
  }

  /** The guard walked you out: show the round, then retry when the panel closes. */
  private showCaught() {
    const g = this.game;
    this.phase = "over";
    const secs = Math.round(this.time * 10) / 10;
    const alarms = this.alarmedGuards();
    showResult({
      game: g,
      name: "The Archive",
      icon: "🔦",
      kicker: "Stealth mini-game · result",
      title: "Spotted!",
      win: false,
      difficulty: this.diff,
      subtitle: this.carrying ? "So close — you had the manuscript in hand when the guards closed in." : "A guard caught you before you reached the manuscript.",
      stats: [
        { icon: "⏱", label: "Survived", value: formatTime(secs) },
        { icon: "🔁", label: "Attempt", value: String(this.attempt) },
        { icon: "🚨", label: "Alarms", value: `${alarms}/${this.guards.length}` },
        { icon: "📜", label: "Manuscript", value: this.carrying ? "in hand" : "on lectern" },
      ],
      boards: this.boards(),
      badge: { id: "archive", earnedNow: false, lockedHint: "Escape with the manuscript to earn it." },
      viz: stealthViz(this.tel, this.grid, LECTERN),
      actions: this.resultActions("Try again"),
      onClose: this.afterResult,
    });
  }

  private takeManuscript() {
    const g = this.game;
    this.carrying = true;
    this.sc.book.visible = false;
    this.carried.visible = true;
    this.tel.takenAt = this.time;
    g.audio.sfx("coin");
    // Lifting it chimes the case: the guards' confidence map lights up around the lectern.
    this.fields.addEvidence(this.grid.cellAt(LECTERN.x + 0.5, LECTERN.z), 0.6, 2.5);
    for (const gd of this.guards) {
      if (Math.hypot(gd.x - LECTERN.x, gd.z - LECTERN.z) < 12) gd.hear(LECTERN.x, LECTERN.z);
    }
    g.ui.toast("📜 Got it! The case chimes — guards' <b>confidence</b> spikes here. Back to the entrance!", 3600);
    this.hud.setObjective("Return to the <b>entrance</b> with the manuscript!");
  }

  private cycleHeatmap() {
    this.layerIdx = (this.layerIdx + 1) % LAYERS.length;
    this.game.audio.sfx("click");
    this.applyLayer();
  }

  private applyLayer() {
    const layer = LAYERS[this.layerIdx];
    const on = layer !== "off";
    if (on) {
      const wasOff = !this.heatmap.on;
      this.heatmap.layer = layer;
      if (wasOff) this.heatmap.snap(this.fields);
    }
    this.heatmap.on = on;
    for (const gd of this.allGuards) gd.setDebug(on);
    this.hud.setLayer(layer);
  }

  private emitNoise(x: number, z: number) {
    const r = this.rings.find((q) => q.life <= 0) ?? this.rings[0];
    r.life = 1;
    r.mesh.position.set(x, 0.06, z);
    r.mesh.visible = true;
  }

  // ---- Frame -------------------------------------------------------------------------

  update(dt: number, t: number) {
    const g = this.game;
    const p = g.player.pos;
    this.heatmap.update(dt, this.fields);
    this.animateProps(dt, t);
    if (this.phase === "caught") {
      this.caughtT -= dt;
      if (this.caughtT <= 0) this.showCaught();
      return;
    }
    if (this.phase !== "play" || g.ui.modalOpen) return;

    const lv = LEVELS[this.diff];
    this.time += dt;
    const pc = this.grid.cellAt(p.x, p.z);

    // Running footsteps carry: nearby guards hear and the confidence map spikes.
    this.noiseT -= dt;
    const speed = Math.hypot(g.player.vel.x, g.player.vel.z);
    if (speed > NOISE_SPEED && this.noiseT <= 0) {
      this.noiseT = 0.4;
      this.emitNoise(p.x, p.z);
      let heard = false;
      for (const gd of this.guards) {
        if (Math.hypot(gd.x - p.x, gd.z - p.z) < lv.hear) {
          gd.hear(p.x, p.z);
          heard = true;
        }
      }
      if (heard) {
        this.fields.addEvidence(pc, 0.75, 1.5);
        if (!this.toldNoise) {
          this.toldNoise = true;
          g.ui.toast("👂 A guard heard you running. Walk to stay quiet!", 3000);
        }
      }
    }

    // Sense, then act.
    let seen = false;
    let closest = Infinity;
    let closestRange = lv.tuning.range;
    let closestGuard: Guard | null = null;
    for (const gd of this.guards) {
      const s = gd.look(p.x, p.z);
      if (!s.sees) continue;
      seen = true;
      if (s.dist < closest) {
        closest = s.dist;
        closestRange = gd.alert > 0 ? gd.tuning.alertRange : gd.tuning.range;
        closestGuard = gd;
      }
      if (this.meter > 0.35 || s.dist < 2.5) gd.raiseAlarm();
      else gd.notice(p.x, p.z);
    }
    if (seen) this.fields.addEvidence(pc, 0.6 + 0.4 * this.meter, 1);
    let alarmed = false;
    for (const gd of this.guards) {
      gd.update(dt, t, this.fields, this.guards, p.x, p.z);
      gd.sweep(this.fields);
      if (gd.alert > 0) alarmed = true;
    }
    this.fieldT += dt;
    if (this.fieldT >= 0.1) {
      this.fields.tick(this.fieldT, seen ? pc : -1);
      this.fieldT = 0;
    }

    // Detection meter: fills faster the closer the watching guard is.
    if (seen) {
      const close = 1 - Math.min(1, closest / closestRange);
      this.meter = Math.min(1, this.meter + (0.3 + 1.7 * close ** 1.4) * lv.meter * dt);
    } else {
      this.meter = Math.max(0, this.meter - 0.3 * dt);
    }
    for (const gd of this.guards) {
      if (gd.alert > 0 && Math.hypot(gd.x - p.x, gd.z - p.z) < 0.85) {
        this.meter = 1;
        closestGuard = gd;
      }
    }
    this.tel.tick(dt, this.time, this.meter, this.guards, p.x, p.z);
    if (this.meter >= 1) {
      this.caught(closestGuard);
      return;
    }

    if (this.carrying && p.z > EXIT.z - 0.3 && Math.abs(p.x) < 2.2) {
      this.win();
      return;
    }
    this.hud.setMeter(this.meter, alarmed);
    this.hud.setTime(this.time, this.best());
  }

  private animateProps(dt: number, t: number) {
    const sc = this.sc;
    if (sc.book.visible) sc.book.position.y = 1.1 + Math.sin(t * 2) * 0.025;
    sc.bookLight.intensity = (this.carrying ? 4 : 14) + Math.sin(t * 3.1) * 1.2;
    (sc.beam.material as THREE.MeshBasicMaterial).opacity = this.carrying ? 0.03 : 0.09 + Math.sin(t * 1.7) * 0.02;
    sc.exitGlow.opacity = this.carrying ? 0.5 + Math.sin(t * 5) * 0.2 : 0.22;
    (sc.pools.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 7.3) * 0.01 + Math.sin(t * 2.1) * 0.015;
    if (this.carried.visible) {
      const p = this.game.player.pos;
      this.carried.position.set(p.x, p.y + 2.0 + Math.sin(t * 4) * 0.06, p.z);
      this.carried.rotation.y += dt * 1.6;
    }
    const hear = LEVELS[this.diff].hear;
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life = Math.max(0, r.life - dt / 0.75);
      const k = 1 - r.life;
      r.mesh.scale.setScalar(0.6 + k * (hear - 0.6));
      r.mat.opacity = r.life * 0.7;
      r.mesh.visible = r.life > 0;
    }
  }
}
