# Xu Town 3D

The gamified homepage served at `/xu-town/`, built with three.js, Vite and TypeScript.

- **Content** comes from Hugo at `/town-data/index.json`, which `layouts/_default/town-data.json` builds from `data/*.yaml`. The classic pages render the same YAML, so to add a paper, news item, notebook link or game you edit `data/` and nothing else.
- **Build:** GitHub Actions runs `npm ci && npm run build` here before Hugo. Output goes to `static/xu-town/`, which is git-ignored.
- **Models:** Kenney CC0 kits, in `public/models/`. Characters are built in code (`src/actors/chibi.ts`).

## Develop

```bash
hugo server --port 1313          # from the repo root: serves the data and video
npm --prefix town3d run dev      # http://localhost:5173/xu-town/  (?debug skips the intro)
```

## Layout

| Path | What |
|---|---|
| `src/core/` | Game loop, stages, physics, camera, input, audio, save |
| `src/world/` | Town layout, terrain, buildings, sky and day/night, weather |
| `src/interiors/` | Library, Notebook Café, Games Hall |
| `src/minigames/` | The Archive (stealth), PCG Tower, Tavern Whodunit, Firefly Meadow |
| `src/ui/` | HUD, panels, dialogue, touch controls |
