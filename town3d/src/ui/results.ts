import "./minigame-ui.css";
import type { Game } from "../core/game";
import { BADGES } from "../core/game";
import { save } from "../core/save";
import type { Publication } from "../data";
import { escapeHtml } from "../data";
import { el } from "./ui";
import { publicationPanel } from "./panels";
import { fitCanvas } from "./howto";
import { DIFF_ICON, DIFF_LABEL, submitScore, topEntries, type Difficulty, type LbEntry } from "./leaderboard";

// One result screen for every research mini-game: win/lose hero, key stats, a
// "New best!" ribbon, a local top-5 leaderboard, the badge, a research
// visualisation of what the algorithm did this round, and action buttons.

export interface ResultStat {
  icon: string;
  label: string;
  value: string;
  hint?: string;
}

export interface ResultAction {
  /** Passed to onClose so the game knows why the panel closed. */
  id: string;
  label: string;
  kind?: "primary" | "secondary" | "warm";
  onClick: () => void;
  /** Open on top of the result (e.g. a paper) instead of closing it first. */
  keepOpen?: boolean;
}

export interface VizPane {
  /** Draw in CSS pixels; called again whenever the pane is resized. */
  draw(g: CanvasRenderingContext2D, w: number, h: number): void;
  /** Width / height. Ignored when `height` is set. */
  aspect?: number;
  height?: number;
  label?: string;
}

export interface ResultViz {
  title: string;
  panes: VizPane[];
  /** Legend HTML under the panes. */
  legend?: string;
  /** One sentence tying the picture to the paper. */
  caption: string;
}

export interface BoardSpec {
  key: string;
  label: string;
}

export interface ResultOptions {
  game: Game;
  /** Game name for the panel header (the hero shows the win / lose title). */
  name: string;
  icon: string;
  kicker: string;
  title: string;
  win: boolean;
  subtitle?: string;
  difficulty?: Difficulty;
  stats: ResultStat[];
  /** Leaderboards to show (tabs when more than one); `active` gets the new score. */
  boards?: { list: BoardSpec[]; active: string; heading?: string };
  /** Submitted to the active board (only pass for wins). */
  score?: { value: number; text: string; note?: string; lowerIsBetter?: boolean };
  /** Show the ribbon even if the board didn't (e.g. a save-level best). */
  forceBest?: boolean;
  badge?: { id: string; earnedNow: boolean; lockedHint?: string };
  viz?: ResultViz;
  /** Extra content below the visualisation (e.g. the deduction chain). */
  extra?: HTMLElement;
  actions: ResultAction[];
  /** Called when the panel closes: with the action id, or null for ✕ / Esc / backdrop. */
  onClose?: (via: string | null) => void;
}

/** Award a badge and report whether it is new this time. */
export function awardBadge(game: Game, id: string): boolean {
  const had = save.hasBadge(id);
  game.award(id);
  return !had;
}

export function findPaper(game: Game, re: RegExp): Publication | undefined {
  return game.data.publications.find((p) => re.test(p.title));
}

/** "Read the paper" action that opens over the result screen. */
export function paperAction(game: Game, re: RegExp, kicker: string, label = "📄 Read the paper"): ResultAction | null {
  const pub = findPaper(game, re);
  if (!pub) return null;
  return {
    id: "paper",
    label: pub.venue ? `${label} · ${escapeHtml(pub.venue)}` : label,
    kind: "secondary",
    keepOpen: true,
    onClick: () => {
      game.audio.sfx("click");
      publicationPanel(game.ui, pub, kicker);
    },
  };
}

const MEDAL = ["🥇", "🥈", "🥉", "4", "5"];

