import type { Game } from "../../core/game";
import { save } from "../../core/save";
import { el } from "../../ui/ui";
import type { TownStage } from "../../world/town";
import { POI } from "../../world/layout";
import { awardBadge, paperAction, showResult, type ResultAction } from "../../ui/results";
import { boardKey, DIFFICULTIES, DIFF_ICON, DIFF_LABEL, getDifficulty, type Difficulty } from "../../ui/leaderboard";
import type { FireflySwarm } from "./swarm";
import { SwarmTelemetry, swarmViz } from "./report";

// The jar challenge: catch `goal` fireflies in `limit` seconds by walking into them.

export const GAME_ID = "fireflies";
export const MODE_LABEL = { perlin: "Perlin-coordinated", random: "Independent random" } as const;
export const PAPER = /noise as ai coordinator/i;

/** Difficulty: target count, time limit and how hard the fireflies shy away. */
export const LEVELS: Record<Difficulty, { goal: number; limit: number; fleeR: number; fleeK: number; desc: string }> = {
  easy: { goal: 10, limit: 75, fleeR: 1.8, fleeK: 1.6, desc: "Catch 10 in 75 s. Fireflies barely notice you (1.8 m shyness, weak push)." },
  normal: { goal: 15, limit: 60, fleeR: 2.3, fleeK: 2.8, desc: "Catch 15 in 60 s. They shy away within 2.3 m." },
  hard: { goal: 20, limit: 50, fleeR: 3.0, fleeK: 4.2, desc: "Catch 20 in 50 s. Skittish: they flee from 3 m and scatter 50% harder." },
};

const CSS = `
.ff-card { min-width: 210px; }
.ff-head { display: flex; gap: 12px; align-items: center; }
.ff-jar { position: relative; width: 42px; height: 54px; flex: none; border-radius: 10px 10px 14px 14px;
  border: 2px solid rgba(120, 150, 160, 0.75); background: linear-gradient(160deg, rgba(220,245,255,0.55), rgba(40,60,90,0.55));
  box-shadow: inset 0 0 8px rgba(255,255,255,0.35), 0 0 calc(var(--ff, 0) * 22px) rgba(214, 255, 110, calc(var(--ff, 0) * 0.85));
  overflow: hidden; transition: box-shadow 0.3s; }
.ff-jar::before { content: ""; position: absolute; left: 5px; top: 6px; width: 4px; height: 32px; border-radius: 3px; background: rgba(255,255,255,0.45); }
.ff-lid { position: absolute; left: 6px; right: 6px; top: -1px; height: 7px; border-radius: 3px; background: #8a5a34; }
.ff-dot { position: absolute; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: #f6ffbe;
  box-shadow: 0 0 6px 2px rgba(198, 255, 92, 0.9); animation: ff-pop 0.45s ease-out, ff-twinkle 1.6s ease-in-out infinite; }
@keyframes ff-pop { from { transform: scale(3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes ff-twinkle { 50% { opacity: 0.45; } }
.ff-stats { font-weight: 800; margin: 2px 0 4px; font-variant-numeric: tabular-nums; }
.ff-stats.urgent .ff-time { color: #c0503a; }
.ff-modes { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0 4px; }
.ff-note { color: var(--ink-soft); font-size: 0.88rem; margin: 4px 0 10px; }
`;

let styled = false;
export function injectStyles() {
  if (styled) return;
  styled = true;
  const s = document.createElement("style");
  s.id = "ff-style";
  s.textContent = CSS;
  document.head.append(s);
}

/** Legacy best-time stat on Normal; separate keys for the other difficulties. */
export function statKey(d: Difficulty) {
  return d === "normal" ? "fireflies_time" : `fireflies_time_${d}`;
}

