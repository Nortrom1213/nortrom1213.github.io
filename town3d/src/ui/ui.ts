import type { Input } from "../core/input";
import { escapeHtml } from "../data";

// DOM overlay: HUD, prompts, toasts, panels, dialogue, touch controls, fades.

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export interface PanelOptions {
  title: string;
  kicker?: string;
  body: HTMLElement | string;
  wide?: boolean;
  onClose?: () => void;
}

export interface DialogueLine {
  text: string;
  choices?: { label: string; action: () => void }[];
}

export interface HudButton {
  id: string;
  label: string;
  title: string;
  onClick: () => void;
}

export class UI {
  readonly hud = el("div");
  private placeChip = el("span", "place");
  private clockChip = el("span");
  private weatherChip = el("span");
  private promptEl = el("div", "hidden");
  private toastsEl = el("div");
  private hintEl = el("div");
  private lockHint = el("div", "lock-hint hidden", "🖱️ Click to look around · <b>Esc</b> frees the mouse · <b>V</b> switches to drag mode");
  private fadeEl = el("div");
  readonly minimap = el("canvas");
  private panelLayer = el("div");
  private panelStack: PanelOptions[] = [];
  private dialogueEl = el("div", "hidden");
  private dlgWho = el("span", "who");
  private dlgRole = el("span", "role");
  private dlgText = el("div", "text");
  private dlgChoices = el("div", "choices");
  private dlgMore = el("div", "more", "▼");
  private dlgLines: DialogueLine[] = [];
  private dlgIndex = 0;
  private dlgShown = 0;
  private dlgDone: (() => void) | null = null;
  private dlgTyping = false;
  private touchEl = el("div");
  readonly buttons = el("div");
  onPromptClick: (() => void) | null = null;
  /** Mini-games can mount their own HUD cards here. */
  readonly mgLayer = el("div", "mg-hud");

