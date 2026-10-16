import { vizRoundRect, vizText, type ResultViz } from "../../ui/results";
import { bits, candidates, expectedEntropyAfter, N, type Case } from "./logic";
import { REGULARS } from "./cast";

// Result-screen picture for the Tavern Whodunit: how the hypothesis set shrank with
// each testimony, in the order the player collected them, and whether each question
// was the one an Expected-Target-Entropy look-ahead would have picked.

export interface Step {
  /** Who spoke at this step (null = before any testimony). */
  speaker: number | null;
  /** Hypotheses still consistent after this step. */
  cands: number[];
  bits: number;
  /** The entropy look-ahead's favourite question at this point (null if already certain). */
  etePick: number | null;
  matched: boolean | null;
}

export function eliminationSteps(c: Case, order: number[], metaRate: number): Step[] {
  const all = [...Array(N).keys()];
  const steps: Step[] = [{ speaker: null, cands: all, bits: bits(N), etePick: null, matched: null }];
  for (let k = 0; k < order.length; k++) {
    const before = candidates(order.slice(0, k).map((i) => c.statements[i]), c.seats);
    let etePick: number | null = null;
    let matched: boolean | null = null;
    if (before.length > 1) {
      const H = bits(before.length);
      const pending = all.filter((j) => !order.slice(0, k).includes(j));
      const gains = pending.map((j) => ({ j, gain: H - expectedEntropyAfter(j, before, c.seats, c.seed, 24, metaRate) }));
      gains.sort((a, b) => b.gain - a.gain);
      etePick = gains[0]?.j ?? null;
      const mine = gains.find((x) => x.j === order[k]);
      matched = !!mine && mine.gain >= (gains[0]?.gain ?? 0) - 1e-6;
    }
    const after = candidates(order.slice(0, k + 1).map((i) => c.statements[i]), c.seats);
    steps.push({ speaker: order[k], cands: after, bits: bits(after.length), etePick, matched });
  }
  return steps;
}

const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");
const suspectColor = (i: number) => hex(REGULARS[i].look.top ?? 0x6a5040);

