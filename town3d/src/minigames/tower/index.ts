import * as THREE from "three";
import type { Game } from "../../core/game";
import type { TownStage } from "../../world/town";
import { Stage } from "../../core/stage";
import type { Kit } from "../../core/assets";
import type { CameraLimits } from "../../core/camera";
import { save } from "../../core/save";
import { flatMat } from "../../actors/chibi";
import { buildSign } from "../../world/buildings";
import { el } from "../../ui/ui";
import { publicationPanel } from "../../ui/panels";
import { escapeHtml } from "../../data";
import { BEAT_INFO, CHALLENGES, JUMP_APEX, MAX_RISE, PHYS, PILLAR_R, REACH_SAFETY, START_ISLAND, generate, maxGap, type Level, type TowerParams } from "./generator";
import { BANNER_IDLE, BANNER_ON, TOWER_MODELS, buildBackdrop, buildLevelView, pillarSpan, updateCoins, type LevelView } from "./visuals";
import { TowerHud, formatTime } from "./hud";
import { TowerTelemetry, towerViz } from "./report";
import { awardBadge, paperAction, showResult, type ResultAction } from "../../ui/results";
import { difficultyPicker, howToPlay } from "../../ui/howto";
import { boardKey, DIFFICULTIES, DIFF_ICON, DIFF_LABEL, getDifficulty, type Difficulty } from "../../ui/leaderboard";

// PCG Tower: a procedurally generated parkour climb in the sky, generated from an
// experience graph and checked pair by pair against the real jump physics.

const TAG = "tower-level";
const LIMITS: CameraLimits = { minDist: 3.5, maxDist: 20, minPitch: -0.12, maxPitch: 1.42, collide: false };
const PAPER = /Experience to 3D Platformer/i;
const HDPCG = /High[- ]Dimensional Procedural/i;
const GAME_ID = "tower";

/** Easy / Normal / Hard map onto the generator's own difficulty (1..5) and length (1..5). */
const PRESETS: Record<Difficulty, { difficulty: number; length: number; desc: string }> = {
  easy: { difficulty: 1, length: 2, desc: "Generator difficulty 1, length 2: big platforms, short gaps, walking jumps and a checkpoint after every segment." },
  normal: { difficulty: 3, length: 3, desc: "Generator difficulty 3, length 3: denser challenge beats and smaller platforms; still walking jumps." },
  hard: { difficulty: 5, length: 4, desc: "Generator difficulty 5, length 4: long run-up gaps (Shift), narrow ledges, up to four challenges per segment and checkpoints only every other segment." },
};

function presetOf(p: TowerParams): Difficulty | null {
  return DIFFICULTIES.find((d) => PRESETS[d].difficulty === p.difficulty && PRESETS[d].length === p.length) ?? null;
}

const towerBoard = (difficulty: number, length: number) => boardKey(GAME_ID, `d${difficulty}l${length}`);

class TowerStage extends Stage {
  readonly id = "tower";
  readonly title = "PCG Tower";
  outdoor = true;
  cameraLimits = LIMITS;

  private params: TowerParams = (() => {
    const pr = PRESETS[getDifficulty(GAME_ID)];
    return { seed: 1 + Math.floor(Math.random() * 999), difficulty: pr.difficulty, length: pr.length };
  })();
  private tel = new TowerTelemetry();
  private level!: Level;
  private view: LevelView | null = null;
  private hud: TowerHud | null = null;
  private coinsTaken: boolean[] = [];
  private checkpoint = 0;
  private currentBeat = 0;
  private time = 0;
  private started = false;
  private finished = false;
  private falls = 0;
  private hudTimer = 0;
  private active = false;

  requiredModels(): [Kit, string][] {
    return TOWER_MODELS;
  }

  protected build() {
    const w = this.world;
    w.groundHeight = () => -1000;
    w.boundsCircle = { x: 0, z: 0, r: 34 };
    this.scene.add(buildBackdrop(this.game.quality === "low"));
    this.buildStartProps();
    this.regenerate(this.params);
  }

  // ---- Start island props (static) -------------------------------------------------

