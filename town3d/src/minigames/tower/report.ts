import { vizText, type ResultViz } from "../../ui/results";
import { BEAT_INFO, type Level } from "./generator";

// Climb telemetry for the PCG Tower and the result-screen picture: the experience
// graph as a strip of beat nodes, fanning up to the realised platform heights, with
// the places the player fell from.

export class TowerTelemetry {
  /** Platform index the player last stood on. */
  last = 0;
  /** Platform index each fall started from. */
  falls: number[] = [];
  /** First time (s) each platform was reached, or -1. */
  reached: number[] = [];

  reset(level: Level) {
    this.last = 0;
    this.falls = [];
    this.reached = level.platforms.map((_, i) => (i === 0 ? 0 : -1));
  }

  stand(idx: number, time: number) {
    this.last = idx;
    if (this.reached[idx] === -1) this.reached[idx] = time;
  }

  fell() {
    this.falls.push(this.last);
  }
}

const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");

export function towerViz(level: Level, tel: TowerTelemetry, coinsTaken: boolean[]): ResultViz {
  const P = level.platforms;
  const n = P.length;
  const beats = level.beats;
  const fallCount = new Map<number, number>();
  for (const f of tel.falls) fallCount.set(f, (fallCount.get(f) ?? 0) + 1);

  const pane = {
    label: `Experience graph (${beats.length} beats) → ${n} realised platforms`,
    height: 230,
    draw(g: CanvasRenderingContext2D, w: number, h: number) {
      const L = 34;
      const R = w - 10;
      const top = 18;
      const bottom = h - 66;
      const lo = Math.min(0, level.lowest);
      const hi = Math.max(1, level.height);
      const X = (i: number) => L + ((i + 0.5) / n) * (R - L);
      const Y = (y: number) => bottom - ((y - lo) / (hi - lo)) * (bottom - top);
      g.fillStyle = "#f6ecd6";
      g.fillRect(0, 0, w, h);

      // Beat bands.
      const band = (b: (typeof beats)[number]) => [L + (b.from / n) * (R - L), L + (b.to / n) * (R - L)] as const;
      for (const b of beats) {
        const [x0, x1] = band(b);
        g.fillStyle = hex(BEAT_INFO[b.kind].color) + "38";
        g.fillRect(x0, top - 6, Math.max(1, x1 - x0), bottom - top + 6);
      }
      // Axis.
      g.strokeStyle = "rgba(58,42,30,0.25)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(L, Y(0));
      g.lineTo(R, Y(0));
      g.stroke();
      vizText(g, `${hi.toFixed(0)} m`, L - 4, Y(hi), { size: 9, align: "right" });
      vizText(g, "0 m", L - 4, Y(0), { size: 9, align: "right" });

      // Realised heights.
      g.strokeStyle = "#3a2a1e";
      g.lineWidth = 1.5;
      g.beginPath();
      P.forEach((p, i) => (i ? g.lineTo(X(i), Y(p.top)) : g.moveTo(X(i), Y(p.top))));
      g.stroke();
      const r = Math.max(1.6, Math.min(4, (R - L) / n / 2.2));
      P.forEach((p, i) => {
        g.fillStyle = hex(BEAT_INFO[p.kind].color);
        g.strokeStyle = tel.reached[i] >= 0 ? "#3a2a1e" : "rgba(58,42,30,0.35)";
        g.lineWidth = 1;
        g.beginPath();
        g.arc(X(i), Y(p.top), r, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      });
      for (const c of level.checkpoints.slice(1)) vizText(g, "⚑", X(c), Y(P[c].top) - 10, { size: 10, color: "#22655d", align: "center" });
      // Coins sit on reward platforms.
      level.coins.forEach((coin, k) => {
        let best = 0;
        let bd = Infinity;
        P.forEach((p, i) => {
          const d = Math.hypot(p.cx - coin.x, p.cz - coin.z);
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        vizText(g, "★", X(best), Y(P[best].top) - 10, { size: 10, color: coinsTaken[k] ? "#d9a43a" : "rgba(110,90,72,0.45)", align: "center" });
      });
      // Falls.
      for (const [i, k] of fallCount) {
        const x = X(i);
        const y = Y(P[i].top) + 11;
        vizText(g, "✕", x, y, { size: 12, weight: 900, color: "#c0301c", align: "center" });
        if (k > 1) vizText(g, `×${k}`, x + 7, y + 1, { size: 9, weight: 900, color: "#c0301c" });
      }
      vizText(g, "▲", X(level.summit), Y(P[level.summit].top) - 11, { size: 10, color: "#d0503a", align: "center" });

      // Experience-graph strip: evenly spaced nodes, fanned up to their platforms.
      const sy = h - 18;
      const nb = beats.length;
      const step = nb > 1 ? (R - L) / (nb - 1) : 0;
      const NX = (k: number) => (nb > 1 ? L + k * step : (L + R) / 2);
      const nr = Math.max(3, Math.min(8, step / 2 - 1));
      beats.forEach((b, k) => {
        const [x0, x1] = band(b);
        g.strokeStyle = hex(BEAT_INFO[b.kind].color);
        g.globalAlpha = 0.7;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(NX(k), sy - nr);
        g.lineTo((x0 + x1) / 2, bottom + 4);
        g.stroke();
        g.globalAlpha = 1;
      });
      g.strokeStyle = "#cdb88c";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(NX(0), sy);
      g.lineTo(NX(nb - 1), sy);
      g.stroke();
      beats.forEach((b, k) => {
        const info = BEAT_INFO[b.kind];
        g.fillStyle = hex(info.color);
        g.strokeStyle = "#3a2a1e";
        g.lineWidth = 1;
        g.beginPath();
        g.arc(NX(k), sy, nr, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        if (nr >= 6) vizText(g, info.short, NX(k), sy + 0.5, { size: 8, weight: 900, color: "#3a2a1a", align: "center" });
      });
      vizText(g, "beats", 4, sy, { size: 9, weight: 800 });
    },
  };

  const kinds = [...new Set(beats.map((b) => b.kind))];
  const legend =
    kinds.map((k) => `<span><i style="background:${hex(BEAT_INFO[k].color)}"></i>${BEAT_INFO[k].label}</span>`).join("") +
    `<span>⚑ checkpoint · ★ coin · <b style="color:#c0301c">✕</b> you fell from here</span>`;
  const reasons = Object.entries(level.reasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k, v]) => `${v} “${k}”`)
    .join(", ");
  return {
    title: "How this tower was generated",
    panes: [pane],
    legend,
    caption: `The generator first samples the beat sequence along the bottom (the experience graph), then realises each beat as platforms and keeps a hop only if the local validator's ballistic check against the real jump physics passes — ${level.rejected} candidates were re-sampled for this tower${reasons ? ` (mostly ${reasons})` : ""}, as in “From Experience to 3D Platformer Levels via Topological Graphs” (AIIDE 2026).`,
  };
}