export function deductionViz(c: Case, order: number[], accused: number, metaRate: number): { viz: ResultViz; steps: Step[]; matches: number; asked: number } {
  const steps = eliminationSteps(c, order, metaRate);
  const right = accused === c.culprit;
  const certainAt = steps.findIndex((s) => s.cands.length === 1);
  const judged = steps.filter((s) => s.matched !== null);
  const matches = judged.filter((s) => s.matched).length;

  const pane = {
    label: "Hypotheses left after each testimony (in the order you asked)",
    height: 218,
    draw(g: CanvasRenderingContext2D, w: number, h: number) {
      g.fillStyle = "#f6ecd6";
      g.fillRect(0, 0, w, h);
      const cols = steps.length + 1;
      const L = 8;
      const R = w - 8;
      const cw = (R - L) / cols;
      const top = 34;
      const base = h - 70;
      const maxB = bits(N);
      const X = (i: number) => L + cw * (i + 0.5);
      // Gridlines in bits.
      for (const b of [1, 2]) {
        const y = base - (b / maxB) * (base - top);
        g.strokeStyle = "rgba(58,42,30,0.12)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(L, y);
        g.lineTo(R, y);
        g.stroke();
        vizText(g, `${b} bit${b > 1 ? "s" : ""}`, R, y - 6, { size: 8, align: "right", color: "rgba(110,90,72,0.7)" });
      }
      // Solver's shortest proof.
      const proof = c.minimal.length;
      if (proof < steps.length) {
        const x = L + cw * (proof + 1);
        g.strokeStyle = "#5a6ab0";
        g.setLineDash([4, 3]);
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x, 14);
        g.lineTo(x, base);
        g.stroke();
        g.setLineDash([]);
        vizText(g, `solver's shortest proof: ${proof}`, Math.min(x + 4, R - 4), 10, { size: 9, weight: 800, color: "#5a6ab0", align: x > R - 130 ? "right" : "left" });
      }
      const bw = Math.min(34, cw * 0.55);
      steps.forEach((s, i) => {
        const x = X(i);
        const bh = (s.bits / maxB) * (base - top);
        vizRoundRect(g, x - bw / 2, base - Math.max(3, bh), bw, Math.max(3, bh), 4);
        g.fillStyle = s.cands.length === 1 ? "#d9a43a" : "#2f7d74";
        g.fill();
        vizText(g, s.cands.length === 1 ? "0" : s.bits.toFixed(2), x, base - Math.max(3, bh) - 8, { size: 9, weight: 800, color: "#3a2a1e", align: "center" });
        if (s.matched !== null) vizText(g, s.matched ? "★" : "☆", x, top - 16, { size: 12, color: s.matched ? "#d9a43a" : "rgba(110,90,72,0.5)", align: "center" });
        else if (s.speaker !== null) vizText(g, "certain", x, top - 16, { size: 8, color: "rgba(110,90,72,0.6)", align: "center" });
        // Surviving suspects as dots.
        const dr = Math.max(2, Math.min(4, cw / 14));
        for (let k = 0; k < N; k++) {
          const dx = x + (k - 2) * dr * 2.4;
          const dy = base + 12;
          g.beginPath();
          g.arc(dx, dy, dr, 0, Math.PI * 2);
          if (s.cands.includes(k)) {
            g.fillStyle = suspectColor(k);
            g.fill();
          } else {
            g.strokeStyle = "rgba(110,90,72,0.45)";
            g.lineWidth = 1;
            g.stroke();
          }
        }
        const name = s.speaker === null ? "start" : REGULARS[s.speaker].short;
        vizText(g, name, x, base + 28, { size: cw < 44 ? 8 : 10, weight: 800, color: "#3a2a1e", align: "center" });
        if (s.speaker !== null) vizText(g, `${s.cands.length} left`, x, base + 41, { size: 8, align: "center" });
      });
      // Accusation column.
      const ax = X(steps.length);
      vizText(g, right ? "✓" : "✗", ax, base - 22, { size: 26, weight: 900, color: right ? "#2f7d3a" : "#c0301c", align: "center" });
      vizText(g, "accused", ax, base + 12, { size: 8, align: "center" });
      vizText(g, REGULARS[accused].short, ax, base + 28, { size: cw < 44 ? 8 : 10, weight: 800, color: right ? "#2f7d3a" : "#c0301c", align: "center" });
      // Legend for suspects.
      let lx = L;
      for (let k = 0; k < N; k++) {
        g.fillStyle = suspectColor(k);
        g.beginPath();
        g.arc(lx + 4, h - 9, 3.5, 0, Math.PI * 2);
        g.fill();
        vizText(g, REGULARS[k].short + (k === c.culprit ? " 🐺" : ""), lx + 10, h - 9, { size: 9 });
        g.font = `700 9px Nunito, system-ui, sans-serif`;
        lx += 18 + g.measureText(REGULARS[k].short + (k === c.culprit ? " 🐺" : "")).width;
        if (lx > R - 30) break;
      }
    },
  };

  const certainTxt = certainAt > 0 ? `You were logically certain after ${certainAt} testimon${certainAt === 1 ? "y" : "ies"}` : "You accused before the testimony pinned down a single suspect";
  return {
    viz: {
      title: "How the hypotheses were eliminated",
      panes: [pane],
      legend: `<span><i style="background:#2f7d74"></i>bits of uncertainty (log₂ suspects left)</span><span>★ you asked the regular the entropy look-ahead ranked best · ☆ another choice</span><span><i style="background:#5a6ab0"></i>shortest proof found by the solver</span>`,
      caption: `CSP4SDG (AAAI 2026) treats each testimony as a constraint over the five role hypotheses — each bar is the entropy left after propagating it — and Expected Target Entropy (CoG 2026) picks the question that should shrink that entropy most. ${certainTxt}; you matched the look-ahead's pick on ${matches} of ${judged.length} question${judged.length === 1 ? "" : "s"}.`,
    },
    steps,
    matches,
    asked: order.length,
  };
}
