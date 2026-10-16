import { el } from "../../ui/ui";
import { bits, candidates, consistent, expectedEntropyAfter, LOC_NAME, LOCS, N, trueWhen, type Case, type Statement } from "./logic";
import { glossText, REGULARS, statementText } from "./cast";

// Case board: collected testimony, a 5-column hypothesis grid, and the optional
// "reasoning assist" (constraint propagation + expected entropy of each interview).

export interface BoardState {
  case: Case;
  heard: boolean[];
  assist: boolean;
  /** Hard mode turns the reasoning assist off entirely. */
  assistAllowed: boolean;
  /** Meta-statement rate of the case generator (for the entropy look-ahead model). */
  metaRate: number;
  /** Player's own marks per suspect when the assist is off: "" | "x" | "?". */
  marks: string[];
  closed: boolean;
}

export interface BoardActions {
  toggleAssist(): void;
  cycleMark(i: number): void;
  accuse(i: number): void;
  newCase(): void;
}

const nm = (i: number) => REGULARS[i].short;
const SEAT_ICON: Record<string, string> = { bar: "🍺", hearth: "🔥", window: "🪟" };
const fmt = (b: number) => b.toFixed(2).replace(/\.?0+$/, "") || "0";

let styled = false;
export function ensureStyle() {
  if (styled) return;
  styled = true;
  const s = document.createElement("style");
  s.textContent = `
  .wd-strip { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:10px; }
  .wd-sec { font-family: var(--font-head); font-size: 1.02rem; margin: 14px 0 6px; }
  .wd-stmt { border-left: 4px solid #d8c090; background: var(--paper-2); border-radius: 8px; padding: 6px 10px; margin: 5px 0; font-size: 0.9rem; }
  .wd-stmt.missing { opacity: 0.65; border-left-color: #c8c0b0; font-style: italic; }
  .wd-stmt .who { font-weight: 800; }
  .wd-stmt .gloss { font-size: 0.8rem; color: var(--ink-soft); margin-top: 2px; }
  .wd-grid-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  table.wd-grid { border-collapse: separate; border-spacing: 3px; width: 100%; min-width: 300px; font-size: 0.85rem; }
  .wd-grid th { font-weight: 800; padding: 4px 2px; text-align: center; font-size: 0.8rem; }
  .wd-grid th.row { text-align: left; white-space: nowrap; color: var(--ink-soft); }
  .wd-grid td { text-align: center; padding: 6px 0; border-radius: 6px; background: var(--paper-2); font-weight: 800; }
  .wd-grid td.ok { background: #e3f1e6; color: #2f6d3a; }
  .wd-grid td.no { background: #f6dcd6; color: #9a3424; }
  .wd-grid td.alive { background: #2f7d74; color: #fff; }
  .wd-grid td.dead { background: #ddd2c0; color: #8a7a68; }
  .wd-grid th.dead { color: #a89880; text-decoration: line-through; }
  .wd-grid button.mark { appearance:none; border:2px solid #dcc79c; background: var(--paper); border-radius: 8px; width: 100%; min-height: 34px; font-weight: 900; font-size: 1rem; cursor: pointer; color: var(--ink); }
  .wd-grid button.mark.x { background:#f6dcd6; color:#9a3424; border-color:#e0a898; }
  .wd-grid button.mark.q { background:#fff1c9; color:#8a5a00; border-color:#e8c25a; }
  .wd-bits { background: #263a37; color: #f0f7f4; border-radius: 10px; padding: 8px 12px; margin-top: 8px; font-size: 0.9rem; }
  .wd-bits b { color: #ffd98a; }
  .wd-ete { display: grid; grid-template-columns: 70px 1fr 92px; gap: 6px; align-items: center; font-size: 0.85rem; margin: 4px 0; }
  .wd-ete .bar { height: 10px; background: var(--paper-2); border-radius: 99px; overflow: hidden; }
  .wd-ete .bar i { display: block; height: 100%; background: var(--accent); border-radius: 99px; }
  .wd-ete.best { font-weight: 800; }
  .wd-note { font-size: 0.8rem; color: var(--ink-soft); margin: 4px 0; }
  .wd-chain li { margin: 4px 0; font-size: 0.9rem; }
  `;
  document.head.append(s);
}

function heardStatements(st: BoardState): Statement[] {
  return st.case.statements.filter((_, i) => st.heard[i]);
}

