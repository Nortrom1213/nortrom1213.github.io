import * as THREE from "three";
import type { Game } from "../../core/game";
import { preload, type Kit } from "../../core/assets";
import type { TownStage } from "../town";
import { radialTexture } from "../town";
import { buildDecor } from "./decor";
import { ducks } from "./ducks";
import { fun } from "./fun";
import { loadJSON, saveJSON, type Ctx, type SpotOptions } from "./kit";
import { Poser } from "./poser";
import { props } from "./props";
import { Synth } from "./sound";

// Building-specific decorations and small interactions around town.
// Everything is built lazily on the first town frame (after the town itself and
// our extra models are loaded) and lives under one group in the town scene.

const MODELS: [Kit, string][] = [
  ["town", "stall"],
  ["town", "stall-green"],
  ["nature", "pot_small"],
  ["nature", "plant_bushSmall"],
  ["nature", "log_stack"],
  ["nature", "statue_obelisk"],
  ["nature", "flower_redA"],
  ["nature", "flower_yellowA"],
  ["nature", "flower_purpleA"],
  ["nature", "flower_yellowB"],
];

const FOUND_KEY = "xutown.details.found";

type Tick = (dt: number, t: number) => void;

export function install(game: Game, town: TownStage) {
  let ready = false;
  let built = false;
  const ticks: Tick[] = [];
  void preload(MODELS).then(() => (ready = true));
  town.systems.add({
    update(dt, t) {
      if (!built) {
        if (!ready || !town.game) return;
        built = true;
        build(game, town, ticks);
      }
      for (let i = 0; i < ticks.length; i++) {
        try {
          ticks[i](dt, t);
        } catch (e) {
          console.error("[details] tick failed, disabling it", e);
          ticks.splice(i--, 1);
        }
      }
    },
  });
}

function build(game: Game, town: TownStage, ticks: Tick[]) {
  const root = new THREE.Group();
  root.name = "town-details";
  town.scene.add(root);

  const found = new Set(loadJSON<string[]>(FOUND_KEY, []));
  const known = new Map<string, string>();
  const month = new Date().getMonth();
  const season: Ctx["season"] = month >= 2 && month <= 4 ? "spring" : month >= 5 && month <= 7 ? "summer" : month >= 8 && month <= 10 ? "autumn" : "winter";

  const discover = (id: string, label: string) => {
    if (found.has(id)) return;
    found.add(id);
    saveJSON(FOUND_KEY, [...found]);
    const n = [...found].filter((k) => known.has(k)).length;
    setTimeout(() => game.ui.toast(`✨ Discovery <b>${n}/${known.size}</b>: ${label}`, 3200), 1400);
  };

  const ctx: Ctx = {
    game,
    town,
    root,
    synth: new Synth(game),
    glowTex: radialTexture(),
    autumn: season === "autumn",
    season,
    every: (fn) => ticks.push(fn),
    spot: (o: SpotOptions) => {
      const did = o.discoveryId ?? o.id;
      if (o.discovery && !known.has(did)) known.set(did, o.discovery);
      return town.addInteractable({
        id: `detail-${o.id}`,
        pos: new THREE.Vector3(o.x, o.y ?? 0, o.z),
        radius: o.radius ?? 1.8,
        label: o.label,
        markerHeight: o.marker ?? 1.8,
        enabled: o.enabled,
        onInteract: () => {
          o.onInteract();
          if (o.discovery) discover(did, o.discovery);
        },
      });
    },
    discover,
    solidCyl: (x, z, r, h = 1) => {
      town.world.addCylinder(x, z, r, 0, h);
    },
    solidBox: (x, z, sx, sz, h = 1, y0 = 0) => {
      // Low props should not pull the camera in.
      town.world.addBox(x, z, sx, sz, y0, h, { noCamera: h < 3 });
    },
    night: () => game.sky.night,
    player: () => game.player.pos,
    say: (html, ms = 2800) => game.ui.toast(html, ms),
    cycle: (lines) => {
      let i = 0;
      return () => lines[i++ % lines.length];
    },
  };

  const step = (name: string, fn: () => void) => {
    try {
      fn();
    } catch (e) {
      console.error(`[details] ${name} failed`, e);
    }
  };
  step("decor", () => buildDecor(ctx));
  const poser = new Poser(ctx);
  step("props", () => props(ctx, poser));
  step("ducks", () => ducks(ctx));
  step("fun", () => fun(ctx));
}
