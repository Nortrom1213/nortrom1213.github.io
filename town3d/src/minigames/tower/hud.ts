import { el } from "../../ui/ui";
import { BEAT_INFO, type BeatKind, type Level, type TowerParams } from "./generator";

// HUD card for the PCG Tower: experience-graph chips, run stats and generator controls.

export interface HudHandlers {
  regenerate(p: TowerParams): void;
  restart(): void;
  leave(): void;
  info(): void;
  click(): void;
}

export interface HudState {
  coins: number;
  coinTotal: number;
  time: number;
  best: number | undefined;
  falls: number;
  currentBeat: number;
  started: boolean;
}

const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");

export function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, "0")}`;
}

export class TowerHud {
  readonly root = el("div", "mg-card");
  private title = el("div");
  private chips = el("div");
  private legend = el("div");
  private stats = el("div");
  private validator = el("div");
  private controls = el("div");
  private chipEls: HTMLElement[] = [];
  private lastBeat = -2;
  private sliders: Record<"seed" | "difficulty" | "length", HTMLInputElement> = {} as never;
  private toggle = el("button", "btn small secondary", "▾");
  private collapsed = false;

  constructor(private h: HudHandlers, params: TowerParams, startCollapsed = false) {
    this.root.style.maxWidth = "min(340px, 72vw)";
    const head = el("div");
    head.style.cssText = "display:flex;align-items:center;gap:6px";
    this.title.style.flex = "1";
    this.toggle.style.padding = "2px 9px";
    this.toggle.title = "Show / hide generator controls";
    this.toggle.addEventListener("click", () => {
      this.setCollapsed(!this.collapsed);
      this.toggle.blur();
    });
    head.append(this.title, this.toggle);

    this.chips.style.cssText = "display:flex;flex-wrap:wrap;gap:3px;margin-top:6px";
    this.legend.style.cssText = "display:flex;flex-wrap:wrap;gap:4px 9px;margin-top:5px;font-size:0.7rem;font-weight:700;color:var(--ink-soft)";
    this.stats.style.cssText = "margin-top:6px;font-weight:700";
    this.validator.style.cssText = "margin-top:3px;font-size:0.74rem;color:var(--ink-soft)";

    const slider = (key: "seed" | "difficulty" | "length", label: string, min: number, max: number, value: number) => {
      const row = el("label", "mg-slider");
      const input = el("input");
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = "1";
      input.value = String(value);
      const out = el("span", undefined, String(value));
      input.addEventListener("input", () => (out.textContent = input.value));
      // Never keep keyboard focus on a slider: arrows/space belong to the game.
      input.addEventListener("change", () => input.blur());
      input.addEventListener("pointerup", () => input.blur());
      row.append(el("span", undefined, label), input, out);
      this.sliders[key] = input;
      return row;
    };
    const seedRow = slider("seed", "Seed", 1, 999, params.seed);
    const dice = el("button", "btn small secondary", "🎲");
    dice.title = "Random seed";
    dice.style.padding = "2px 6px";
    dice.addEventListener("click", () => {
      this.h.click();
      this.setSeed(1 + Math.floor(Math.random() * 999));
      dice.blur();
    });
    seedRow.style.gridTemplateColumns = "80px 1fr 34px auto";
    seedRow.append(dice);

    const btn = (label: string, cls: string, fn: () => void, title: string) => {
      const b = el("button", "btn small " + cls, label);
      b.title = title;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this.h.click();
        fn();
        b.blur();
      });
      return b;
    };
    const row = el("div", "mg-row");
    row.append(
      btn("Regenerate", "", () => this.h.regenerate(this.params()), "Build a new tower from these settings"),
      btn("Restart", "secondary", () => this.h.restart(), "Back to the start island, same tower"),
      btn("Leave", "secondary", () => this.h.leave(), "Return to town"),
      btn("?", "secondary", () => this.h.info(), "How this tower is generated"),
    );
    this.controls.append(seedRow, slider("difficulty", "Difficulty", 1, 5, params.difficulty), slider("length", "Length", 1, 5, params.length), row);
    this.controls.style.marginTop = "4px";
    this.root.append(head, this.chips, this.legend, this.stats, this.validator, this.controls);
    // Clicks on the card must not reach the canvas (camera drag).
    this.root.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.setCollapsed(startCollapsed);
  }

  /** Collapsed: just title, beat chips and stats (small screens). */
  setCollapsed(c: boolean) {
    this.collapsed = c;
    this.controls.style.display = c ? "none" : "";
    this.legend.style.display = c ? "none" : "flex";
    this.validator.style.display = c ? "none" : "";
    this.toggle.textContent = c ? "▸" : "▾";
  }

  params(): TowerParams {
    return {
      seed: Number(this.sliders.seed.value),
      difficulty: Number(this.sliders.difficulty.value),
      length: Number(this.sliders.length.value),
    };
  }

  setSeed(seed: number) {
    this.sliders.seed.value = String(seed);
    this.sliders.seed.dispatchEvent(new Event("input"));
  }

  setParams(p: TowerParams) {
    for (const k of ["seed", "difficulty", "length"] as const) {
      this.sliders[k].value = String(p[k]);
      this.sliders[k].dispatchEvent(new Event("input"));
    }
  }

  /** Rebuild the parts that depend on the generated level. */
  setLevel(level: Level) {
    const p = level.params;
    this.title.innerHTML = `<b>🗼 PCG Tower</b> <span class="tag">seed ${p.seed}</span> <span class="tag">D${p.difficulty} · L${p.length}</span>`;
    this.chips.innerHTML = "";
    this.chipEls = level.beats.map((b, i) => {
      const info = BEAT_INFO[b.kind];
      const c = el("span", undefined, info.short);
      c.title = `Beat ${i + 1}: ${info.label} (${b.to - b.from} platform${b.to - b.from === 1 ? "" : "s"})`;
      c.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:5px;font-size:10px;font-weight:900;color:#3a2a1a;background:${hex(info.color)};transition:opacity .2s, transform .2s`;
      this.chips.append(c);
      return c;
    });
    const kinds = [...new Set(level.beats.map((b) => b.kind))] as BeatKind[];
    this.legend.innerHTML = kinds
      .map((k) => `<span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:3px;background:${hex(BEAT_INFO[k].color)}"></i>${BEAT_INFO[k].label}</span>`)
      .join("");
    const issues = level.forced ? ` · <b>${level.forced} forced</b>` : "";
    this.validator.innerHTML = `${level.platforms.length} platforms · ${level.height.toFixed(0)} m tall · ${level.rejected} candidates re-sampled${level.backtracks ? ` · ${level.backtracks} backtracks` : ""}${issues} · ${level.runRequired ? "run-up jumps (Shift)" : "walking jumps"}`;
    this.lastBeat = -2;
  }

  update(s: HudState) {
    const best = s.best === undefined ? "—" : formatTime(s.best);
    const time = s.started ? formatTime(s.time) : "0:00.0";
    this.stats.innerHTML = `🪙 ${s.coins}/${s.coinTotal} &nbsp; ⏱ ${time} &nbsp; 🏆 ${best} &nbsp; 💫 ${s.falls}`;
    if (s.currentBeat !== this.lastBeat) {
      this.lastBeat = s.currentBeat;
      this.chipEls.forEach((c, i) => {
        c.style.opacity = i <= s.currentBeat ? "1" : "0.5";
        c.style.outline = i === s.currentBeat ? "2px solid #3a2a1a" : "none";
        c.style.transform = i === s.currentBeat ? "scale(1.15)" : "none";
      });
    }
  }
}