/** Build the case board body. */
export function boardBody(st: BoardState, act: BoardActions): HTMLElement {
  ensureStyle();
  const c = st.case;
  const wrap = el("div");
  const heard = heardStatements(st);
  const cands = candidates(heard, c.seats);

  // Case + seating strip.
  const strip = el("div", "wd-strip");
  strip.append(el("span", "tag", `Case #${(c.seed % 10000).toString().padStart(4, "0")}`));
  for (const loc of LOCS) {
    const who = c.seats.map((s, i) => (s === loc ? nm(i) : "")).filter(Boolean);
    if (who.length) strip.append(el("span", "tag", `${SEAT_ICON[loc]} ${LOC_NAME[loc]}: ${who.join(", ")}`));
  }
  wrap.append(strip);

  const controls = el("div", "mg-row");
  const assistBtn = el(
    "button",
    "btn small " + (st.assist ? "" : "secondary"),
    !st.assistAllowed ? "🧠 Assist: off on Hard" : st.assist ? "🧠 Reasoning assist: ON" : "🧠 Reasoning assist: OFF",
  );
  if (st.assistAllowed) assistBtn.addEventListener("click", () => act.toggleAssist());
  else {
    assistBtn.disabled = true;
    assistBtn.style.opacity = "0.6";
    assistBtn.title = "Hard difficulty: no constraint solver or entropy hints — reason it out yourself.";
  }
  const newBtn = el("button", "btn small secondary", "🎲 New case");
  newBtn.addEventListener("click", () => act.newCase());
  controls.append(assistBtn, newBtn);
  wrap.append(controls);

  // Testimony.
  wrap.append(el("div", "wd-sec", `Testimony (${heard.length}/${N})`));
  c.statements.forEach((s, i) => {
    if (!st.heard[i]) {
      wrap.append(el("div", "wd-stmt missing", `<span class="who">${nm(i)}</span> — not interviewed yet. Find them ${SEAT_ICON[c.seats[i]]} ${LOC_NAME[c.seats[i]].toLowerCase()}.`));
      return;
    }
    const box = el("div", "wd-stmt", `<span class="who">${nm(i)}:</span> “${statementText(s, c.seats)}”`);
    if (st.assist) {
      const g = glossText(s);
      const tw = trueWhen(s, c.seats).map(nm);
      const truth = tw.length === N ? "always" : tw.length === 0 ? "never" : `if the werewolf is ${tw.join(" / ")}`;
      box.append(el("div", "gloss", `${g ? g + " " : ""}The claim is true ${truth}. ${nm(i)} is honest unless ${nm(i)} is the werewolf.`));
    }
    wrap.append(box);
  });

  // Hypothesis grid.
  wrap.append(el("div", "wd-sec", "Hypotheses — who is the werewolf?"));
  const gw = el("div", "wd-grid-wrap");
  const table = el("table", "wd-grid");
  const head = el("tr");
  head.append(el("th", "row", ""));
  for (let h = 0; h < N; h++) {
    const th = el("th", st.assist && !cands.includes(h) ? "dead" : "", `${nm(h)}<br/><span style="font-weight:600">${SEAT_ICON[c.seats[h]]}</span>`);
    head.append(th);
  }
  table.append(head);
  if (!st.assist) {
    const tr = el("tr");
    tr.append(el("th", "row", "Your marks"));
    for (let h = 0; h < N; h++) {
      const td = el("td");
      td.style.background = "transparent";
      const m = st.marks[h];
      const b = el("button", "mark" + (m === "x" ? " x" : m === "?" ? " q" : ""), m === "x" ? "✗" : m === "?" ? "?" : "·");
      b.setAttribute("aria-label", `Mark ${nm(h)}`);
      b.addEventListener("click", () => act.cycleMark(h));
      td.append(b);
      tr.append(td);
    }
    table.append(tr);
    gw.append(table);
    wrap.append(
      gw,
      el(
        "p",
        "wd-note",
        st.assistAllowed
          ? "Tap a suspect to cross them out (✗) or flag them (?). Turn on <b>Reasoning assist</b> to watch the constraint solver eliminate hypotheses for you."
          : "Tap a suspect to cross them out (✗) or flag them (?). On Hard you are the constraint solver — the elimination chart appears after you accuse.",
      ),
    );
  } else {
    c.statements.forEach((s, i) => {
      if (!st.heard[i]) return;
      const tr = el("tr");
      tr.append(el("th", "row", `${nm(i)} says`));
      for (let h = 0; h < N; h++) {
        const ok = consistent(s, h, c.seats);
        const td = el("td", ok ? "ok" : "no", ok ? "✓" : "✗");
        td.title = ok ? `Compatible with ${nm(h)} being the werewolf` : `Rules out ${nm(h)}`;
        tr.append(td);
      }
      table.append(tr);
    });
    const tr = el("tr");
    tr.append(el("th", "row", "Possible"));
    for (let h = 0; h < N; h++) tr.append(el("td", cands.includes(h) ? "alive" : "dead", cands.includes(h) ? `${Math.round(100 / cands.length)}%` : "—"));
    table.append(tr);
    gw.append(table);
    wrap.append(gw);
    wrap.append(el("p", "wd-note", "✗ means: if that suspect were the werewolf, this testimony could not happen — an honest villager would be wrong, or the werewolf would be telling the truth."));
    const H = bits(cands.length);
    const msg =
      cands.length === 1
        ? `Only <b>${nm(cands[0])}</b> survives every constraint. Uncertainty: <b>0 bits</b>. Time to accuse!`
        : `${cands.length} hypotheses remain → uncertainty <b>log₂ ${cands.length} = ${fmt(H)} bits</b>.`;
    wrap.append(el("div", "wd-bits", msg));

    // Expected Target Entropy look-ahead.
    const pending = [...Array(N).keys()].filter((i) => !st.heard[i]);
    if (pending.length && cands.length > 1) {
      wrap.append(el("div", "wd-sec", "Who to question next?"));
      const rows = pending
        .map((j) => {
          const after = expectedEntropyAfter(j, cands, c.seats, c.seed, 24, st.metaRate);
          return { j, after, gain: Math.max(0, H - after) };
        })
        .sort((a, b) => b.gain - a.gain);
      rows.forEach((r, k) => {
        const row = el("div", "wd-ete" + (k === 0 ? " best" : ""));
        row.append(el("span", undefined, `${k === 0 ? "★ " : ""}${nm(r.j)}`));
        const bar = el("div", "bar");
        const fill = el("i");
        fill.style.width = `${Math.round((r.gain / Math.max(H, 0.01)) * 100)}%`;
        bar.append(fill);
        row.append(bar, el("span", undefined, `−${fmt(r.gain)} bits`));
        wrap.append(row);
      });
      wrap.append(el("p", "wd-note", "Expected entropy reduction of interviewing each regular, averaged over the remaining hypotheses and over what they might plausibly say under each — an <i>Expected Target Entropy</i> view of choosing your next question."));
    }
  }

  // Accuse.
  wrap.append(el("div", "wd-sec", st.closed ? "Case closed" : "Accuse a suspect"));
  if (st.closed) {
    wrap.append(el("p", "wd-note", "This case is solved (or lost). Start a new case to play again."));
  } else {
    const row = el("div", "mg-row");
    for (let h = 0; h < N; h++) {
      const b = el("button", "btn small warm", `🐺 ${nm(h)}`);
      b.addEventListener("click", () => act.accuse(h));
      row.append(b);
    }
    wrap.append(row);
  }
  return wrap;
}

