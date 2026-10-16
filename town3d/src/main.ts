import "./ui/styles.css";
import { loadTownData } from "./data";
import { Game } from "./core/game";
import { preload } from "./core/assets";
import { TownStage } from "./world/town";
import { LibraryStage } from "./interiors/library";
import { CafeStage } from "./interiors/cafe";
import { HallStage } from "./interiors/hall";
import { avatarPicker } from "./ui/avatarPicker";
import * as THREE from "three";
import { install as installDetails } from "./world/details";

const TIPS = [
  "Tip: press M for the Town Menu — every page is one click away.",
  "Tip: hold Shift to run, Space to jump.",
  "Tip: the town follows your local clock. Fireflies come out at night.",
  "Tip: drag to look around, scroll to zoom.",
  "Tip: Perlin the cat likes being petted.",
];

function hasWebGL2() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

async function boot() {
  const bar = document.getElementById("load-bar")!;
  if (!hasWebGL2()) {
    // No 3D support: say so briefly, then go to the classic site.
    document.querySelector(".loading-card p")!.textContent = "Your browser can't show the 3D town, so here's the classic site instead…";
    setTimeout(() => window.location.replace("/"), 1800);
    return;
  }
  const tip = document.getElementById("load-tip")!;
  tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  const setProgress = (p: number) => (bar.style.width = `${Math.round(p * 100)}%`);

  const canvas = document.getElementById("scene") as HTMLCanvasElement;
  let data;
  try {
    data = await loadTownData();
  } catch (e) {
    console.error(e);
    tip.innerHTML = `Could not load town data. <a href="/" style="color:#f7d98a">Open the classic site</a>.`;
    return;
  }
  setProgress(0.1);

  const game = new Game(canvas, data);
  const town = new TownStage();
  game.register(town);
  game.register(new LibraryStage());
  game.register(new CafeStage());
  game.register(new HallStage());
  // Mini-games are code-split and arrive in the background once the town is up.
  const minigames = import("./minigames").then((m) => m.installMinigames(game, town));
  installDetails(game, town);

  await preload(town.requiredModels(), (done, total) => setProgress(0.1 + (done / total) * 0.8));
  await game.goTo("town", "default", { fade: false });
  // Compile shaders up front so the first seconds don't stutter.
  try {
    await game.renderer.compileAsync(town.scene, game.rig.camera);
  } catch {
    /* older drivers: compile lazily */
  }
  setProgress(1);
  game.frozen = true;
  game.start();

  const loading = document.getElementById("loading")!;
  const chooser = document.getElementById("chooser")!;
  const help = document.getElementById("controls-help")!;
  help.innerHTML = game.input.isTouch
    ? "Left stick to walk · drag right side to look · <b>E</b> to interact · ☰ for the menu"
    : "<kbd>WASD</kbd> walk · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>E</kbd> interact · mouse to look (<kbd>Esc</kbd> frees it) · <kbd>M</kbd> menu";
  loading.classList.add("hidden");
  chooser.classList.remove("hidden");
  game.ui.setTouchVisible(false);
  game.input.enabled = false;
  const enter = document.getElementById("enter-town") as HTMLButtonElement;
  enter.focus();
  document.getElementById("avatar-slot")!.append(avatarPicker(game));
  // While choosing, the camera looks at the visitor's avatar from the front.
  const p0 = game.player.pos;
  const fwd = new THREE.Vector3(Math.sin(Math.PI), 0, Math.cos(Math.PI));
  let orbitT = 0;
  const orbit = (dt: number) => {
    orbitT += dt;
    const a = Math.sin(orbitT * 0.4) * 0.35;
    const dir = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    game.rig.override = {
      pos: p0.clone().addScaledVector(dir, 3.4).add(new THREE.Vector3(0, 1.55, 0)),
      look: p0.clone().add(new THREE.Vector3(0, 0.95, 0)),
    };
  };
  game.tickers.add(orbit);
  enter.addEventListener("click", () => {
    game.tickers.delete(orbit);
    game.rig.override = null;
    game.rig.snap(game.player.pos, 0);
    chooser.classList.add("hidden");
    game.audio.start();
    game.frozen = false;
    game.input.enabled = true;
    game.ui.setTouchVisible(true);
    game.started = true;
    game.ui.setHint("WASD move · Shift run · Space jump · E interact · mouse look (Esc frees it, V: drag mode) · M menu");
    game.input.lock();
    canvas.focus();
    setTimeout(() => game.ui.toast("Welcome to Xu Town! Walk up to things and press <b>E</b>."), 600);
    // Fetch every other place's models in the background so doors open instantly.
    void minigames.then(() => game.prefetchStages());
  });
  // Expose for debugging in the console.
  (window as unknown as { xuTown: Game }).xuTown = game;
  if (import.meta.env.DEV && location.search.includes("debug")) {
    // Dev only: skip the chooser and allow rendering snapshots from a hidden tab.
    enter.click();
    chooser.style.display = loading.style.display = "none";
    (window as unknown as { snap: (n?: number) => string }).snap = (n = 20) => {
      const step = (game as unknown as { frame: () => void }).frame.bind(game);
      for (let i = 0; i < n; i++) step();
      const url = game.renderer.domElement.toDataURL("image/jpeg", 0.85);
      let im = document.getElementById("dbg-snap") as HTMLImageElement | null;
      if (!im) {
        im = document.createElement("img");
        im.id = "dbg-snap";
        im.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:5;pointer-events:none";
        document.body.append(im);
      }
      im.src = url;
      return "snapped";
    };
  }
}

void boot();
