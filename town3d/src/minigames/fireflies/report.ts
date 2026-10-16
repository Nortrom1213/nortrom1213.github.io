import { vizText, type ResultViz } from "../../ui/results";
import type { FireflySwarm, SwarmMode } from "./swarm";

// Jar-challenge telemetry and the result-screen chart: the swarm's local order
// parameter (alignment) over the round, against the counterfactual for the other
// mode at the same positions, with every catch marked.

const SAMPLE = 0.25;

export class SwarmTelemetry {
  t: number[] = [];
  measured: number[] = [];
  counter: number[] = [];
  catches: number[] = [];
  mode: SwarmMode = "perlin";
  private acc = 0;

  reset(mode: SwarmMode) {
    this.t = [];
    this.measured = [];
    this.counter = [];
    this.catches = [];
    this.mode = mode;
    this.acc = SAMPLE;
  }

  tick(dt: number, elapsed: number, swarm: FireflySwarm) {
    this.acc += dt;
    if (this.acc < SAMPLE) return;
    this.acc = 0;
    const o = swarm.orderParameter();
    if (o.n < 2) return;
    this.t.push(elapsed);
    this.measured.push(o.measured);
    this.counter.push(o.counter);
  }

  caught(elapsed: number) {
    this.catches.push(elapsed);
  }
}

const COL: Record<SwarmMode, string> = { perlin: "#9be05a", random: "#ff8a5c" };
const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

export function swarmViz(tel: SwarmTelemetry, end: number, goal: number): ResultViz {
  const perlin = tel.mode === "perlin";
  const mainCol = COL[tel.mode];
  const cfCol = perlin ? "rgba(255,170,140,0.85)" : "rgba(180,235,140,0.85)";
  const mAvg = avg(tel.measured);
  const cAvg = avg(tel.counter);
  const pane = {
    label: `Local alignment of the swarm over the round (${perlin ? "Perlin-coordinated" : "independent random"} mode)`,
    height: 200,
    draw(g: CanvasRenderingContext2D, w: number, h: number) {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#111833");
      bg.addColorStop(1, "#1b2c36");
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      const L = 30;
      const R = w - 58;
      const top = 14;
      const bottom = h - 34;
      const T = Math.max(end, 1);
      const X = (t: number) => L + (t / T) * (R - L);
      const Y = (v: number) => bottom - v * (bottom - top);
      for (const v of [0, 0.5, 1]) {
        g.strokeStyle = "rgba(255,255,255,0.1)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(L, Y(v));
        g.lineTo(R, Y(v));
        g.stroke();
        vizText(g, v.toFixed(1), L - 5, Y(v), { size: 9, color: "rgba(255,255,255,0.6)", align: "right" });
      }
      // Catch events.
      for (const c of tel.catches) {
        const x = X(c);
        g.strokeStyle = "rgba(230,255,150,0.16)";
        g.beginPath();
        g.moveTo(x, top);
        g.lineTo(x, bottom);
        g.stroke();
        const rg = g.createRadialGradient(x, bottom + 8, 0, x, bottom + 8, 6);
        rg.addColorStop(0, "rgba(230,255,150,0.95)");
        rg.addColorStop(1, "rgba(230,255,150,0)");
        g.fillStyle = rg;
        g.fillRect(x - 6, bottom + 2, 12, 12);
      }
      const line = (vals: number[], col: string, width: number, dash: number[]) => {
        if (vals.length < 2) return;
        g.strokeStyle = col;
        g.lineWidth = width;
        g.setLineDash(dash);
        g.lineJoin = "round";
        g.beginPath();
        vals.forEach((v, i) => (i ? g.lineTo(X(tel.t[i]), Y(v)) : g.moveTo(X(tel.t[i]), Y(v))));
        g.stroke();
        g.setLineDash([]);
      };
      line(tel.counter, cfCol, 1.5, [5, 4]);
      line(tel.measured, mainCol, 2.5, []);
      vizText(g, `avg ${mAvg.toFixed(2)}`, R + 6, Y(mAvg), { size: 10, weight: 900, color: mainCol });
      vizText(g, `avg ${cAvg.toFixed(2)}`, R + 6, Y(cAvg) + (Math.abs(Y(cAvg) - Y(mAvg)) < 12 ? 12 : 0), { size: 9, weight: 800, color: cfCol });
      const step = T > 50 ? 10 : 5;
      for (let s = 0; s <= T + 1e-6; s += step) vizText(g, `${s}s`, X(s), h - 8, { size: 9, color: "rgba(255,255,255,0.6)", align: "center" });
      vizText(g, `✨ ${tel.catches.length}/${goal} caught`, R, h - 8, { size: 9, weight: 800, color: "rgba(230,255,150,0.9)", align: "right" });
    },
  };
  return {
    title: "What the swarm did",
    panes: [pane],
    legend: `<span><i style="background:${mainCol}"></i>measured alignment (${perlin ? "shared Perlin field" : "independent walkers"})</span><span><i style="background:${cfCol};height:3px;vertical-align:3px"></i>${perlin ? "what independent random headings would give" : "what the shared noise field would impose here"}</span><span><i style="background:#e6ff96;border-radius:50%"></i>a catch</span>`,
    caption: perlin
      ? `With one shared, smoothly drifting Perlin field, neighbours read near-identical steering, so the swarm stays aligned (avg ${mAvg.toFixed(2)} vs ${cAvg.toFixed(2)} for independent headings) without a single message passed — the zero-communication coordination of “(Perlin) Noise as AI coordinator” (FDG 2026). Try the random mode to see the line collapse.`
      : `Independent random walkers only reach chance-level alignment (avg ${mAvg.toFixed(2)}); the same agents sampling one shared Perlin field would be at ${cAvg.toFixed(2)} — the coordination “(Perlin) Noise as AI coordinator” (FDG 2026) gets for free, with no communication.`,
  };
}