/** Human-readable deduction chain for the true culprit. */
export function deductionChain(c: Case): string[] {
  const steps: string[] = [];
  const sub = c.minimal.map((i) => c.statements[i]);
  for (let h = 0; h < N; h++) {
    if (h === c.culprit) continue;
    const st = sub.find((s) => !consistent(s, h, c.seats)) ?? c.statements.find((s) => !consistent(s, h, c.seats));
    if (!st) continue;
    const q = `${nm(st.speaker)}'s “${statementText(st, c.seats)}”`;
    if (st.speaker === h) steps.push(`<b>Not ${nm(h)}:</b> as the werewolf, ${nm(h)} would have to lie — but ${q} would then be true.`);
    else steps.push(`<b>Not ${nm(h)}:</b> if ${nm(h)} were the werewolf, ${nm(st.speaker)} would be an honest villager, yet ${q} would be false.`);
  }
  const lie = c.statements[c.culprit];
  steps.push(`<b>${nm(c.culprit)} it is:</b> the only hypothesis consistent with all testimony. ${nm(c.culprit)}'s own “${statementText(lie, c.seats)}” was the lie.`);
  return steps;
}

export function chainHtml(c: Case): string {
  const used = c.minimal.map((i) => nm(i)).join(", ");
  return `<p class="wd-note">Key testimony: ${used} (${c.minimal.length} of ${N} statements are enough).</p><ol class="wd-chain">${deductionChain(c)
    .map((s) => `<li>${s}</li>`)
    .join("")}</ol>`;
}
