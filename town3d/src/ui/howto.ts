import "./minigame-ui.css";
import { el } from "./ui";
import { DIFFICULTIES, DIFF_ICON, DIFF_LABEL, getDifficulty, setDifficulty, type Difficulty } from "./leaderboard";

// Intro-panel helpers shared by the research mini-games: a difficulty picker and a
// ~10 s looping "how to play" canvas demo next to three short rules.

// ---- Canvas helpers ---------------------------------------------------------------

/** Size a canvas for its CSS box at the device pixel ratio; returns a context in CSS pixels. */
export function fitCanvas(c: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D | null {
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const W = Math.max(1, Math.round(w * dpr));
  const H = Math.max(1, Math.round(h * dpr));
  if (c.width !== W) c.width = W;
  if (c.height !== H) c.height = H;
  const css = `${Math.round(h)}px`;
  if (c.style.height !== css) c.style.height = css;
  const g = c.getContext("2d");
  if (!g) return null;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return g;
}

/** Demo frame in a fixed 320 x 180 design space. `dt` is the frame step (0 on loop wrap). */
type DemoFn = (g: CanvasRenderingContext2D, t: number, dt: number) => void;

const DW = 320;
const DH = 180;
const PERIOD = 10;

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Run a looping demo until the canvas leaves the document. */
function animateDemo(c: HTMLCanvasElement, demo: DemoFn) {
  const reduce = prefersReducedMotion();
  const t0 = performance.now();
  let seen = false;
  let waited = 0;
  let last = -1;
  const frame = (now: number) => {
    if (!c.isConnected) {
      if (!seen) {
        if (++waited > 600) return;
        requestAnimationFrame(frame);
        return;
      }
      // Detached because another panel is stacked on top (e.g. a paper): poll
      // slowly so the demo resumes on return; give up after ~30 minutes.
      if (++waited > 4500) return;
      setTimeout(() => requestAnimationFrame(frame), 400);
      return;
    }
    waited = 0;
    seen = true;
    if (!document.hidden) {
      const w = c.clientWidth || c.parentElement?.clientWidth || DW;
      const h = (w * DH) / DW;
      const g = fitCanvas(c, w, h);
      if (g) {
        // Reduced motion: hold a representative frame (stateful demos still settle).
        const t = reduce ? PERIOD * 0.42 : ((now - t0) / 1000) % PERIOD;
        const dt = last < 0 || t < last ? 0 : Math.min(0.05, t - last);
        last = t;
        g.save();
        g.scale(w / DW, h / DH);
        demo(g, t, dt);
        g.restore();
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Fade to dark at the loop seam so the restart reads as a cut. */
function seam(g: CanvasRenderingContext2D, t: number, color = "13,15,24") {
  const a = Math.max(1 - smooth(0, 0.35, t), smooth(PERIOD - 0.4, PERIOD, t));
  if (a <= 0.001) return;
  g.fillStyle = `rgba(${color},${a})`;
  g.fillRect(0, 0, DW, DH);
}

function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, color = "rgba(255,255,255,0.85)", size = 9, align: CanvasTextAlign = "center") {
  g.font = `800 ${size}px Nunito, system-ui, sans-serif`;
  g.textAlign = align;
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.fillText(text, x, y);
}

// ---- Stealth: a dot sneaks behind a patrolling vision cone ----------------------------

function stealthDemo(): DemoFn {
  const path: [number, number, number][] = [
    [0, 160, 162],
    [1.2, 50, 150],
    [2.2, 50, 60],
    [3.6, 135, 30],
    [4.2, 160, 30],
    [5.4, 270, 50],
    [6.8, 270, 130],
    [8.6, 165, 162],
    [10, 160, 162],
  ];
  const at = (t: number): [number, number] => {
    for (let i = 1; i < path.length; i++) {
      const [t1, x1, y1] = path[i];
      const [t0, x0, y0] = path[i - 1];
      if (t <= t1) {
        const k = smooth(0, 1, (t - t0) / (t1 - t0));
        return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
      }
    }
    return [path[0][1], path[0][2]];
  };
  const RANGE = 88;
  const FOV = (62 * Math.PI) / 180;
  return (g, t) => {
    g.fillStyle = "#1d2338";
    g.fillRect(0, 0, DW, DH);
    g.strokeStyle = "rgba(255,255,255,0.045)";
    g.lineWidth = 1;
    for (let x = 10; x < DW; x += 20) {
      g.beginPath();
      g.moveTo(x, 8);
      g.lineTo(x, DH - 8);
      g.stroke();
    }
    for (let y = 10; y < DH; y += 20) {
      g.beginPath();
      g.moveTo(8, y);
      g.lineTo(DW - 8, y);
      g.stroke();
    }
    g.strokeStyle = "#5a6488";
    g.lineWidth = 4;
    g.strokeRect(6, 6, DW - 12, DH - 12);
    // Exit.
    g.fillStyle = "rgba(240,196,106,0.75)";
    g.fillRect(138, DH - 8, 44, 4);
    label(g, "EXIT", 160, DH - 15, "rgba(240,196,106,0.85)", 7);
    // Cabinets.
    g.fillStyle = "#3a4370";
    for (const [x, y] of [[82, 113], [218, 113]]) {
      roundRect(g, x, y, 26, 14, 3);
      g.fill();
    }
    // Manuscript.
    const taken = t >= 3.9;
    if (!taken) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 5);
      const rg = g.createRadialGradient(148, 20, 1, 148, 20, 16);
      rg.addColorStop(0, `rgba(255,214,120,${0.7 * pulse})`);
      rg.addColorStop(1, "rgba(255,214,120,0)");
      g.fillStyle = rg;
      g.fillRect(128, 4, 40, 34);
      g.fillStyle = "#7a1e2a";
      g.fillRect(141, 16, 14, 9);
      g.fillStyle = "#fff2c8";
      g.fillRect(143, 17, 10, 6);
    }

    // Guard: patrols the middle line, turning through "up" at each end.
    const ph = (2 * Math.PI * t) / PERIOD;
    const gx = 160 + 100 * Math.sin(ph);
    const gy = 90;
    const s = smooth(-0.3, 0.3, Math.cos(ph));
    const head = -Math.PI * (1 - s);
    const [px, py] = at(t);
    const dx = px - gx;
    const dy = py - gy;
    const d = Math.hypot(dx, dy);
    const off = Math.abs(angDiff(Math.atan2(dy, dx), head));
    const near = d < RANGE * 1.2 && off < FOV * 0.75;
    const col = near ? "255,154,60" : "255,212,92";
    const rg = g.createRadialGradient(gx, gy, 2, gx, gy, RANGE);
    rg.addColorStop(0, `rgba(${col},0.5)`);
    rg.addColorStop(1, `rgba(${col},0.04)`);
    g.fillStyle = rg;
    g.beginPath();
    g.moveTo(gx, gy);
    g.arc(gx, gy, RANGE, head - FOV / 2, head + FOV / 2);
    g.closePath();
    g.fill();
    g.fillStyle = "#34497a";
    g.beginPath();
    g.arc(gx, gy, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1f2b4a";
    g.beginPath();
    g.arc(gx, gy, 7, head - 1.2, head + 1.2);
    g.lineTo(gx, gy);
    g.fill();
    g.fillStyle = "#ffe08a";
    g.beginPath();
    g.arc(gx + Math.cos(head) * 8, gy + Math.sin(head) * 8, 2.4, 0, Math.PI * 2);
    g.fill();
    if (near) label(g, "?", gx, gy - 14, "#ffd45c", 12);
    else label(g, "guard", gx, gy + 15, "rgba(255,255,255,0.55)", 7);

    // Player trail + dot.
    for (let k = 12; k >= 1; k--) {
      const tt = t - k * 0.13;
      if (tt < 0) continue;
      const [qx, qy] = at(tt);
      g.fillStyle = `rgba(122,224,206,${0.32 * (1 - k / 13)})`;
      g.beginPath();
      g.arc(qx, qy, 2, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#4fd1bd";
    g.strokeStyle = "#fff";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(px, py, 6, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (taken) {
      g.fillStyle = "#7a1e2a";
      g.fillRect(px - 5, py - 15, 10, 6);
      g.fillStyle = "#fff2c8";
      g.fillRect(px - 3.5, py - 14, 7, 4);
    } else label(g, "you", px, py + 13, "rgba(160,240,226,0.9)", 7);
    if (t > 3.6 && t < 4.6) label(g, "got it!", 150, 44, "#ffe08a", 9);
    seam(g, t);
  };
}

// ---- Tower: a dot hops validated platforms; the experience graph runs along the bottom --

const BEAT: Record<string, string> = {
  start: "#7cc06a",
  gap: "#e6a65a",
  climb: "#8aa8d0",
  narrow: "#d4866a",
  reward: "#f4cf3c",
  checkpoint: "#56b8a8",
  zigzag: "#b79ad8",
  summit: "#f07868",
};

function towerDemo(): DemoFn {
  const P = [
    { x: 30, w: 50, y: 0, k: "start" },
    { x: 92, w: 26, y: 10, k: "gap" },
    { x: 140, w: 22, y: 30, k: "climb" },
    { x: 182, w: 22, y: 50, k: "climb" },
    { x: 228, w: 15, y: 56, k: "narrow" },
    { x: 268, w: 15, y: 66, k: "narrow" },
    { x: 314, w: 28, y: 78, k: "reward" },
    { x: 364, w: 38, y: 90, k: "checkpoint" },
    { x: 420, w: 22, y: 106, k: "zigzag" },
    { x: 474, w: 48, y: 124, k: "summit" },
  ];
  const HOP = 0.95;
  const AIR = 0.6;
  const T0 = 0.45;
  /** Dot position and the platform index it is on / leaving. */
  const dot = (t: number) => {
    const u = Math.max(0, t - T0);
    const i = Math.min(P.length - 1, Math.floor(u / HOP));
    if (i >= P.length - 1) return { x: P[P.length - 1].x, y: P[P.length - 1].y, i: P.length - 1, air: false, k: 0 };
    const f = u - i * HOP;
    const a = P[i];
    const b = P[i + 1];
    const stand = HOP - AIR;
    if (f < stand) return { x: a.x + (a.w / 2 - 6) * (f / stand), y: a.y, i, air: false, k: f / stand };
    const k = (f - stand) / AIR;
    const x0 = a.x + a.w / 2 - 6;
    const x1 = b.x;
    const apex = Math.max(a.y, b.y) + 16;
    // Quadratic through (0, a.y), (1, b.y) peaking near apex.
    const y = a.y + (b.y - a.y) * k + 4 * (apex - (a.y + b.y) / 2) * k * (1 - k);
    return { x: x0 + (x1 - x0) * k, y, i, air: true, k };
  };
  return (g, t) => {
    const sky = g.createLinearGradient(0, 0, 0, DH);
    sky.addColorStop(0, "#8cc6ec");
    sky.addColorStop(1, "#e4f2fb");
    g.fillStyle = sky;
    g.fillRect(0, 0, DW, DH);
    const d = dot(t);
    const camX = Math.max(0, Math.min(P[P.length - 1].x + 60 - DW, d.x - 120));
    const camY = Math.max(0, d.y - 40);
    const base = 128;
    const sx = (x: number) => x - camX;
    const sy = (y: number) => base - (y - camY);
    // Clouds + pillar (parallax).
    g.fillStyle = "rgba(255,255,255,0.75)";
    for (const [cx, cy, r] of [[60, 40, 14], [200, 28, 18], [420, 50, 15], [560, 30, 16]]) {
      const x = cx - camX * 0.3;
      g.beginPath();
      g.arc(x, cy, r, 0, Math.PI * 2);
      g.arc(x + r, cy + 4, r * 0.8, 0, Math.PI * 2);
      g.arc(x - r, cy + 5, r * 0.7, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "rgba(160,150,140,0.28)";
    g.fillRect(250 - camX * 0.5, 0, 26, DH);
    // Platforms.
    P.forEach((p, i) => {
      const x = sx(p.x - p.w / 2);
      const y = sy(p.y);
      if (x > DW + 10 || x + p.w < -10) return;
      g.fillStyle = "#8a7a68";
      g.beginPath();
      g.moveTo(x + 2, y + 5);
      g.lineTo(x + p.w - 2, y + 5);
      g.lineTo(x + p.w / 2, y + 5 + Math.min(26, p.w * 0.7));
      g.closePath();
      g.fill();
      g.fillStyle = BEAT[p.k];
      roundRect(g, x, y, p.w, 6, 2.5);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.fillRect(x + 2, y + 1, p.w - 4, 1.5);
      if (p.k === "reward" && d.i < i) {
        g.fillStyle = "#f4cf3c";
        g.beginPath();
        g.arc(sx(p.x), y - 9 + Math.sin(t * 4) * 1.5, 4, 0, Math.PI * 2);
        g.fill();
      }
      if (p.k === "summit") {
        g.strokeStyle = "#5a3a20";
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(sx(p.x + 10), y);
        g.lineTo(sx(p.x + 10), y - 26);
        g.stroke();
        g.fillStyle = "#f07868";
        g.beginPath();
        g.moveTo(sx(p.x + 10), y - 26);
        g.lineTo(sx(p.x + 24), y - 21 + Math.sin(t * 6) * 1.5);
        g.lineTo(sx(p.x + 10), y - 16);
        g.fill();
      }
    });
    // Validator: preview the next hop's arc while standing, then tick it.
    if (!d.air && d.i < P.length - 1) {
      const a = P[d.i];
      const b = P[d.i + 1];
      const x0 = a.x + a.w / 2 - 6;
      const apex = Math.max(a.y, b.y) + 16;
      g.setLineDash([3, 3]);
      g.strokeStyle = `rgba(40,140,90,${0.35 + 0.5 * d.k})`;
      g.lineWidth = 1.5;
      g.beginPath();
      for (let s = 0; s <= 16; s++) {
        const k = s / 16;
        const x = x0 + (b.x - x0) * k;
        const y = a.y + (b.y - a.y) * k + 4 * (apex - (a.y + b.y) / 2) * k * (1 - k);
        if (s === 0) g.moveTo(sx(x), sy(y) - 6);
        else g.lineTo(sx(x), sy(y) - 6);
      }
      g.stroke();
      g.setLineDash([]);
      if (d.k > 0.45) label(g, "✓", sx((x0 + b.x) / 2), sy(apex) - 14, "#1f8a5a", 11);
    }
    // The climber.
    const px = sx(d.x);
    const py = sy(d.y) - 6;
    g.fillStyle = "rgba(0,0,0,0.15)";
    if (!d.air) {
      g.beginPath();
      g.ellipse(px, sy(d.y) + 1, 6, 1.6, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#2f7d74";
    g.strokeStyle = "#fff";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(px, py, 5.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (d.i === P.length - 1) label(g, "Summit!", px, py - 18, "#b0402e", 11);

    // Experience graph strip.
    g.fillStyle = "rgba(255,250,240,0.92)";
    roundRect(g, 6, DH - 26, DW - 12, 20, 6);
    g.fill();
    label(g, "experience graph", 12, DH - 16, "#6e5a48", 7, "left");
    const n = P.length;
    const x0 = 86;
    const step = (DW - 18 - x0) / (n - 1);
    g.strokeStyle = "#cdb88c";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x0, DH - 16);
    g.lineTo(x0 + step * (n - 1), DH - 16);
    g.stroke();
    P.forEach((p, i) => {
      const cx = x0 + step * i;
      const on = i <= d.i;
      g.globalAlpha = on ? 1 : 0.4;
      g.fillStyle = BEAT[p.k];
      g.beginPath();
      g.arc(cx, DH - 16, i === d.i ? 6 : 4.5, 0, Math.PI * 2);
      g.fill();
      if (i === d.i) {
        g.strokeStyle = "#3a2a1e";
        g.lineWidth = 1.5;
        g.stroke();
      }
      g.globalAlpha = 1;
    });
    seam(g, t, "228,242,251");
  };
}

// ---- Deduction: testimony bubbles cross suspects off the hypothesis grid -----------------

function deductionDemo(): DemoFn {
  const who = [
    { n: "Tobin", c: "#4a6a7a" },
    { n: "Wren", c: "#3a7a5a" },
    { n: "Calla", c: "#6a8a4a" },
    { n: "Pip", c: "#b0502a" },
    { n: "Isolde", c: "#8a3a6a" },
  ];
  const lines = [
    { at: 0.5, s: 0, text: "“Calla is no werewolf.”", kills: [2] },
    { at: 3.0, s: 1, text: "“Tobin and I sat together.”", kills: [0, 1] },
    { at: 5.5, s: 4, text: "“It's Pip or Tobin.”", kills: [4] },
  ];
  const X = (i: number) => 40 + i * 60;
  const killAt = (i: number) => {
    for (const l of lines) if (l.kills.includes(i)) return l.at + 1.6;
    return Infinity;
  };
  return (g, t) => {
    g.fillStyle = "#f6ecd6";
    g.fillRect(0, 0, DW, DH);
    g.fillStyle = "rgba(138,90,52,0.06)";
    for (let i = 0; i < 40; i++) g.fillRect((i * 83) % DW, (i * 47) % DH, 2, 2);
    const reveal = smooth(8.0, 8.5, t);
    // Suspects.
    who.forEach((w, i) => {
      const x = X(i);
      const y = 62;
      const talking = lines.some((l) => l.s === i && t >= l.at && t < l.at + 2.2);
      const bob = talking ? Math.sin(t * 14) * 1.2 : 0;
      if (i === 3 && reveal > 0) {
        g.fillStyle = "#6a5040";
        for (const sgn of [-1, 1]) {
          g.beginPath();
          g.moveTo(x + sgn * 6, y - 13 + bob);
          g.lineTo(x + sgn * 13, y - 13 - 12 * reveal + bob);
          g.lineTo(x + sgn * 15, y - 7 + bob);
          g.fill();
        }
      }
      g.fillStyle = w.c;
      g.beginPath();
      g.arc(x, y + bob, 15, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#f5d6b4";
      g.beginPath();
      g.arc(x, y + 3 + bob, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#3a2a1e";
      g.fillRect(x - 4, y + 2 + bob, 2, 2);
      g.fillRect(x + 2, y + 2 + bob, 2, 2);
      label(g, w.n, x, y + 24, "#3a2a1e", 8);
    });
    // Speech bubble.
    for (const l of lines) {
      const k = t - l.at;
      if (k < 0 || k > 2.2) continue;
      const pop = smooth(0, 0.18, k) * (1 - smooth(1.95, 2.2, k));
      g.font = "800 9px Nunito, system-ui, sans-serif";
      const tw = g.measureText(l.text).width + 14;
      const cx = Math.max(tw / 2 + 4, Math.min(DW - tw / 2 - 4, X(l.s)));
      g.save();
      g.globalAlpha = pop;
      g.translate(cx, 22);
      g.scale(0.8 + 0.2 * pop, 0.8 + 0.2 * pop);
      g.fillStyle = "#fffaf0";
      g.strokeStyle = "#8a5a34";
      g.lineWidth = 1.5;
      roundRect(g, -tw / 2, -11, tw, 20, 8);
      g.fill();
      g.stroke();
      g.beginPath();
      const tx = X(l.s) - cx;
      g.moveTo(tx - 4, 8.5);
      g.lineTo(tx, 17);
      g.lineTo(tx + 4, 8.5);
      g.fill();
      label(g, l.text, 0, -1, "#3a2a1e", 9);
      g.restore();
    }
    // Hypothesis grid.
    let alive = 0;
    who.forEach((_, i) => {
      const x = X(i) - 22;
      const y = 108;
      const ka = killAt(i);
      const kp = clamp01((t - ka) / 0.45);
      if (kp < 1) alive++;
      const win = i === 3 && reveal > 0;
      g.fillStyle = win ? `rgba(244,207,60,${0.35 + 0.65 * reveal})` : kp >= 1 ? "#ddd2c0" : "#fffaf0";
      g.strokeStyle = win ? "#c08a10" : "#dcc79c";
      g.lineWidth = 1.5;
      roundRect(g, x, y, 44, 28, 6);
      g.fill();
      g.stroke();
      if (kp > 0) {
        g.strokeStyle = "#c0402a";
        g.lineWidth = 3;
        g.lineCap = "round";
        const a = Math.min(1, kp * 2);
        const b = Math.max(0, kp * 2 - 1);
        g.beginPath();
        g.moveTo(x + 12, y + 6);
        g.lineTo(x + 12 + 20 * a, y + 6 + 16 * a);
        if (b > 0) {
          g.moveTo(x + 32, y + 6);
          g.lineTo(x + 32 - 20 * b, y + 6 + 16 * b);
        }
        g.stroke();
        g.lineCap = "butt";
      } else label(g, win ? "WOLF" : "?", x + 22, y + 14, win ? "#7a4a00" : "#a89880", win ? 9 : 12);
    });
    // Uncertainty readout.
    const H = Math.log2(Math.max(1, alive));
    g.fillStyle = "#263a37";
    roundRect(g, 80, 148, 160, 22, 8);
    g.fill();
    label(g, alive > 1 ? `${alive} suspects left · ${H.toFixed(2)} bits` : "0 bits · it's Pip!", 160, 159, "#ffd98a", 9);
    if (reveal > 0) {
      g.save();
      g.globalAlpha = reveal;
      g.translate(254, 100);
      g.rotate(-0.22);
      g.strokeStyle = "#b02a1a";
      g.lineWidth = 2.5;
      g.strokeRect(-34, -11, 68, 22);
      label(g, "ACCUSE!", 0, 0, "#b02a1a", 12);
      g.restore();
    }
    seam(g, t, "246,236,214");
  };
}

// ---- Fireflies: dots drift in one shared flow field; the jar sweeps through them ------------

function firefliesDemo(): DemoFn {
  const N = 72;
  const GOAL = 10;
  const xs = new Float32Array(N);
  const ys = new Float32Array(N);
  const st = new Uint8Array(N); // 0 free, 1 flying to jar, 2 hidden
  const tm = new Float32Array(N);
  const ph = new Float32Array(N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  let caught = 0;
  let lastT = 99;
  const reset = () => {
    seed = 7;
    caught = 0;
    for (let i = 0; i < N; i++) {
      xs[i] = rnd() * DW;
      ys[i] = 18 + rnd() * 120;
      st[i] = 0;
      ph[i] = rnd() * 6.28;
    }
  };
  const psi = (x: number, y: number, t: number) => Math.sin(x * 0.024 + t * 0.45) * Math.cos(y * 0.032 - t * 0.3) + 0.6 * Math.sin((x + y) * 0.017 + t * 0.22);
  const jar = (t: number): [number, number] => [160 + 112 * Math.sin((2 * Math.PI * t) / PERIOD), 104 + 30 * Math.sin((4 * Math.PI * t) / PERIOD + 0.6)];
  return (g, t, dt) => {
    if (t < lastT) reset();
    lastT = t;
    const sky = g.createLinearGradient(0, 0, 0, DH);
    sky.addColorStop(0, "#0c1230");
    sky.addColorStop(1, "#1d3340");
    g.fillStyle = sky;
    g.fillRect(0, 0, DW, DH);
    // The shared field, faintly.
    g.strokeStyle = "rgba(170,220,255,0.10)";
    g.lineWidth = 1;
    for (let gx = 14; gx < DW; gx += 26) {
      for (let gy = 16; gy < 150; gy += 22) {
        const e = 2;
        const vx = (psi(gx, gy + e, t) - psi(gx, gy - e, t)) / (2 * e);
        const vy = -(psi(gx + e, gy, t) - psi(gx - e, gy, t)) / (2 * e);
        const l = Math.hypot(vx, vy) || 1;
        g.beginPath();
        g.moveTo(gx - (vx / l) * 6, gy - (vy / l) * 6);
        g.lineTo(gx + (vx / l) * 6, gy + (vy / l) * 6);
        g.stroke();
      }
    }
    // Grass.
    g.fillStyle = "#0e1f1c";
    g.beginPath();
    g.moveTo(0, DH);
    for (let x = 0; x <= DW; x += 8) g.lineTo(x, 156 - ((x * 37) % 11));
    g.lineTo(DW, DH);
    g.fill();

    const [jx, jy] = jar(t);
    for (let i = 0; i < N; i++) {
      if (st[i] === 2) {
        tm[i] -= dt;
        if (tm[i] <= 0) {
          st[i] = 0;
          xs[i] = (jx + 120 + rnd() * 80) % DW;
          ys[i] = 18 + rnd() * 120;
        }
        continue;
      }
      if (st[i] === 1) {
        tm[i] -= dt;
        xs[i] += (jx - xs[i]) * Math.min(1, dt * 12);
        ys[i] += (jy - 4 - ys[i]) * Math.min(1, dt * 12);
        if (tm[i] <= 0) {
          st[i] = 2;
          tm[i] = 2.5 + rnd() * 1.5;
        }
      } else {
        const e = 2;
        let vx = ((psi(xs[i], ys[i] + e, t) - psi(xs[i], ys[i] - e, t)) / (2 * e)) * 900;
        let vy = (-(psi(xs[i] + e, ys[i], t) - psi(xs[i] - e, ys[i], t)) / (2 * e)) * 900;
        const dx = xs[i] - jx;
        const dy = ys[i] - jy;
        const d = Math.hypot(dx, dy);
        if (d < 34 && d > 0.1) {
          vx += (dx / d) * (1 - d / 34) * 30;
          vy += (dy / d) * (1 - d / 34) * 30;
        }
        xs[i] = (xs[i] + vx * dt + DW) % DW;
        ys[i] += vy * dt;
        if (ys[i] < 14) ys[i] += 128;
        else if (ys[i] > 146) ys[i] -= 128;
        if (d < 13 && caught < GOAL) {
          st[i] = 1;
          tm[i] = 0.3;
          caught++;
        }
      }
      const blink = Math.max(0, Math.sin(t * 2.4 + psi(xs[i], ys[i], t) * 5 + ph[i] * 0.1));
      const a = 0.25 + 0.75 * blink * blink * blink;
      const rg = g.createRadialGradient(xs[i], ys[i], 0, xs[i], ys[i], 7);
      rg.addColorStop(0, `rgba(214,255,110,${0.75 * a})`);
      rg.addColorStop(1, "rgba(214,255,110,0)");
      g.fillStyle = rg;
      g.fillRect(xs[i] - 7, ys[i] - 7, 14, 14);
      g.fillStyle = `rgba(250,255,210,${0.5 + 0.5 * a})`;
      g.fillRect(xs[i] - 0.8, ys[i] - 0.8, 1.6, 1.6);
    }
    // The catcher with a glowing jar.
    const fill = caught / GOAL;
    g.fillStyle = "#2f7d74";
    g.strokeStyle = "#fff";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(jx, jy + 6, 6, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = `rgba(214,255,110,${0.15 + 0.6 * fill})`;
    g.strokeStyle = "rgba(200,230,240,0.85)";
    roundRect(g, jx + 6, jy - 8, 9, 12, 2.5);
    g.fill();
    g.stroke();
    // Counter.
    g.fillStyle = "rgba(255,250,240,0.92)";
    roundRect(g, DW - 82, 8, 74, 20, 7);
    g.fill();
    label(g, `jar ${caught} / ${GOAL}`, DW - 45, 18, "#3a2a1e", 9);
    if (caught >= GOAL) label(g, "Jar full!", 160, 40, "#e8ffb0", 13);
    seam(g, t);
  };
}

export type DemoKind = "stealth" | "tower" | "deduction" | "fireflies";

const DEMOS: Record<DemoKind, () => DemoFn> = {
  stealth: stealthDemo,
  tower: towerDemo,
  deduction: deductionDemo,
  fireflies: firefliesDemo,
};

// ---- Public building blocks --------------------------------------------------------------

/** Animated demo + three numbered rules (two columns on desktop, stacked on phones). */
export function howToPlay(opts: { demo: DemoKind; rules: string[]; tagline?: string }): HTMLElement {
  const wrap = el("div", "mgx-howto");
  const demo = el("div", "demo");
  const c = el("canvas");
  c.setAttribute("role", "img");
  c.setAttribute("aria-label", `Animated how-to-play demo. ${opts.rules.map((r) => r.replace(/<[^>]+>/g, "")).join(" ")}`);
  demo.append(c, el("div", "tagline", opts.tagline ?? "How to play"));
  const ol = el("ol");
  for (const r of opts.rules) ol.append(el("li", undefined, r));
  wrap.append(demo, ol);
  animateDemo(c, DEMOS[opts.demo]());
  return wrap;
}

/** Easy / Normal / Hard segmented control, persisted per game. */
export function difficultyPicker(opts: {
  gameId: string;
  descriptions: Record<Difficulty, string>;
  onChange?: (d: Difficulty) => void;
  onClick?: () => void;
  label?: string;
}): HTMLElement {
  const wrap = el("div", "mgx-diff");
  const row = el("div");
  row.style.cssText = "display:flex;align-items:center;flex-wrap:wrap;gap:6px";
  const seg = el("div", "mgx-seg");
  seg.setAttribute("role", "radiogroup");
  seg.setAttribute("aria-label", opts.label ?? "Difficulty");
  const desc = el("div", "desc");
  let cur = getDifficulty(opts.gameId);
  const buttons = new Map<Difficulty, HTMLButtonElement>();
  const render = () => {
    for (const [d, b] of buttons) {
      b.classList.toggle("on", d === cur);
      b.setAttribute("aria-checked", String(d === cur));
    }
    desc.innerHTML = `<b>${DIFF_ICON[cur]} ${DIFF_LABEL[cur]}:</b> ${opts.descriptions[cur]}`;
  };
  for (const d of DIFFICULTIES) {
    const b = el("button", undefined, `${DIFF_ICON[d]} ${DIFF_LABEL[d]}`);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.addEventListener("click", () => {
      b.blur();
      if (d === cur) return;
      opts.onClick?.();
      cur = d;
      setDifficulty(opts.gameId, d);
      render();
      opts.onChange?.(d);
    });
    buttons.set(d, b);
    seg.append(b);
  }
  row.append(el("span", "lbl", opts.label ?? "Difficulty"), seg);
  wrap.append(row, desc);
  render();
  return wrap;
}
