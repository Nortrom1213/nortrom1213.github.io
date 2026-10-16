import * as THREE from "three";
import { vizRoundRect, vizText, type ResultViz } from "../../ui/results";
import { COLS, ROWS, SAFE_ROW, X0, Z0, type Grid } from "./grid";
import type { PotentialFields } from "./fields";
import type { AlertState, Guard } from "./guards";
import { rampColor } from "./heatmap";

// Round telemetry for The Archive and the result-screen visualisation: each guard's
// alert state over time, plus the combined potential field with the player's path.

const SAMPLE = 0.2;
const MAX_SAMPLES = 2400;

export class StealthTelemetry {
  times: number[] = [];
  meter: number[] = [];
  states: AlertState[][] = [];
  path: [number, number][] = [];
  accents: number[] = [];
  takenAt: number | null = null;
  end = 0;
  caught = false;
  field: Float32Array | null = null;
  guardsEnd: [number, number][] = [];
  private acc = 0;

  reset(guards: Guard[]) {
    this.times = [];
    this.meter = [];
    this.states = guards.map(() => []);
    this.path = [];
    this.accents = guards.map((g) => g.spawn.accent);
    this.takenAt = null;
    this.end = 0;
    this.caught = false;
    this.field = null;
    this.guardsEnd = [];
    this.acc = SAMPLE;
  }

  /** Called every play frame. */
  tick(dt: number, time: number, meter: number, guards: Guard[], px: number, pz: number) {
    this.acc += dt;
    if (this.acc < SAMPLE) return;
    this.acc = 0;
    this.times.push(time);
    this.meter.push(meter);
    guards.forEach((g, i) => this.states[i]?.push(g.state));
    this.path.push([px, pz]);
    if (this.times.length > MAX_SAMPLES) this.decimate();
  }

  private decimate() {
    const keep = <T>(a: T[]) => a.filter((_, i) => i % 2 === 0);
    this.times = keep(this.times);
    this.meter = keep(this.meter);
    this.states = this.states.map(keep);
    this.path = keep(this.path);
  }

  finish(time: number, caught: boolean, fields: PotentialFields, grid: Grid, guards: Guard[], px: number, pz: number) {
    this.end = time;
    this.caught = caught;
    this.times.push(time);
    this.meter.push(caught ? 1 : this.meter[this.meter.length - 1] ?? 0);
    guards.forEach((g, i) => this.states[i]?.push(g.state));
    this.path.push([px, pz]);
    const f = new Float32Array(grid.n);
    for (const c of grid.open) f[c] = fields.value(c, "combined");
    this.field = f;
    this.guardsEnd = guards.map((g) => [g.x, g.z]);
  }
}

const STATE_COL = ["#cfe3d4", "#f2b84b", "#e2452f"];
const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");

