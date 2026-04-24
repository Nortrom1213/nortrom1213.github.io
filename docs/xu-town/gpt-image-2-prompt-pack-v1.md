# Xu Town GPT Image 2 Prompt Pack v1

Date: 2026-04-24
Model target: `gpt-image-2`
Purpose: First production prompt pack for the anchor-image generation wave

## Usage Rules

- Use this pack for anchor-image generation first.
- Do not jump to full asset production until at least 3 anchor images are usable.
- Reuse accepted anchor images as references in later edits and variants.
- Favor consistency over novelty.
- Use controlled plain or lightly textured matte backgrounds when helpful for later cutout work.

## Recommended Output Settings

### Anchor environments

- `size`: `1536x1024`
- `quality`: `medium` for exploration, `high` for final picks
- `format`: `png`
- `background`: `opaque` or `auto`

### Character and UI anchors

- `size`: `1024x1024`
- `quality`: `medium` for exploration, `high` for final picks
- `format`: `png`
- `background`: `opaque` or `auto`

## Shared Direction Block

Use or adapt this block in every prompt:

`cozy academic pixel village, top-down to near top-down pixel-art game style, warm late-summer light, handcrafted wood-paper-brass material language, polished game-like finish, designed for an interactive personal website world, brand-first scholarly atmosphere, readable silhouettes, clean visual hierarchy`

## Avoid Block

Add this intent where useful:

`avoid generic fantasy RPG styling, avoid neon cyberpunk colors, avoid painterly blur, avoid excessive clutter, avoid over-detailed textures that reduce readability, avoid direct imitation of any specific commercial game`

## Prompt A1: World Overview Anchor

Generate a world anchor image for Xu Town.

`A cozy academic pixel village seen from a top-down to near top-down game viewpoint, small town square composition, warm late-summer daylight, grassy paths, archive-like library, welcoming sign area, prototype atelier hints, notebook cafe hints, subtle knowledge portal glow in the distance, handcrafted pixel-art game look, polished and readable, designed as the world-style anchor for an interactive personal website. Use wood, paper, brass, terracotta roof, moss green, parchment cream, warm lantern gold, restrained twilight-blue accents. Avoid generic fantasy village energy and avoid farm clutter overload.`

## Prompt A2: Plaza Anchor

Generate a town-center anchor for the plaza and wayfinding language.

`Top-down pixel-art town plaza for a cozy academic website game, central notice square with readable stone pattern, warm path transitions, pinned-paper bulletin design language, subtle academic signage, inviting and legible navigation space, handcrafted village materials, polished and brand-forward rather than generic. The square should feel like the social and informational center of a scholar's village.`

## Prompt A3: Library Anchor

Generate the primary architectural anchor for the library.

`Top-down pixel-art library facade for a cozy academic village, publication archive identity, terracotta roof, warm windows, ledger boxes, stacked books, subtle award and archive motifs, inviting doorway, clear signboard area, polished handcrafted pixel-art look, designed as a reusable source concept for a web-based explorable town. Readable silhouette, not crowded, authoritative but warm.`

## Prompt A4: Portal Anchor

Generate the anchor for the links portal.

`Top-down pixel-art knowledge portal structure for a scholarly village website game, gateway rather than pure magic shrine, restrained violet-blue and twilight-blue accents, graph-like or star-map geometry motifs, warm town materials around the base so it still belongs to the village, readable and elegant, slightly mysterious but not dark. Designed as a destination building in a cozy academic world.`

## Prompt A5: Character Family Anchor

Generate a character-style anchor for the player and NPC family.

`Pixel-art scholar-town character family concept sheet, top-down game readability, cozy handcrafted pixel look, clear silhouette design, one player-like scholar adventurer plus several villagers with distinct roles such as archivist, mentor, bard-like critic, innkeeper, and mascot cat, unified palette and construction logic, designed for later adaptation into consistent sprite and portrait assets for an interactive website game.`

## Prompt A6: UI Frame Anchor

Generate the anchor for world-matching modal and HUD UI.

`Pixel-art interface frame concept for a cozy academic village website game, paper panel body, ink border, wood or brass title strip, warm highlight accents, elegant but readable, tactile and handcrafted, suitable for modal windows and HUD overlays, visually consistent with a scholarly village made of wood, paper, brass, and warm light. Avoid generic desktop panel styling and avoid ornate fantasy scroll excess.`

## Optional Prompt A7: Cafe Anchor

`Top-down pixel-art reading cafe facade for a cozy scholarly village, notebook cafe identity, warm windows, wall-note and flyer atmosphere, friendly social reading space, handcrafted pixel-art finish, readable silhouette, designed as a destination building in a branded interactive website town.`

## Optional Prompt A8: Artifact Anchor

`Top-down pixel-art prototype atelier facade for a cozy academic village, workshop-lab hybrid, workbench clues, diagrams, apparatus hints, restrained cool research glow, still grounded in the town's wood-paper-brass material system, polished and readable, designed for a researcher's personal website game world.`

## Evaluation Checklist

After each generation, score the result against:

- Brand fit
- Perspective fit
- Readability
- Palette consistency
- Material consistency
- Asset usability

Reject if any of these fail badly:

- looks like a different game
- too painterly
- unreadable doors, windows, or signs
- excessive fantasy or excessive farm clutter
- weak scholarly identity

## Next-Step Rule

Once at least three anchors are strong enough:

1. save them with the agreed filename convention
2. reuse them as image references
3. generate terrain and prop batches next