  constructor(private input: Input) {
    this.hud.id = "hud";
    const top = el("div", "hud-top");
    const placeWrap = el("div", "chip");
    placeWrap.append(this.placeChip);
    const timeWrap = el("div", "chip soft");
    timeWrap.append(this.clockChip, el("span", undefined, "·"), this.weatherChip);
    this.buttons.style.display = "flex";
    this.buttons.style.gap = "6px";
    top.append(placeWrap, timeWrap, el("div", "hud-spacer"), this.buttons);
    this.minimap.id = "minimap";
    this.minimap.width = 336;
    this.minimap.height = 336;
    this.promptEl.id = "prompt";
    this.promptEl.addEventListener("click", () => this.onPromptClick?.());
    this.toastsEl.id = "toasts";
    this.hintEl.id = "hint";
    this.hud.append(top, this.minimap, this.promptEl, this.toastsEl, this.hintEl, this.mgLayer, this.lockHint);
    this.fadeEl.id = "fade";

    this.panelLayer.id = "panel-layer";
    this.panelLayer.addEventListener("pointerdown", (e) => {
      if (e.target === this.panelLayer) this.closePanel();
    });

    this.dialogueEl.id = "dialogue";
    const head = el("div");
    head.append(this.dlgWho, this.dlgRole);
    this.dialogueEl.append(head, this.dlgText, this.dlgChoices, this.dlgMore);
    this.dialogueEl.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button")) return;
      this.advanceDialogue();
    });

    this.touchEl.id = "touch";
    this.buildTouch();
    document.body.append(this.hud, this.dialogueEl, this.panelLayer, this.touchEl, this.fadeEl);
  }

  // ---- HUD -------------------------------------------------------------------

  setPlace(name: string) {
    this.placeChip.textContent = name;
  }

  setClock(clock: string, phase: string, weather: string) {
    const c = `${clock} ${phase}`;
    if (this.clockChip.textContent !== c) this.clockChip.textContent = c;
    if (this.weatherChip.textContent !== weather) this.weatherChip.textContent = weather;
  }

  setLockHint(show: boolean) {
    this.lockHint.classList.toggle("hidden", !show);
  }

  setHint(html: string) {
    this.hintEl.innerHTML = html;
  }

  addButton(b: HudButton) {
    const btn = el("button", "hud-btn", b.label);
    btn.title = b.title;
    btn.setAttribute("aria-label", b.title);
    btn.dataset.id = b.id;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      b.onClick();
      btn.blur();
    });
    this.buttons.append(btn);
    return btn;
  }

  setPrompt(text: string | null, key = "E") {
    if (!text || this.modalOpen) {
      this.promptEl.classList.add("hidden");
      return;
    }
    const k = this.input.isTouch ? "Tap" : key;
    const html = `<kbd>${k}</kbd>${escapeHtml(text)}`;
    if (this.promptEl.innerHTML !== html) this.promptEl.innerHTML = html;
    this.promptEl.classList.remove("hidden");
  }

  toast(text: string, ms = 2800) {
    const t = el("div", "toast", text);
    this.toastsEl.append(t);
    setTimeout(() => t.classList.add("out"), ms);
    setTimeout(() => t.remove(), ms + 600);
  }

  setMinimapVisible(v: boolean) {
    this.minimap.classList.toggle("hidden", !v);
  }

  async fade(on: boolean) {
    this.fadeEl.classList.toggle("on", on);
    await new Promise((r) => setTimeout(r, 360));
  }

  // ---- Panels ----------------------------------------------------------------

  get modalOpen() {
    return this.panelStack.length > 0 || !this.dialogueEl.classList.contains("hidden");
  }

  openPanel(opts: PanelOptions) {
    this.panelStack.push(opts);
    this.renderPanel();
    this.syncInput();
  }

  /** Replace the top panel (navigation inside a panel). */
  replacePanel(opts: PanelOptions) {
    this.panelStack.pop();
    this.panelStack.push(opts);
    this.renderPanel();
  }

  closePanel() {
    const top = this.panelStack.pop();
    top?.onClose?.();
    this.renderPanel();
    this.syncInput();
  }

  closeAllPanels() {
    while (this.panelStack.length) this.closePanel();
  }

  private renderPanel() {
    const opts = this.panelStack[this.panelStack.length - 1];
    // Stop any videos in the panel being removed.
    this.panelLayer.querySelectorAll("video").forEach((v) => v.pause());
    this.panelLayer.innerHTML = "";
    if (!opts) {
      this.panelLayer.classList.remove("open");
      return;
    }
    const panel = el("div", "panel" + (opts.wide ? " wide" : ""));
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", opts.title);
    const head = el("div", "panel-head");
    const titles = el("div");
    titles.style.flex = "1";
    if (opts.kicker) titles.append(el("div", "kicker", opts.kicker));
    const h = el("h2");
    h.textContent = opts.title;
    titles.append(h);
    const close = el("button", "panel-close", "✕");
    close.setAttribute("aria-label", this.panelStack.length > 1 ? "Back" : "Close");
    if (this.panelStack.length > 1) close.textContent = "←";
    close.addEventListener("click", () => this.closePanel());
    head.append(titles, close);
    const body = el("div", "panel-body");
    if (typeof opts.body === "string") body.innerHTML = opts.body;
    else body.append(opts.body);
    panel.append(head, body);
    this.panelLayer.append(panel);
    this.panelLayer.classList.add("open");
    close.focus({ preventScroll: true });
  }

  // ---- Dialogue --------------------------------------------------------------

  dialogue(who: string, role: string, lines: (string | DialogueLine)[], onDone?: () => void) {
    this.dlgWho.textContent = who;
    this.dlgRole.textContent = role;
    this.dlgLines = lines.map((l) => (typeof l === "string" ? { text: l } : l));
    this.dlgIndex = 0;
    this.dlgDone = onDone ?? null;
    this.dialogueEl.classList.remove("hidden");
    this.showLine();
    this.syncInput();
  }

  private showLine() {
    this.dlgShown = 0;
    this.dlgTyping = true;
    this.dlgText.textContent = "";
    this.dlgChoices.innerHTML = "";
    this.dlgMore.style.display = "none";
  }

  private finishLine() {
    const line = this.dlgLines[this.dlgIndex];
    this.dlgTyping = false;
    this.dlgText.textContent = line.text;
    this.dlgChoices.innerHTML = "";
    if (line.choices) {
      for (const c of line.choices) {
        const b = el("button", "btn small secondary", c.label);
        b.addEventListener("click", () => {
          // Hide first, run the action (it may open a panel or another dialogue),
          // then settle input state once.
          this.dialogueEl.classList.add("hidden");
          this.dlgDone = null;
          c.action();
          this.syncInput();
        });
        this.dlgChoices.append(b);
      }
      this.dlgMore.style.display = "none";
    } else {
      this.dlgMore.style.display = "block";
    }
  }

  advanceDialogue() {
    if (this.dialogueEl.classList.contains("hidden")) return;
    if (this.dlgTyping) {
      this.finishLine();
      return;
    }
    if (this.dlgLines[this.dlgIndex].choices) return;
    this.dlgIndex++;
    if (this.dlgIndex >= this.dlgLines.length) this.closeDialogue(true);
    else this.showLine();
  }

  closeDialogue(runDone: boolean) {
    this.dialogueEl.classList.add("hidden");
    const done = this.dlgDone;
    this.dlgDone = null;
    this.syncInput();
    if (runDone) done?.();
  }

  get dialogueOpen() {
    return !this.dialogueEl.classList.contains("hidden");
  }

  /** Per-frame: typewriter and keyboard handling for dialogue/panels. */
  update(dt: number) {
    if (this.dialogueOpen && this.dlgTyping) {
      const line = this.dlgLines[this.dlgIndex];
      this.dlgShown += dt * 55;
      const n = Math.min(line.text.length, Math.floor(this.dlgShown));
      this.dlgText.textContent = line.text.slice(0, n);
      if (n >= line.text.length) this.finishLine();
    }
    if (this.input.pressed("cancel")) {
      if (this.panelStack.length) this.closePanel();
      else if (this.dialogueOpen) this.closeDialogue(false);
      else this.onCancel?.();
    }
    if (this.dialogueOpen && this.input.pressed("interact")) this.advanceDialogue();
  }

  onCancel: (() => void) | null = null;

  /** Fired when the last panel/dialogue closes (used to re-capture the mouse). */
  onModalClosed: (() => void) | null = null;

  /** The mouse was captured when a panel opened; capture it again on close. */
  private relock = false;

  private syncInput() {
    const wasEnabled = this.input.enabled;
    this.input.enabled = !this.modalOpen;
    if (!this.modalOpen) this.input.clearActions();
    if (this.modalOpen) {
      if (this.input.locked) this.relock = true;
      this.input.unlock();
    } else if (!wasEnabled) {
      if (this.relock) this.input.lock();
      this.relock = false;
      this.onModalClosed?.();
    }
    if (this.modalOpen) {
      this.promptEl.classList.add("hidden");
      this.input.stick.x = this.input.stick.y = 0;
    }
  }

  // ---- Touch -----------------------------------------------------------------

  private buildTouch() {
    const joy = el("div", "joy");
    const knob = el("div", "knob");
    joy.append(knob);
    let id = -1;
    let cx = 0;
    let cy = 0;
    const R = 52;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.input.stick.x = dx / R;
      this.input.stick.y = -dy / R;
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      knob.style.transform = "";
      this.input.stick.x = this.input.stick.y = 0;
    };
    joy.addEventListener("pointerdown", (e) => {
      id = e.pointerId;
      const r = joy.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      joy.setPointerCapture(e.pointerId);
      move(e);
    });
    joy.addEventListener("pointermove", move);
    joy.addEventListener("pointerup", end);
    joy.addEventListener("pointercancel", end);

    const jump = el("button", "tbtn jump", "Jump");
    jump.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.input.press("jump");
    });
    const act = el("button", "tbtn act", "E");
    act.setAttribute("aria-label", "Interact");
    act.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.input.press("interact");
    });
    this.touchEl.append(joy, jump, act);
    this.touchEl.classList.toggle("hidden", !this.input.isTouch);
  }

  setTouchVisible(v: boolean) {
    this.touchEl.classList.toggle("hidden", !v || !this.input.isTouch);
  }
}

export { el };