function dateText(ms: number) {
  try {
    return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function boardList(entries: LbEntry[], me: number | null): HTMLElement {
  const ol = el("ol", "mgx-lb");
  if (!entries.length) {
    ol.append(el("span", "empty", "No entries yet — win a round to set the first record."));
    return ol;
  }
  entries.forEach((e, i) => {
    const li = el("li", e.at === me ? "me" : "");
    li.append(
      el("span", "r", MEDAL[i] ?? String(i + 1)),
      el("span", undefined, `<span class="t">${escapeHtml(e.text)}</span>${e.note ? `<span class="n">${escapeHtml(e.note)}</span>` : ""}`),
      el("span", "d", e.at === me ? "you, now" : dateText(e.at)),
    );
    ol.append(li);
  });
  return ol;
}

/** Canvas pane that redraws to its container width (and the device pixel ratio). */
export function vizCanvas(pane: VizPane): HTMLElement {
  const wrap = el("div", "mgx-pane");
  if (pane.label) wrap.append(el("div", "pl", pane.label));
  const c = el("canvas");
  c.setAttribute("role", "img");
  if (pane.label) c.setAttribute("aria-label", pane.label);
  wrap.append(c);
  let lastW = -1;
  let lastDpr = -1;
  const redraw = () => {
    const w = Math.floor(c.clientWidth || wrap.clientWidth);
    const dpr = window.devicePixelRatio || 1;
    if (w <= 0 || (w === lastW && dpr === lastDpr)) return;
    lastW = w;
    lastDpr = dpr;
    const h = pane.height ?? Math.round(w / (pane.aspect ?? 2));
    const g = fitCanvas(c, w, h);
    if (!g) return;
    g.clearRect(0, 0, w, h);
    try {
      pane.draw(g, w, h);
    } catch (err) {
      console.warn("result visualisation failed", err);
    }
  };
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      if (!c.isConnected) {
        ro.disconnect();
        return;
      }
      redraw();
    });
    ro.observe(wrap);
  }
  requestAnimationFrame(() => requestAnimationFrame(redraw));
  return wrap;
}