export class JarChallenge {
  running = false;
  private caught = 0;
  private goal = LEVELS.normal.goal;
  private limit = LEVELS.normal.limit;
  private diff: Difficulty = "normal";
  private timeLeft = 0;
  private elapsed = 0;
  private shownSec = -1;
  private tel = new SwarmTelemetry();
  private card: HTMLElement | null = null;
  private countEl: HTMLElement | null = null;
  private timeEl: HTMLElement | null = null;
  private statsEl: HTMLElement | null = null;
  private jarEl: HTMLElement | null = null;
  private readonly tick = () => {
    if (this.running && this.game.stage !== this.town) this.stop("stage");
  };

  constructor(
    private game: Game,
    private town: TownStage,
    private swarm: FireflySwarm,
    private again: () => void,
    private openSign: () => void,
  ) {
    swarm.onCatch = () => this.onCatch();
  }

  start() {
    if (this.running) return;
    injectStyles();
    this.diff = getDifficulty(GAME_ID);
    const lv = LEVELS[this.diff];
    this.goal = lv.goal;
    this.limit = lv.limit;
    this.swarm.fleeR = lv.fleeR;
    this.swarm.fleeK = lv.fleeK;
    this.running = true;
    this.caught = 0;
    this.timeLeft = this.limit;
    this.elapsed = 0;
    this.shownSec = -1;
    this.tel.reset(this.swarm.mode);
    this.swarm.releaseAll();
    this.swarm.catcher = this.game.player.pos;
    this.buildHud();
    this.game.tickers.add(this.tick);
    this.game.audio.sfx("open");
    this.game.ui.toast(`✨ Catch ${this.goal} fireflies in ${this.limit} s — just walk into them!`);
  }

  private buildHud() {
    const card = el("div", "mg-card ff-card");
    const head = el("div", "ff-head");
    const jar = el("div", "ff-jar", `<div class="ff-lid"></div>`);
    const info = el("div");
    info.append(el("b", undefined, "Firefly Jar"));
    const stats = el("div", "ff-stats", `<span class="ff-count">0 / ${this.goal}</span> · <span class="ff-time">${this.limit} s</span>`);
    info.append(stats, el("span", "tag", MODE_LABEL[this.swarm.mode]), el("span", "tag", `${DIFF_ICON[this.diff]} ${DIFF_LABEL[this.diff]}`));
    head.append(jar, info);
    const row = el("div", "mg-row");
    const stop = el("button", "btn small secondary", "Stop");
    stop.addEventListener("click", () => {
      this.game.audio.sfx("click");
      this.stop("cancel");
      stop.blur();
    });
    row.append(stop);
    card.append(head, row);
    this.game.ui.mgLayer.append(card);
    this.card = card;
    this.jarEl = jar;
    this.statsEl = stats;
    this.countEl = stats.querySelector(".ff-count");
    this.timeEl = stats.querySelector(".ff-time");
  }

  private removeHud() {
    this.card?.remove();
    this.card = this.countEl = this.timeEl = this.statsEl = this.jarEl = null;
  }

  /** Called from the town system each frame while the town is the active stage. */
  update(dt: number) {
    if (!this.running) return;
    const p = this.game.player.pos;
    const m = POI.meadow;
    if (Math.hypot(p.x - m.x, p.z - m.z) > m.r + 10) {
      this.stop("left");
      return;
    }
    if (this.game.ui.modalOpen) return; // menus pause the clock
    this.timeLeft -= dt;
    this.elapsed += dt;
    this.tel.tick(dt, this.elapsed, this.swarm);
    const sec = Math.max(0, Math.ceil(this.timeLeft));
    if (sec !== this.shownSec) {
      this.shownSec = sec;
      if (this.timeEl) this.timeEl.textContent = `${sec} s`;
      this.statsEl?.classList.toggle("urgent", sec <= 10);
    }
    if (this.timeLeft <= 0) this.stop("timeout");
  }