  private buildStartProps() {
    const { cx, cz, sx, sz } = START_ISLAND;
    const south = cz + sz / 2;
    // Sign with the controls.
    const sign = buildSign("PCG Tower", { width: 2.4, sub: "seeded · validated" });
    sign.position.set(cx - sx / 2 + 1.4, 0, south - 0.9);
    this.scene.add(sign);
    this.world.addCylinder(sign.position.x, sign.position.z, 0.25, 0, 2.2);
    this.addInteractable({
      id: "tower-sign",
      pos: sign.position.clone(),
      radius: 2.2,
      label: "Read the tower sign",
      markerHeight: 2.6,
      onInteract: () => this.openIntro(),
    });

    // Stone gate home, with a soft swirl in the doorway.
    const gate = new THREE.Group();
    gate.position.set(cx + 1.2, 0, south - 0.7);
    const stone = flatMat(0xc2b49c);
    for (const dx of [-0.95, 0.95]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.6, 0.45), stone);
      post.position.set(dx, 1.3, 0);
      post.castShadow = true;
      gate.add(post);
      this.world.addCylinder(gate.position.x + dx, gate.position.z, 0.3, 0, 2.6);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.4, 0.55), flatMat(0xa89478));
    lintel.position.y = 2.75;
    lintel.castShadow = true;
    const swirlMat = new THREE.MeshBasicMaterial({ color: 0x9ad8f0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const swirl = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 2.4), swirlMat);
    swirl.position.y = 1.25;
    gate.add(lintel, swirl);
    this.scene.add(gate);
    this.addInteractable({
      id: "tower-leave",
      pos: gate.position.clone(),
      radius: 2.0,
      label: "Return to town",
      markerHeight: 3.3,
      onInteract: () => this.leave(),
    });
  }

  // ---- Level lifecycle -----------------------------------------------------------------

  private regenerate(p: TowerParams) {
    this.params = { ...p };
    this.level = generate(this.params);
    const L = this.level;
    if (this.view) {
      this.scene.remove(this.view.group);
      this.view.dispose();
    }
    this.view = buildLevelView(L, this.game.quality === "low");
    this.scene.add(this.view.group);

    const w = this.world;
    w.removeTagged(TAG);
    for (const pl of L.platforms) w.addBox(pl.cx, pl.cz, pl.sx, pl.sz, pl.top - pl.thick, pl.top, { tag: TAG, noCamera: true });
    const span = pillarSpan(L);
    w.addCylinder(0, 0, PILLAR_R, span.bottom, span.top, TAG);
    w.killY = L.lowest - 12;

    const p0 = L.platforms[0];
    const p1 = L.platforms[1];
    this.spawns.default = { pos: new THREE.Vector3(p0.cx, p0.top, p0.cz + 0.6), yaw: Math.atan2(p1.cx - p0.cx, p1.cz - p0.cz) };
    this.hud?.setLevel(L);
    this.resetRun();
  }

  private runId = 0;

  private resetRun() {
    this.runId++;
    this.coinsTaken = this.level.coins.map(() => false);
    this.checkpoint = 0;
    this.currentBeat = 0;
    this.time = 0;
    this.started = false;
    this.finished = false;
    this.falls = 0;
    this.tel.reset(this.level);
    if (this.view) for (const b of this.view.banners) b.cloth.material = BANNER_IDLE;
    if (this.active) this.respawnAt(0);
  }

  /** Put the player on a platform, facing the next one. */
  private respawnAt(idx: number) {
    const P = this.level.platforms;
    const p = P[idx];
    const next = P[Math.min(idx + 1, P.length - 1)];
    const pl = this.game.player;
    const pos = idx === 0 ? this.spawns.default.pos : new THREE.Vector3(p.cx, p.top, p.cz);
    pl.pos.copy(pos);
    pl.vel.set(0, 0, 0);
    pl.onGround = true;
    const yaw = Math.atan2(next.cx - p.cx, next.cz - p.cz);
    this.game.setFacing(yaw);
    this.game.rig.snap(pl.pos, yaw + Math.PI);
  }

  private leave() {
    this.game.ui.closeAllPanels();
    void this.game.goTo("town", "from-tower");
  }

  // ---- Stage hooks ---------------------------------------------------------------------

  onEnter() {
    this.active = true;
    const g = this.game;
    this.hud = new TowerHud(
      {
        regenerate: (p) => {
          this.regenerate(p);
          g.ui.toast(`New tower · seed ${p.seed} · ${this.level.platforms.length} platforms`);
        },
        restart: () => {
          this.resetRun();
          g.ui.toast("Back to the start island.");
        },
        leave: () => this.leave(),
        info: () => this.openIntro(),
        click: () => g.audio.sfx("click"),
      },
      this.params,
      g.input.isTouch,
    );
    this.hud.setLevel(this.level);
    g.ui.mgLayer.append(this.hud.root);
    this.resetRun();
    this.refreshHud();
    this.openIntro();
  }

  onExit() {
    this.active = false;
    this.hud?.root.remove();
    this.hud = null;
  }

  onFall() {
    if (this.finished) {
      this.respawnAt(this.level.summit);
      return;
    }
    this.falls++;
    this.tel.fell();
    this.game.audio.sfx("fail");
    this.respawnAt(this.checkpoint);
    this.game.ui.toast(this.checkpoint === 0 ? "Whoops! Back to the start island." : "Whoops! Back to the last checkpoint.", 2000);
  }

  update(dt: number, t: number) {
    if (!this.view) return;
    const g = this.game;
    const pl = g.player;
    const L = this.level;

    // Timer: starts when you leave the start island, pauses behind menus.
    if (!this.started && !this.finished) {
      const s = L.platforms[0];
      const off = Math.abs(pl.pos.x - s.cx) > s.sx / 2 + 0.3 || Math.abs(pl.pos.z - s.cz) > s.sz / 2 + 0.3;
      if (off) this.started = true;
    }
    if (this.started && !this.finished && !g.ui.modalOpen) this.time += dt;

    // Coins.
    updateCoins(this.view, L, this.coinsTaken, t);
    L.coins.forEach((c, i) => {
      if (this.coinsTaken[i]) return;
      const dx = c.x - pl.pos.x;
      const dy = c.y - (pl.pos.y + 0.8);
      const dz = c.z - pl.pos.z;
      if (dx * dx + dy * dy + dz * dz < 0.95 * 0.95) {
        this.coinsTaken[i] = true;
        g.audio.sfx("coin");
        const got = this.coinsTaken.filter(Boolean).length;
        g.ui.toast(`🪙 Coin ${got}/${L.coins.length}`, 1400);
      }
    });

    // What are we standing on?
    const idx = pl.onGround ? this.platformUnder(pl.pos) : -1;
    if (idx >= 0) {
      const p = L.platforms[idx];
      if (!this.finished) this.tel.stand(idx, this.time);
      if (p.beat > this.currentBeat || idx === 0) this.currentBeat = p.beat;
      const order = L.checkpoints.indexOf(idx);
      if (order > 0 && order > L.checkpoints.indexOf(this.checkpoint)) {
        this.checkpoint = idx;
        g.audio.sfx("interact");
        g.ui.toast(`⚑ Checkpoint ${order}/${L.checkpoints.length - 1}`, 1800);
        const banner = this.view.banners.find((b) => b.platform === idx);
        if (banner) banner.cloth.material = BANNER_ON;
      }
      if (idx === L.summit && !this.finished) this.finish();
    }

    // Flags.
    this.view.flag.rotation.y = Math.sin(t * 1.7) * 0.3;
    for (const b of this.view.banners) b.cloth.rotation.y = Math.sin(t * 2 + b.platform) * 0.25;

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.refreshHud();
    }
  }

  private platformUnder(pos: THREE.Vector3) {
    const P = this.level.platforms;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (Math.abs(pos.y - p.top) > 0.05) continue;
      if (Math.abs(pos.x - p.cx) <= p.sx / 2 + 0.3 && Math.abs(pos.z - p.cz) <= p.sz / 2 + 0.3) return i;
    }
    return -1;
  }

  private bestKey() {
    const p = this.params;
    return `tower_${p.seed}_${p.difficulty}_${p.length}`;
  }

  private refreshHud() {
    this.hud?.update({
      coins: this.coinsTaken.filter(Boolean).length,
      coinTotal: this.level.coins.length,
      time: this.time,
      best: save.get().stats[this.bestKey()],
      falls: this.falls,
      currentBeat: this.currentBeat,
      started: this.started,
    });
  }

  // ---- Summit ----------------------------------------------------------------------------

  private difficulty(): Difficulty | null {
    return presetOf(this.params);
  }

  private finish() {
    this.finished = true;
    const g = this.game;
    const L = this.level;
    const time = Math.round(this.time * 10) / 10;
    const coins = this.coinsTaken.filter(Boolean).length;
    save.bestStat(this.bestKey(), time, true);
    save.bestStat("tower_best", time, true);
    g.audio.sfx("success");
    const earnedNow = awardBadge(g, "tower");
    this.refreshHud();
    const falls = this.falls;
    const tel = this.tel;
    const taken = [...this.coinsTaken];
    const run = this.runId;
    setTimeout(() => {
      if (!this.active || this.level !== L || this.runId !== run) return;
      const p = L.params;
      const diff = this.difficulty();
      const lists = DIFFICULTIES.map((d) => ({ key: towerBoard(PRESETS[d].difficulty, PRESETS[d].length), label: `${DIFF_ICON[d]} ${DIFF_LABEL[d]}` }));
      if (!diff) lists.push({ key: towerBoard(p.difficulty, p.length), label: `Custom D${p.difficulty}·L${p.length}` });
      const acts: (ResultAction | null)[] = [
        {
          id: "new",
          label: "🎲 New tower",
          onClick: () => {
            const np = { ...this.params, seed: 1 + Math.floor(Math.random() * 999) };
            this.hud?.setParams(np);
            this.regenerate(np);
            g.ui.toast(`New tower · seed ${np.seed}`);
          },
        },
        { id: "again", label: "Climb again", kind: "secondary", onClick: () => this.resetRun() },
        { id: "difficulty", label: "Change difficulty", kind: "secondary", onClick: () => this.openIntro() },
        { id: "town", label: "Back to town", kind: "secondary", onClick: () => this.leave() },
        paperAction(g, PAPER, "PCG Tower"),
      ];
      showResult({
        game: g,
        name: "PCG Tower",
        icon: "🚩",
        kicker: "Procedural parkour · result",
        title: "Summit reached!",
        win: true,
        difficulty: diff ?? undefined,
        subtitle: `Tower <b>#${p.seed}</b> · generator difficulty ${p.difficulty}, length ${p.length}${diff ? "" : " (custom)"}. Every tower is a fresh walk through the same experience grammar.`,
        stats: [
          { icon: "⏱", label: "Time", value: formatTime(time) },
          { icon: "🪙", label: "Coins", value: `${coins}/${L.coins.length}` },
          { icon: "💫", label: "Falls", value: String(falls), hint: falls ? "marked ✕ below" : "flawless climb" },
          { icon: "🧱", label: "Tower", value: `${L.height.toFixed(0)} m`, hint: `${L.platforms.length} platforms · ${L.beats.length} beats` },
        ],
        boards: { list: lists, active: towerBoard(p.difficulty, p.length), heading: "Fastest climbs · local top 5" },
        score: { value: time, text: formatTime(time), note: `seed #${p.seed}${coins === L.coins.length ? " · all coins" : ""}` },
        badge: { id: "tower", earnedNow },
        viz: towerViz(L, tel, taken),
        actions: acts.filter((a): a is ResultAction => !!a),
      });
    }, 700);
  }

  // ---- Intro -----------------------------------------------------------------------------

  private openIntro(replace = false) {
    const g = this.game;
    const L = this.level;
    const pubs = g.data.publications;
    const paper = pubs.find((p) => PAPER.test(p.title));
    const hd = pubs.find((p) => HDPCG.test(p.title));
    const walk = maxGap(0, PHYS.walk).toFixed(1);
    const run = maxGap(0, PHYS.run).toFixed(1);
    const chips = CHALLENGES.map((k) => `<span class="tag" style="background:#${BEAT_INFO[k].color.toString(16).padStart(6, "0")};color:#3a2a1a">${BEAT_INFO[k].label}</span>`).join(" ");
    const body = el("div");
    body.append(
      el(
        "p",
        undefined,
        "<b>Procedural content generation (PCG)</b> means an algorithm builds the content (levels, maps, quests) from rules and a random seed instead of a designer placing every piece. The hard part is not randomness: generated content must stay <i>playable</i> and still feel <i>designed</i>.",
      ),
      howToPlay({
        demo: "tower",
        rules: [
          "Climb the spiral of platforms to the <b>summit flag</b>. <b>Space</b> / Jump to jump, <b>Shift</b> to run.",
          "Fall off and you respawn at the last <b>checkpoint</b> banner. Grab the <b>coins</b> on reward platforms.",
          "Every hop was checked by the <b>validator</b> against the real jump physics, so every tower is beatable.",
        ],
      }),
      difficultyPicker({
        gameId: GAME_ID,
        descriptions: { easy: PRESETS.easy.desc, normal: PRESETS.normal.desc, hard: PRESETS.hard.desc },
        onClick: () => g.audio.sfx("click"),
        onChange: (d) => {
          const np = { ...this.params, difficulty: PRESETS[d].difficulty, length: PRESETS[d].length };
          this.hud?.setParams(np);
          this.regenerate(np);
          this.openIntro(true);
        },
      }),
    );
    const cur = this.difficulty();
    if (!cur) body.append(el("p", undefined, `<span style="font-size:0.85rem;color:var(--ink-soft)">Custom settings from the HUD sliders: difficulty ${L.params.difficulty}, length ${L.params.length}. Pick a preset above to reset them.</span>`));
    const more = el("details");
    more.innerHTML = `<summary style="cursor:pointer;font-weight:800">How this tower is made</summary>
      <p><b>Experience graph.</b> First a chain of beats is sampled: Rest → Challenge ×k → Reward → Checkpoint … → Summit, with challenges drawn from ${chips}. Difficulty sets gap and platform sizes, challenge density and how often you get a checkpoint; Length sets the number of segments.</p>
      <p><b>Realisation + validation.</b> Each beat is realised platform by platform, spiralling round the pillar. A <b>local validator</b> checks every consecutive pair against the real jump physics (gravity ${PHYS.gravity} m/s², jump ${PHYS.jumpSpeed} m/s → apex ${JUMP_APEX.toFixed(2)} m): rises stay ≤ ${MAX_RISE} m, and gaps stay within ${Math.round(REACH_SAFETY * 100)}% of the ballistic reach (≈${walk} m walking, ≈${run} m running on the level). A clearance check makes sure no platform blocks another jump's arc. Invalid candidates are re-sampled: this tower needed <b>${L.rejected}</b> re-samples for ${L.platforms.length} platforms. Platform colours match the beat chips in the HUD.</p>
      <p>${L.runRequired ? "This difficulty expects run-up jumps (hold Shift)." : "Walking jumps are enough at this difficulty."} Use the HUD sliders for a custom seed / difficulty / length.</p>`;
    body.append(more);
    const row = el("div", "mg-row");
    row.style.marginTop = "12px";
    const btn = (label: string, cls: string, fn: () => void) => {
      const b = el("button", "btn small " + cls, label);
      b.addEventListener("click", () => {
        g.audio.sfx("click");
        fn();
      });
      row.append(b);
    };
    btn("Start climbing", "", () => g.ui.closePanel());
    if (paper) btn(`Read the paper (${escapeHtml(paper.venue || "AIIDE 2026")})`, "secondary", () => publicationPanel(g.ui, paper, "PCG Tower"));
    if (hd) btn(`High-Dimensional PCG (${escapeHtml(hd.venue || "FDG 2026")})`, "secondary", () => publicationPanel(g.ui, hd, "PCG Tower"));
    btn("Back to town", "secondary", () => this.leave());
    body.append(row);
    const opts = { title: "PCG Tower", kicker: "Mini-game · procedural parkour", body, wide: true, onClose: () => g.audio.sfx("close") };
    if (replace) g.ui.replacePanel(opts);
    else g.ui.openPanel(opts);
  }
}

/** Registers the tower mini-game. */
export function install(game: Game, _town: TownStage) {
  game.register(new TowerStage());
}

