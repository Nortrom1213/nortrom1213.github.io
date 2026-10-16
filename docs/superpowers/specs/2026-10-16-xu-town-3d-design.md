# Xu Town 3D — Design

Date: 2026-10-16. Successor to the 2D canvas Xu Town (archived at `/xu-town-2d/`).

## Decisions (confirmed with Kaijie)

| Topic | Decision |
|---|---|
| Art style | Low-poly cozy town (Animal Crossing / A Short Hike mood), soft light, warm palette |
| Camera / controls | Third-person follow. WASD/arrows move, Space jump, E interact, mouse-drag orbit, wheel zoom. Mobile: left joystick, right-side drag to look, Jump / Interact buttons |
| World theme | Academic-fantasy village (continuation of the 2D town), not tied to real places |
| Playability | Building interiors, dynamic world (day/night, weather, NPC schedules, audio), four research mini-games |
| Mini-games | Stealth guard patrol, PCG parkour tower, social-deduction puzzle, Perlin firefly coordination |
| Assets | Kenney CC0 kits (Fantasy Town 2.0, Nature, Furniture) + code-built models. Characters are code-built |
| Player avatar | Chibi Kaijie: short black hair, thin round metal glasses with pale pink lenses, black hoodie |
| NPCs | Keep the joke NPCs (Verbrugge·Wizard, Town Chronicler, Cat "Perlin", Bard of CHI, Innkeeper Berkeley) + functional mini-game NPCs |
| Games hall | In-town hall plays the Night Shift trailer; classic site has a separate Games page; same data source |
| Horror game | Not shown yet |
| Tech | Three.js + Vite + TypeScript in `town3d/`; built in GitHub Actions into `static/xu-town/` before Hugo |
| Data | Single source of truth in Hugo `data/*.yaml`; classic pages render it via shortcodes; Hugo exports `/town-data/index.json` for the game |
| Mobile | Fully playable, auto quality reduction |
| Old 2D | Archived at `/xu-town-2d/`; unused source art removed |

## World layout (outdoor, metres, +x east, +z south)

| Place | Position | Content |
|---|---|---|
| Plaza + fountain + welcome sign | (0, 0) | Spawn; sign opens About |
| Library | NW (-24, -18) | Interior: bookshelves, one book per publication, featured on lecterns |
| Notice Board | NE (20, -16) | News |
| Notebook Café | SW (-22, 18) | Interior: cork boards per conference/journal group |
| Games Hall | SE (22, 18) | Interior: cinema screen with the Night Shift trailer |
| Portal | E (34, 0) | Links (GitHub, Scholar, LinkedIn, Email, Classic site, Games) |
| The Archive (museum) | N (0, -38) | Stealth mini-game |
| PCG Tower | NE hill (32, -34) | Parkour mini-game in a generated level |
| Tavern | W (-36, 0) | Social-deduction mini-game |
| Firefly Meadow + pond | S (2, 34) | Perlin firefly mini-game (night) |

A forest ring and hills bound the play area. A Town Menu (M / button) lists every place and content panel so visitors can reach all content without walking.

## Mini-games

1. **The Archive (stealth)** — sneak through a museum at night to retrieve the survey manuscript. Guards patrol with a composite-potential-field policy (information decay + confidence + connectivity). Toggle a heat-map overlay. Caught → restart. Links to the guard-AI papers.
2. **PCG Tower (parkour)** — enter to generate a platform course from a seed. An experience graph (rest → challenge → reward beats) becomes platforms checked for jump reachability. Seed / difficulty / length sliders, regenerate, reach the flag. Links to the 3D platformer / HDPCG papers.
3. **Tavern Whodunit (social deduction)** — five villagers, one hidden werewolf. Talk to each to get a statement; some speakers lie. A constraint grid shows which role assignments remain consistent. Accuse to win. Links to CSP4SDG / Expected Target Entropy.
4. **Firefly Meadow (Perlin coordination)** — at night a swarm moves under shared Perlin-noise fields. Toggle independent-random vs Perlin-coordinated to see the difference; catch fireflies in a jar against a timer. Links to the (Perlin) Noise paper.

Progress (badges, settings) is saved in `localStorage`, wrapped in try/catch.

## Architecture

```
town3d/src/
  main.ts            boot, loading screen, chooser
  data.ts            fetch /town-data/index.json (typed)
  core/              game loop + scene manager, input, camera, physics, assets, audio, save, interact
  world/             town builder, terrain, sky/day-night, weather, buildings
  actors/            chibi character builder, avatar, NPCs
  interiors/         library, café, games hall, tavern
  minigames/         stealth, tower, deduction, fireflies
  ui/                HUD, prompts, panels, minimap, menu, touch controls, CSS
```

Each place is a `Stage` (own `THREE.Scene`, colliders, interactables, spawn, update). The game swaps stages with a fade. Physics is a custom character controller: a cylinder body against axis-aligned boxes and vertical cylinders, with gravity and landing on box tops (shared by the town and the tower).