  private onCatch() {
    if (!this.running) return;
    this.caught++;
    this.tel.caught(this.elapsed);
    this.game.audio.sfx("coin", 0.8);
    if (this.countEl) this.countEl.textContent = `${this.caught} / ${this.goal}`;
    if (this.jarEl) {
      // Fill the jar from the bottom with a little jitter (5 per row for big jars).
      const i = this.caught - 1;
      const per = this.goal > 16 ? 5 : 4;
      const row = Math.floor(i / per);
      const col = i % per;
      const dot = el("span", "ff-dot");
      dot.style.left = `${7 + col * (per === 5 ? 6.8 : 8.5) + ((i * 37) % 5) - 2}px`;
      dot.style.top = `${46 - row * (per === 5 ? 9.5 : 9) - ((i * 53) % 4)}px`;
      dot.style.animationDelay = `0s, ${((i * 0.37) % 1.6).toFixed(2)}s`;
      this.jarEl.append(dot);
      this.jarEl.style.setProperty("--ff", String(this.caught / this.goal));
    }
    if (this.caught >= this.goal) this.stop("win");
  }

  stop(reason: "cancel" | "left" | "stage" | "win" | "timeout") {
    if (!this.running) return;
    this.running = false;
    this.swarm.catcher = null;
    this.game.tickers.delete(this.tick);
    this.removeHud();
    const ui = this.game.ui;
    if (reason === "cancel") ui.toast("Jar challenge stopped. The fireflies drift on.");
    else if (reason === "left") ui.toast("You wandered off — the jar challenge is cancelled.");
    else if (reason === "stage") ui.toast("The jar challenge was cancelled.");
    else this.result(reason === "win");
  }

  private result(win: boolean) {
    const game = this.game;
    const secs = Math.round(this.elapsed * 10) / 10;
    const mode = this.swarm.mode;
    let earnedNow = false;
    if (win) {
      save.bestStat(statKey(this.diff), secs, true);
      earnedNow = awardBadge(game, "fireflies"); // plays its own fanfare the first time
      if (!earnedNow) game.audio.sfx("success");
    } else game.audio.sfx("fail");
    const hint =
      mode === "perlin"
        ? "Tip: the swarm flows in ribbons — get ahead of one and let it drift into you."
        : "Tip: random walkers scatter everywhere — sweep through the densest patch.";
    const rate = this.elapsed > 0 ? (this.caught / this.elapsed) * 10 : 0;
    const acts: (ResultAction | null)[] = [
      { id: "again", label: win ? "Play again" : "Try again", onClick: () => this.again() },
      { id: "difficulty", label: "Change difficulty / mode", kind: "secondary", onClick: () => this.openSign() },
      { id: "close", label: "Close", kind: "secondary", onClick: () => {} },
      paperAction(game, PAPER, "Firefly Meadow"),
    ];
    showResult({
      game,
      name: "Firefly Meadow",
      icon: win ? "✨" : "🫙",
      kicker: "Jar challenge · result",
      title: win ? "Jar filled!" : "Out of time",
      win,
      difficulty: this.diff,
      subtitle: win ? `Your jar glows with ${this.goal} fireflies. You let them go back to the meadow.` : `You caught ${this.caught} of ${this.goal}. ${hint}`,
      stats: [
        { icon: "⏱", label: win ? "Time" : "Time limit", value: `${(win ? secs : this.limit).toFixed(1)} s` },
        { icon: "✨", label: "Caught", value: `${this.caught}/${this.goal}` },
        { icon: "📈", label: "Catch rate", value: `${rate.toFixed(1)}`, hint: "per 10 s" },
        { icon: "🌀", label: "Mode", value: mode === "perlin" ? "Perlin" : "Random", hint: MODE_LABEL[mode] },
      ],
      boards: {
        list: DIFFICULTIES.map((d) => ({ key: boardKey(GAME_ID, d), label: `${DIFF_ICON[d]} ${DIFF_LABEL[d]}` })),
        active: boardKey(GAME_ID, this.diff),
        heading: "Fastest jars · local top 5",
      },
      score: win ? { value: secs, text: `${secs.toFixed(1)} s`, note: mode === "perlin" ? "Perlin" : "random" } : undefined,
      badge: { id: "fireflies", earnedNow, lockedHint: "Fill a jar to earn it." },
      viz: swarmViz(this.tel, this.elapsed, this.goal),
      actions: acts.filter((a): a is ResultAction => !!a),
    });
  }
}
