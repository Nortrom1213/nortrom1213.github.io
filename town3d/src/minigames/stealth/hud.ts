import { el } from "../../ui/ui";
import type { FieldLayer } from "./fields";
import { rampCss } from "./heatmap";

// Mini-game HUD cards mounted in ui.mgLayer: objective, detection meter, timer,
// buttons, and a legend explaining the heatmap layer on show.

export const LAYERS: (FieldLayer | "off")[] = ["off", "combined", "information", "confidence"];

const LAYER_TEXT: Record<FieldLayer, { name: string; desc: string }> = {
  combined: {
    name: "Combined field",
    desc: "Information + confidence. Each guard adds its own connectivity (BFS distance) and steers to the best nearby cell, avoiding team-mates' targets.",
  },
  information: {
    name: "Information map",
    desc: "Time since a guard last saw each cell. Stale cells glow and pull patrols toward them; a guard's gaze resets them. (The entrance hall is outside the patrol region.)",
  },
  confidence: {
    name: "Confidence map",
    desc: "Where the guards believe you are. Spikes when you are seen or heard, then diffuses and fades as they search.",
  },
};

export interface HudHandlers {
  onHeatmap: () => void;
  onRestart: () => void;
  onLeave: () => void;
}

export class ArchiveHud {
  private card = el("div", "mg-card");
  private legend = el("div", "mg-card");
  private attempt = el("span", "tag");
  private objective = el("div");
  private meterFill = el("div");
  private meterLabel = el("span");
  private timer = el("span");
  private best = el("span");
  private heatBtn = el("button", "btn small", "Heatmap: Off");
  private legendName = el("b");
  private legendDesc = el("div");

  constructor(h: HudHandlers) {
    const head = el("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";
    head.append(el("b", undefined, "🗝️ The Archive"), this.attempt);
    this.objective.style.cssText = "margin-top:4px;font-weight:700";

    const meterRow = el("div");
    meterRow.style.cssText = "display:grid;grid-template-columns:76px 1fr;gap:6px;align-items:center;margin-top:6px;font-size:0.8rem;font-weight:800";
    const track = el("div");
    track.style.cssText = "height:10px;border-radius:99px;background:rgba(40,30,20,0.18);overflow:hidden;border:1px solid rgba(138,90,52,0.5)";
    this.meterFill.style.cssText = "height:100%;width:0%;border-radius:99px;background:#e8b13c;transition:background 0.2s";
    track.append(this.meterFill);
    this.meterLabel.textContent = "Detection";
    meterRow.append(this.meterLabel, track);

    const timeRow = el("div");
    timeRow.style.cssText = "display:flex;justify-content:space-between;margin-top:4px;font-size:0.82rem;font-variant-numeric:tabular-nums";
    timeRow.append(this.timer, this.best);

    const row = el("div", "mg-row");
    const restart = el("button", "btn small secondary", "Restart");
    const leave = el("button", "btn small secondary", "Leave");
    this.heatBtn.title = "Show the guards' potential field (H)";
    for (const [b, fn] of [[this.heatBtn, h.onHeatmap], [restart, h.onRestart], [leave, h.onLeave]] as const) {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        fn();
        b.blur();
      });
    }
    row.append(this.heatBtn, restart, leave);
    this.card.append(head, this.objective, meterRow, timeRow, row);

    const bar = el("div");
    bar.style.cssText = `height:9px;border-radius:99px;margin:6px 0 2px;background:${rampCss()}`;
    const ends = el("div", undefined, "<span>low</span><span>high</span>");
    ends.style.cssText = "display:flex;justify-content:space-between;font-size:0.72rem;font-weight:800;opacity:0.7";
    this.legendDesc.style.cssText = "font-size:0.8rem;margin-top:4px;line-height:1.35";
    const key = el("div", undefined, "Rings = each guard's chosen target · lines = planned path");
    key.style.cssText = "font-size:0.74rem;margin-top:4px;opacity:0.75";
    this.legend.append(this.legendName, bar, ends, this.legendDesc, key);
    this.legend.style.display = "none";
  }

  mount(layer: HTMLElement) {
    layer.append(this.card, this.legend);
  }

  unmount() {
    this.card.remove();
    this.legend.remove();
  }

  setAttempt(n: number) {
    this.attempt.textContent = `Attempt ${n}`;
  }

  setObjective(html: string) {
    this.objective.innerHTML = html;
  }

  setMeter(v: number, alarmed: boolean) {
    this.meterFill.style.width = `${Math.round(Math.min(1, v) * 100)}%`;
    this.meterFill.style.background = alarmed ? "#e2452f" : v > 0.01 ? "#e8b13c" : "#7fbf9a";
    this.meterLabel.textContent = alarmed ? "ALARM!" : "Detection";
    this.meterLabel.style.color = alarmed ? "#c0301c" : "";
  }

  setTime(sec: number, best: number | undefined) {
    this.timer.textContent = `⏱ ${formatTime(sec)}`;
    this.best.textContent = best !== undefined ? `Best ${formatTime(best)}` : "Best —";
  }

  setLayer(layer: FieldLayer | "off") {
    if (layer === "off") {
      this.heatBtn.textContent = "Heatmap: Off";
      this.legend.style.display = "none";
      return;
    }
    const t = LAYER_TEXT[layer];
    this.heatBtn.textContent = `Heatmap: ${layer === "combined" ? "All" : layer === "information" ? "Info" : "Belief"}`;
    this.legendName.textContent = t.name;
    this.legendDesc.textContent = t.desc;
    this.legend.style.display = "";
  }
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
