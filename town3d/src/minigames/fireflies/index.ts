import * as THREE from "three";
import type { Game } from "../../core/game";
import { save } from "../../core/save";
import { el } from "../../ui/ui";
import { publicationPanel } from "../../ui/panels";
import { POI } from "../../world/layout";
import { radialTexture, type TownStage } from "../../world/town";
import { FireflySwarm, AREA, type SwarmMode } from "./swarm";
import { GAME_ID, JarChallenge, LEVELS, MODE_LABEL, PAPER, injectStyles, statKey } from "./challenge";
import { difficultyPicker, howToPlay } from "../../ui/howto";
import { boardKey, getDifficulty, topEntries } from "../../ui/leaderboard";

// Firefly Meadow — after "(Perlin) Noise as AI coordinator" (FDG 2026): agents that
// never talk, only sample one shared coherent noise field, still look coordinated.

const smooth = THREE.MathUtils.smoothstep;

class FireflyMeadow {
  readonly swarm: FireflySwarm;
  readonly challenge: JarChallenge;
  private size = new THREE.Vector2();
  private announced = false;

  constructor(private game: Game, town: TownStage) {
    const count = game.quality === "low" ? 90 : 220;
    this.swarm = new FireflySwarm(town.scene, count, radialTexture());
    this.challenge = new JarChallenge(
      game,
      town,
      this.swarm,
      () => this.startChallenge(),
      () => this.openPanel(),
    );
  }

  /** 0 by day, faint at dusk, fully out at night. */
  visibility() {
    const n = this.game.sky.night;
    return 0.25 * smooth(n, 0.05, 0.35) + 0.75 * smooth(n, 0.35, 0.8);
  }

  update(dt: number, t: number) {
    let vis = this.visibility();
    const running = this.challenge.running;
    if (running) {
      this.challenge.update(dt);
      this.swarm.catcher = this.challenge.running && !this.game.ui.modalOpen ? this.game.player.pos : null;
      vis = Math.max(vis, 0.9);
    }
    if (vis <= 0.001 && !running) {
      this.swarm.setVisible(false);
      this.announced = false;
      return;
    }
    this.swarm.setVisible(true);
    const cam = this.game.rig.camera;
    this.game.renderer.getDrawingBufferSize(this.size);
    const uScale = this.size.y / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    this.swarm.update(dt, t, vis, uScale);

    if (!this.announced && vis > 0.95) {
      const p = this.game.player.pos;
      if (Math.hypot(p.x - AREA.x, p.z - AREA.z) < 30) {
        this.announced = true;
        this.game.ui.toast("✨ The fireflies are out in the meadow.");
      }
    }
  }

  startChallenge() {
    if (this.game.sky.night < 0.5) {
      this.game.sky.setHour(21);
      this.game.ui.toast("🌙 Night falls over the meadow…");
    }
    this.challenge.start();
  }

  // ---- Sign panel ------------------------------------------------------------------