export function stealthViz(tel: StealthTelemetry, grid: Grid, lectern: THREE.Vector3): ResultViz {
  const tmp = new THREE.Color();
  const lanes = tel.states.length;

  const map = {
    label: "Combined potential field at the end · your path",
    aspect: COLS / ROWS,
    draw(g: CanvasRenderingContext2D, w: number, h: number) {
      const cw = w / COLS;
      const ch = h / ROWS;
      const X = (x: number) => (x - X0) * cw;
      const Y = (z: number) => (z - Z0) * ch;
      g.fillStyle = "#070a1c";
      g.fillRect(0, 0, w, h);
      for (let c = 0; c < grid.n; c++) {
        const i = c % COLS;
        const j = (c / COLS) | 0;
        const k = grid.kind[c];
        if (grid.blocked[c]) g.fillStyle = k === "#" ? "#8a7a68" : "#4a4458";
        else {
          rampColor(tel.field ? tel.field[c] : 0, tmp);
          g.fillStyle = `#${tmp.getHexString(THREE.SRGBColorSpace)}`;
        }
        g.fillRect(i * cw, j * ch, Math.ceil(cw), Math.ceil(ch));
      }
      // Patrol boundary (the entrance hall is outside the guards' target region).
      g.strokeStyle = "rgba(255,255,255,0.25)";
      g.setLineDash([4, 4]);
      g.beginPath();
      g.moveTo(0, SAFE_ROW * ch);
      g.lineTo(w, SAFE_ROW * ch);
      g.stroke();
      g.setLineDash([]);
      // Path.
      if (tel.path.length > 1) {
        for (const [col, lw] of [["rgba(0,0,0,0.55)", 4], ["#fff4d0", 2]] as const) {
          g.strokeStyle = col;
          g.lineWidth = lw;
          g.lineJoin = "round";
          g.beginPath();
          tel.path.forEach(([x, z], i) => (i ? g.lineTo(X(x), Y(z)) : g.moveTo(X(x), Y(z))));
          g.stroke();
        }
        const [sx, sz] = tel.path[0];
        g.fillStyle = "#4fd1bd";
        g.beginPath();
        g.arc(X(sx), Y(sz), 4, 0, Math.PI * 2);
        g.fill();
      }
      // Manuscript lectern.
      vizText(g, "★", X(lectern.x), Y(lectern.z), { size: 14, color: tel.takenAt !== null ? "#ffd98a" : "rgba(255,217,138,0.55)", align: "center" });
      // Guards at the end.
      tel.guardsEnd.forEach(([x, z], i) => {
        g.fillStyle = hex(tel.accents[i] ?? 0xffffff);
        g.strokeStyle = "#0b0f22";
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(X(x), Y(z), 4.5, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      });
      const end = tel.path[tel.path.length - 1];
      if (end && tel.caught) vizText(g, "✕", X(end[0]), Y(end[1]), { size: 16, weight: 900, color: "#ff5a3c", align: "center" });
    },
  };

  const LANE = 18;
  const TOP = 8;
  const timeline = {
    label: "Guard alert state over time",
    height: TOP + lanes * (LANE + 4) + 60,
    draw(g: CanvasRenderingContext2D, w: number, h: number) {
      const L = 40;
      const R = w - 10;
      const T = Math.max(tel.end, 1);
      const X = (t: number) => L + (t / T) * (R - L);
      g.fillStyle = "#f6ecd6";
      g.fillRect(0, 0, w, h);
      const n = tel.times.length;
      tel.states.forEach((lane, gi) => {
        const y = TOP + gi * (LANE + 4);
        g.fillStyle = hex(tel.accents[gi] ?? 0xffffff);
        g.beginPath();
        g.arc(10, y + LANE / 2, 4, 0, Math.PI * 2);
        g.fill();
        vizText(g, `G${gi + 1}`, 17, y + LANE / 2, { size: 10, weight: 800, color: "#3a2a1e" });
        vizRoundRect(g, L, y, R - L, LANE, 4);
        g.fillStyle = STATE_COL[0];
        g.fill();
        g.save();
        g.clip();
        for (let i = 0; i < n - 1; i++) {
          const s = lane[i] ?? 0;
          if (!s) continue;
          g.fillStyle = STATE_COL[s];
          const x0 = X(tel.times[i]);
          g.fillRect(x0, y, Math.max(1, X(tel.times[i + 1]) - x0 + 0.5), LANE);
        }
        g.restore();
      });
      // Detection meter.
      const my = TOP + lanes * (LANE + 4) + 2;
      const mh = 18;
      vizText(g, "meter", 4, my + mh / 2, { size: 9, weight: 800 });
      g.fillStyle = "rgba(58,42,30,0.08)";
      g.fillRect(L, my, R - L, mh);
      g.beginPath();
      g.moveTo(X(0), my + mh);
      for (let i = 0; i < n; i++) g.lineTo(X(tel.times[i]), my + mh - tel.meter[i] * mh);
      g.lineTo(X(tel.times[n - 1] ?? 0), my + mh);
      g.closePath();
      g.fillStyle = "rgba(232,177,60,0.75)";
      g.fill();
      // Axis.
      const ay = my + mh + 12;
      const step = T > 120 ? 30 : T > 50 ? 10 : 5;
      for (let s = 0; s <= T + 1e-6; s += step) vizText(g, `${s}s`, X(s), ay, { size: 9, align: "center" });
      // Events.
      const mark = (t: number, text: string, col: string) => {
        const x = X(t);
        g.strokeStyle = col;
        g.lineWidth = 1.5;
        g.setLineDash([3, 3]);
        g.beginPath();
        g.moveTo(x, TOP - 4);
        g.lineTo(x, my + mh);
        g.stroke();
        g.setLineDash([]);
        vizText(g, text, Math.min(R - 2, x + 3), h - 7, { size: 9, weight: 800, color: col, align: x > R - 60 ? "right" : "left" });
      };
      if (tel.takenAt !== null) mark(tel.takenAt, "📜 taken", "#8a5a00");
      if (tel.caught) mark(tel.end, "caught", "#c0301c");
    },
  };

  return {
    title: "What the guards were thinking",
    panes: [map, timeline],
    legend: `<span><i style="background:${STATE_COL[0]}"></i>calm patrol</span><span><i style="background:${STATE_COL[1]}"></i>wary (heard / glimpsed)</span><span><i style="background:${STATE_COL[2]}"></i>alarm (chasing)</span><span><i style="background:linear-gradient(90deg,#1c3a8c,#169e8c,#f2c14e,#ff4f38)"></i>field: low → high</span><span>★ manuscript · dots = guards at the end</span>`,
    caption:
      "Each guard walks to the peak of information (time unseen) + confidence (where you might be) − connectivity (BFS distance), avoiding team-mates' targets: the cold cells are where their gaze just reset the information map, and alarms are confidence spikes pulling the team onto your trail (Xu et al., AIIDE 2025 Best Student Paper; multi-guard extension, CoG 2026).",
  };
}
