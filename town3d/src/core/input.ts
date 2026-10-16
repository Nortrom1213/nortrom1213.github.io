// Keyboard, mouse and touch input folded into one small state object.

export type Action = "jump" | "interact" | "menu" | "map" | "cancel" | "toggleView";

export class Input {
  private keys = new Set<string>();
  private pressedActions = new Set<Action>();
  /** Accumulated look delta in pixels since the last consumeLook(). */
  private lookDX = 0;
  private lookDY = 0;
  private zoomDelta = 0;
  /** Analog stick from the touch joystick, x right, y forward, length <= 1. */
  stick = { x: 0, y: 0 };
  /** Disabled while a panel or dialogue owns the keyboard. */
  enabled = true;
  isTouch = false;
  /** Last time the player dragged the camera (ms), for auto-follow. */
  lastLookTime = 0;
  private dragging = false;
  private dragId = -1;
  private lastX = 0;
  private lastY = 0;
  /**
   * Desktop mouse style. "immersive": click captures the mouse (pointer lock), it is
   * hidden and moving it turns the camera; Esc releases it. "drag": hold and drag.
   */
  mouseMode: "immersive" | "drag" = "immersive";
  /** Called when pointer lock is gained or lost. */
  onLockChange: ((locked: boolean) => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    // Touchscreen laptops have a fine pointer too; only treat touch-first devices as touch.
    this.isTouch = matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", () => this.keys.clear());
    document.addEventListener("visibilitychange", () => this.keys.clear());
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoomDelta += Math.sign(e.deltaY);
    }, { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("pointerlockchange", () => {
      this.dragging = false;
      this.onLockChange?.(this.locked);
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.lookDX += e.movementX * 0.8;
      this.lookDY += e.movementY * 0.8;
      if (e.movementX || e.movementY) this.lastLookTime = performance.now();
    });
  }

  get locked() {
    return document.pointerLockElement === this.canvas;
  }

  /** Capture the mouse (must be called from a user gesture). Fails quietly. */
  lock() {
    if (this.isTouch || this.mouseMode !== "immersive" || this.locked) return;
    try {
      const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      r?.catch?.(() => {});
    } catch {
      /* not allowed right now */
    }
  }

  unlock() {
    if (this.locked) document.exitPointerLock();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === "escape") {
      this.pressedActions.add("cancel");
      return;
    }
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    if (!this.enabled) {
      if (!e.repeat && (k === "e" || k === "enter" || k === " ")) this.pressedActions.add("interact");
      return;
    }
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (!e.repeat) {
      if (k === " ") this.pressedActions.add("jump");
      if (k === "e" || k === "enter") this.pressedActions.add("interact");
      if (k === "m" || k === "tab") {
        e.preventDefault();
        this.pressedActions.add("menu");
      }
      if (k === "v") this.pressedActions.add("toggleView");
    }
    this.keys.add(k);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onPointerDown = (e: PointerEvent) => {
    // Touch: only the right part of the screen rotates the camera (left is the joystick).
    if (e.pointerType === "touch" && e.clientX < window.innerWidth * 0.4) return;
    if (e.pointerType === "mouse" && this.mouseMode === "immersive" && this.enabled) {
      this.lock();
      return;
    }
    this.dragging = true;
    this.dragId = e.pointerId;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging || e.pointerId !== this.dragId) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    const scale = e.pointerType === "touch" ? 1.4 : 1;
    this.lookDX += dx * scale;
    this.lookDY += dy * scale;
    if (Math.abs(dx) + Math.abs(dy) > 0) this.lastLookTime = performance.now();
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId === this.dragId) {
      this.dragging = false;
      this.dragId = -1;
    }
  };

  /** Movement intent: x right, y forward, length <= 1. */
  move(): { x: number; y: number; run: boolean; runKey: boolean } {
    if (!this.enabled) return { x: 0, y: 0, run: false, runKey: false };
    let x = 0;
    let y = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) y += 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    x += this.stick.x;
    y += this.stick.y;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    // A fully pushed touch stick runs (phones have no Shift).
    const stickRun = Math.hypot(this.stick.x, this.stick.y) > 0.93;
    const runKey = this.keys.has("shift");
    return { x, y, run: runKey || stickRun, runKey };
  }

  /** Keyboard camera turning: Q / R rotate (E is interact). */
  keyTurn(): number {
    if (!this.enabled) return 0;
    let t = 0;
    if (this.keys.has("q")) t -= 1;
    if (this.keys.has("r")) t += 1;
    return t;
  }

  consumeLook(): { dx: number; dy: number; zoom: number } {
    const out = { dx: this.lookDX, dy: this.lookDY, zoom: this.zoomDelta };
    this.lookDX = 0;
    this.lookDY = 0;
    this.zoomDelta = 0;
    return out;
  }

  /** Edge-triggered action; clears it. */
  pressed(a: Action): boolean {
    if (this.pressedActions.has(a)) {
      this.pressedActions.delete(a);
      return true;
    }
    return false;
  }

  press(a: Action) {
    this.pressedActions.add(a);
  }

  clearActions() {
    this.pressedActions.clear();
  }

  holding(key: string): boolean {
    return this.enabled && this.keys.has(key);
  }
}