  openPanel(replace = false) {
    injectStyles();
    const game = this.game;
    const ui = game.ui;
    const pub = game.data.publications.find((p) => PAPER.test(p.title));
    const night = game.sky.night >= 0.5;
    const body = el("div");

    body.append(
      el(
        "p",
        undefined,
        `These fireflies never talk to each other. Each one just samples the <b>same</b> slowly drifting Perlin-noise field and follows its flow — and because the field is smooth, neighbours get similar "instructions", so the swarm glides in ribbons and blinks in waves. That's the idea behind <i>(Perlin) Noise as AI coordinator</i>: shared coherent noise as a zero-communication coordinator for game agents.`,
      ),
    );

    body.append(el("h3", undefined, "Movement"));
    const modes = el("div", "ff-modes");
    for (const m of ["perlin", "random"] as SwarmMode[]) {
      const b = el("button", "btn small" + (this.swarm.mode === m ? "" : " secondary"), MODE_LABEL[m]);
      b.addEventListener("click", () => {
        game.audio.sfx("click");
        this.swarm.mode = m;
        this.openPanel(true);
      });
      modes.append(b);
    }
    body.append(
      modes,
      el(
        "p",
        "ff-note",
        this.swarm.mode === "perlin"
          ? "Coordinated: one shared noise field (the curl of a time-evolving potential) steers everyone, and the same field phases their blinking."
          : "Independent: every firefly does its own jittery random walk and blinks on its own clock. Same agents, no shared signal.",
      ),
    );

    const row = el("div", "mg-row");
    const diff = getDifficulty(GAME_ID);
    const lv = LEVELS[diff];
    body.append(
      el("h3", undefined, "Jar challenge"),
      howToPlay({
        demo: "fireflies",
        rules: [
          `Catch <b>${lv.goal} fireflies in ${lv.limit} s</b> by simply walking into them — the jar fills as you go.`,
          "They <b>shy away</b> when you get close: read the flow and let a ribbon drift into you rather than chasing.",
          "Pick the <b>movement mode</b> above: one shared Perlin field (coordinated) or independent random walkers.",
        ],
      }),
      difficultyPicker({
        gameId: GAME_ID,
        descriptions: { easy: LEVELS.easy.desc, normal: LEVELS.normal.desc, hard: LEVELS.hard.desc },
        onClick: () => game.audio.sfx("click"),
        onChange: () => this.openPanel(true),
      }),
    );
    if (night) {
      const best = topEntries(boardKey(GAME_ID, diff))[0]?.score ?? save.get().stats[statKey(diff)];
      if (best !== undefined) body.append(el("p", "ff-note", `Best on this difficulty: <b>${best.toFixed(1)} s</b>.`));
      const start = el("button", "btn small", "Start the jar challenge");
      start.addEventListener("click", () => {
        game.audio.sfx("click");
        ui.closeAllPanels();
        this.startChallenge();
      });
      row.append(start);
    } else {
      body.append(el("p", "ff-note", "🌞 The fireflies only come out at night. Come back after dark — or wait here a while."));
      const wait = el("button", "btn small", "Wait until nightfall");
      wait.addEventListener("click", () => {
        game.audio.sfx("click");
        game.sky.setHour(21);
        ui.toast("🌙 You sit by the sign until nightfall…");
        this.openPanel(true);
      });
      row.append(wait);
    }
    if (pub) {
      const paper = el("button", "btn small secondary", "📄 Read the paper");
      paper.addEventListener("click", () => {
        game.audio.sfx("click");
        publicationPanel(ui, pub, "Firefly Meadow");
      });
      row.append(paper);
    }
    body.append(row);

    const opts = {
      title: "Firefly Meadow",
      kicker: pub?.venue ? `${pub.venue} · Research mini-game` : "Research mini-game",
      body,
      wide: true,
      onClose: () => game.audio.sfx("close"),
    };
    if (replace) ui.replacePanel(opts);
    else {
      game.audio.sfx("open");
      ui.openPanel(opts);
    }
  }
}

/** Registers the fireflies mini-game. */
export function install(game: Game, town: TownStage) {
  let meadow: FireflyMeadow | null = null;
  // The town builds lazily: create scene objects on the first town frame.
  const get = () => (meadow ??= new FireflyMeadow(game, town));
  town.systems.add({ update: (dt, t) => get().update(dt, t) });
  town.addInteractable({
    id: "firefly-sign",
    pos: new THREE.Vector3(POI.fireflySign.x, 0, POI.fireflySign.z),
    radius: 2.8,
    markerHeight: 2.8,
    label: () => (game.sky.night >= 0.5 ? "Read the Firefly Meadow sign" : "Read the Firefly Meadow sign (fireflies at night)"),
    enabled: () => !meadow?.challenge.running,
    onInteract: () => get().openPanel(),
  });
}