/** Open the unified result panel. Returns whether this round set a new best. */
export function showResult(o: ResultOptions): { best: boolean; rank: number } {
  const { game } = o;
  const ui = game.ui;
  let best = !!o.forceBest;
  let rank = -1;
  let mine: number | null = null;
  if (o.score && o.boards) {
    const r = submitScore(o.boards.active, { score: o.score.value, text: o.score.text, note: o.score.note }, o.score.lowerIsBetter ?? true);
    best = best || r.best;
    rank = r.rank;
    mine = r.rank >= 0 ? r.entry.at : null;
  }

  const body = el("div", "mgx-result");

  // Hero.
  const hero = el("div", "mgx-hero" + (o.win ? "" : " lose"));
  hero.append(el("div", "ico", o.icon));
  const ht = el("div");
  ht.append(el("h3", undefined, escapeHtml(o.title)));
  if (o.subtitle) ht.append(el("div", "sub", o.subtitle));
  if (o.difficulty) ht.append(el("span", "tag diff", `${DIFF_ICON[o.difficulty]} ${DIFF_LABEL[o.difficulty]}`));
  hero.append(ht);
  if (best && o.win) hero.append(el("div", "mgx-ribbon", "New best!"));
  body.append(hero);

  // Stats.
  if (o.stats.length) {
    const stats = el("div", "mgx-stats");
    for (const s of o.stats) {
      const tile = el("div", "mgx-stat");
      tile.append(el("div", "k", `${s.icon} ${escapeHtml(s.label)}`), el("div", "v", s.value));
      if (s.hint) tile.append(el("div", "h", s.hint));
      stats.append(tile);
    }
    body.append(stats);
  }

  // Leaderboard + badge.
  const cols = el("div", "mgx-cols");
  if (o.boards) {
    const box = el("div", "mgx-box");
    const title = el("h4", undefined, o.boards.heading ?? "Local top 5");
    box.append(title);
    const listHolder = el("div");
    const show = (key: string) => {
      listHolder.innerHTML = "";
      listHolder.append(boardList(topEntries(key), key === o.boards!.active ? mine : null));
      tabs?.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", (t as HTMLElement).dataset.k === key));
    };
    let tabs: HTMLElement | null = null;
    if (o.boards.list.length > 1) {
      tabs = el("div", "mgx-lb-tabs");
      for (const b of o.boards.list) {
        const t = el("button", "tab", escapeHtml(b.label));
        t.type = "button";
        t.dataset.k = b.key;
        t.addEventListener("click", () => {
          show(b.key);
          t.blur();
        });
        tabs.append(t);
      }
      box.append(tabs);
    }
    box.append(listHolder);
    show(o.boards.active);
    cols.append(box);
  }
  if (o.badge) {
    const def = BADGES.find((b) => b.id === o.badge!.id);
    if (def) {
      const owned = save.hasBadge(def.id);
      const box = el("div", "mgx-box");
      box.append(el("h4", undefined, o.badge.earnedNow ? "Badge earned!" : owned ? "Badge" : "Badge to earn"));
      const b = el("div", "mgx-badge" + (owned ? " got" : "") + (o.badge.earnedNow ? " new" : ""));
      b.append(
        el("div", "bi", owned ? def.icon : "🔒"),
        el("div", undefined, `<b>${escapeHtml(def.label)}</b><span>${owned ? escapeHtml(def.desc) : escapeHtml(o.badge.lockedHint ?? def.desc)}</span>`),
      );
      box.append(b);
      if (owned && !o.badge.earnedNow) box.append(el("div", undefined, `<span style="font-size:0.76rem;color:var(--ink-soft)">Already in your collection (Town Menu → Badges).</span>`));
      cols.append(box);
    }
  }
  if (cols.childElementCount) {
    if (cols.childElementCount === 1) cols.style.gridTemplateColumns = "1fr";
    body.append(cols);
  }

  // Research visualisation.
  if (o.viz) {
    const v = el("div", "mgx-viz");
    v.append(el("h4", undefined, `🔬 ${escapeHtml(o.viz.title)}`));
    const panes = el("div", "mgx-viz-panes");
    for (const p of o.viz.panes) panes.append(vizCanvas(p));
    v.append(panes);
    if (o.viz.legend) v.append(el("div", "mgx-legend", o.viz.legend));
    v.append(el("p", "mgx-caption", `📄 ${o.viz.caption}`));
    body.append(v);
  }
  if (o.extra) body.append(o.extra);

  // Actions.
  let via: string | null = null;
  const row = el("div", "mgx-actions");
  o.actions.forEach((a, i) => {
    const kind = a.kind ?? (i === 0 ? "primary" : "secondary");
    const b = el("button", "btn small" + (kind === "secondary" ? " secondary" : kind === "warm" ? " warm" : ""), a.label);
    b.type = "button";
    b.addEventListener("click", () => {
      if (a.keepOpen) {
        a.onClick();
        return;
      }
      game.audio.sfx("click");
      via = a.id;
      ui.closeAllPanels();
      a.onClick();
    });
    row.append(b);
  });
  body.append(row);

  ui.openPanel({
    title: o.name,
    kicker: o.kicker,
    body,
    wide: true,
    onClose: () => o.onClose?.(via),
  });
  return { best, rank };
}

// ---- Small drawing helpers for the visualisations ----------------------------------------

export const VIZ_FONT = "Nunito, system-ui, sans-serif";

export function vizText(g: CanvasRenderingContext2D, text: string, x: number, y: number, opts: { size?: number; weight?: number; color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline } = {}) {
  g.font = `${opts.weight ?? 700} ${opts.size ?? 10}px ${VIZ_FONT}`;
  g.fillStyle = opts.color ?? "#6e5a48";
  g.textAlign = opts.align ?? "left";
  g.textBaseline = opts.base ?? "middle";
  g.fillText(text, x, y);
}

export function vizRoundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
