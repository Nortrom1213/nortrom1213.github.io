# Xu Town Art Upgrade Design

Date: 2026-04-24
Project: `Xu Town` in `static/xu-town/index.html`
Status: Approved in chat, ready for production planning

## Summary

This project upgrades the visual art direction of `Xu Town` without changing its existing functional mapping, basic map layout, or core interaction model.

The current site already has a coherent game-like structure:

- top-down explorable town
- six functional destinations
- NPC dialog
- map traversal and teleport shortcuts
- modal panels for content

The weakness is not feature coverage. The weakness is that the world is mostly procedural placeholder art drawn directly in code, which makes the experience feel like a prototype rather than a finished game-like personal homepage.

The upgrade will keep the current structure and re-skin the world into a unified `cozy academic pixel village` with a clear personal brand identity tied to Kaijie Xu's research profile.

## Goals

- Preserve existing feature mapping:
  - `About`
  - `Library`
  - `News Board`
  - `Cafe`
  - `Artifact`
  - `Portal`
- Preserve current basic world topology and building placement.
- Upgrade the site from procedural placeholder visuals to a coherent asset-driven art system.
- Make the site feel like a game-like personal homepage first, and an indie pixel game second.
- Express the owner's identity as a researcher in:
  - procedural content generation
  - game AI
  - computer vision in games
  - LLM-related research
- Build an asset pipeline that can expand later without forcing a full rewrite.

## Non-Goals

- No redesign of the site's information architecture.
- No change to the six main content destinations.
- No major change to movement, interaction, modal flow, or teleport behavior.
- No immediate rewrite of the town engine.
- No attempt to generate a full one-shot homepage image and use it as the final experience.
- No direct cloning of any existing commercial game's exact visual identity or assets.

## Current Implementation Constraints

The current implementation is a single-file interactive page at:

- `static/xu-town/index.html`

Important current traits:

- World tiles are procedurally painted in code.
- Buildings are procedurally drawn in code.
- Characters are procedurally drawn in code.
- UI panels are React overlays with inline styles.
- Site data is embedded into the page via `window.SITE_DATA`.

This means the safest upgrade path is not a full system rewrite. The safest path is staged replacement:

1. keep the existing world logic
2. replace procedural art with asset-backed rendering
3. restyle UI panels to match the new world art
4. only refactor engine structure where the asset pipeline requires it

## Creative Direction

### Core Positioning

The target experience is:

`a game-like personal homepage with a high-finish cozy pixel-town presentation`

Priority order:

1. Clearly a Kaijie Xu personal research world
2. Feels polished and game-like
3. Has some cozy rural pixel life-sim atmosphere
4. Does not become a generic fantasy village

### Visual Thesis

Xu Town should feel like a small research village where scholarship has been translated into place-making:

- papers become bookshelves and archives
- news becomes a community notice square
- notebook resources become a study cafe
- prototypes become a small invention atelier
- links become a portal hub

The art should imply:

- warm and explorable
- thoughtful and crafted
- lightly whimsical
- academically grounded

### Mood Keywords

- cozy
- scholarly
- handcrafted
- warm late-summer
- village-scale
- inviting
- research-driven
- quietly magical

### Avoid

- overly cute farm-sim imitation
- generic JRPG fantasy town
- neon cyberpunk research lab
- sterile academic website minimalism
- high-detail painterly assets that clash with top-down pixel readability

## World Art Language

### Palette Direction

Use a warm, slightly aged palette with readable contrast.

Primary material families:

- paper cream
- ink brown
- warm roof red
- muted moss green
- brass gold
- twilight blue accents

Recommended palette logic:

- ground: greens and dusty warm neutrals
- buildings: warm roofs and readable wall/body separation
- UI: paper + wood + dark ink borders
- highlights: brass gold for interactive emphasis
- magical/portal accents: restrained violet-blue, used sparingly

### Lighting Direction

Preferred baseline lighting:

- late afternoon or warm daylight for the primary identity

Secondary variants:

- dusk
- night with warm windows and fireflies

Light should emphasize:

- windows
- signboards
- portal glow
- lanterns
- important interaction affordances

### Material Language

Every asset should feel rooted in a small set of recurring materials:

- wood
- paper
- brass
- stone
- cloth
- warm glass light

These recurring materials should visually tie the world to the overlay UI.

## Building Direction

### About

Function remains the town signboard and identity anchor.

Art direction:

- hero sign or welcome kiosk
- personal crest / town emblem feel
- stronger visual framing at the town center
- acts as the emotional introduction to the site

### Library

Function remains publications.

Art direction:

- research archive rather than generic book house
- red-brown roof, warm lit windows
- stacks of books, catalog boxes, subtle awards or medallion motifs
- most authoritative building in town

### News Board

Function remains current updates.

Art direction:

- festival bulletin / campus plaza notice board
- pinned notices, layered paper, event tags
- should feel lively and temporal

### Cafe

Function remains notebook resources.

Art direction:

- reading cafe / notebook cafe
- walls suggest notes, conference flyers, reference lists
- more intimate and social than the library

### Artifact

Function remains prototype and project gallery.

Art direction:

- prototype atelier / research lab hybrid
- workbench, screens, diagrams, experiment props
- should feel slightly more inventive and future-facing than the rest of town

### Portal

Function remains external links hub.

Art direction:

- knowledge portal rather than pure magic fantasy gate
- subtle star-map or graph-like motifs
- a distinct accent color family, but still integrated into the town palette

## Character Direction

### Player Character

Requirements:

- readable top-down silhouette
- scholar-adventurer feeling
- slightly more polished than the current procedural figure
- color-customizable hair and shirt still possible

### NPCs

All NPCs should keep their existing roles, but gain stronger visual identity.

Shared requirements:

- same sprite grammar across all NPCs
- readable at small size
- matching dialogue portrait style
- roles legible from costume and posture

Specific differentiation:

- `Verbrugge-Wizard`: senior scholar, slightly arcane-academic
- `Town Chronicler`: archivist / historian
- `Cat 'Perlin'`: mascot creature, small but memorable
- `Bard of CHI`: more performative, review-energy
- `Innkeeper Berkeley`: grounded, familiar, warm

## UI Direction

### Goal

The world art and interface art must feel like one system.

### UI Material System

Use the same recurring materials as the town:

- paper body
- ink border
- wood or brass title strip
- warm highlights

### Panels

Replace the current generic pixel window treatment with:

- stronger title bars
- more refined interior padding and spacing
- subtle decorative corners or studs
- different accent tones per building category without breaking the shared system

### Buttons and Filters

Buttons should feel like in-world controls:

- tactile
- readable
- slightly chunky
- consistent across teleport controls, pills, modal actions, and cards

### Book and Card Components

The `Library`, `News`, `Notebook`, and `Portal` surfaces should all share the same underlying design grammar instead of each feeling like a separate visual mini-project.

## Asset Production Strategy

### Why GPT Image 2

Use `GPT Image 2` as the primary image generation model for source asset creation because it is the current latest GPT Image model in OpenAI documentation and is the best fit for high-quality iterative image generation.

Relevant docs:

- https://developers.openai.com/api/docs/guides/image-generation
- https://developers.openai.com/api/docs/models

Important operational constraint from current docs:

- `gpt-image-2` does not currently support transparent backgrounds

This means the pipeline must assume:

- source images may be generated on controlled matte backgrounds
- asset cutout and cleanup will be part of the local production step
- consistency must be enforced through references and iterative editing rather than expecting perfect one-shot matching across generations

### Use GPT Image 2 as an Asset Factory

Do not use GPT Image 2 to produce the final homepage as one image.

Use it for:

- style bible anchor images
- building facade concepts
- tile and prop source sheets
- portrait concepts
- UI frame concepts

Then transform outputs into:

- cleaned sprites
- cropped facades
- sliced UI components
- texture tiles

### Asset Batches

### Batch 1: Style Bible

Produce a small set of anchor images that lock:

- palette
- roof style
- wall material style
- signboard shape language
- shadow density
- window glow treatment
- portal accent treatment

Output:

- 3 to 5 environment anchor images
- 2 to 3 building close-up anchor images
- 2 UI style anchors
- 2 character style anchors

### Batch 2: Ground and Props

Produce source art for:

- grass variations
- path variations
- plaza stone
- water surface
- sand edge
- trees
- bushes
- flowers
- crates
- barrels
- signs
- lanterns
- books and research props

### Batch 3: Buildings

Produce the six functional buildings as individual asset families:

- main facade
- sign variant
- doorway treatment
- window treatment
- small decorative props

### Batch 4: Characters

Produce:

- player concept
- NPC concepts
- portrait references
- sprite sheet direction references

### Batch 5: UI Skin

Produce:

- panel frame concept
- title bar concept
- button concept
- chip / pill concept
- minimap frame concept
- portal card concept

## Prompt System

Use a three-level prompt structure.

### Level 1: Global Style Prompt

Purpose:

- defines shared style, atmosphere, materials, and brand language

### Level 2: Asset-Class Prompt

Purpose:

- narrows to buildings, props, characters, or UI

### Level 3: Specific Asset Prompt

Purpose:

- defines the exact item being generated in the batch

## Prompt Principles

- Always specify view and use case.
- Always state that the asset is for a top-down interactive web game or UI.
- Always keep the scholarly village brand language present.
- Avoid direct references to copyrighted games as a target to imitate.
- Reuse reference images aggressively.
- Prefer iterative edits after a strong base image is found.

## Prompt Seeds

These are starter directions, not final polished prompts.

### Global Style Seed

`Cozy academic pixel village, top-down pixel-art game world, warm late-summer light, handcrafted wood and paper materials, scholarly atmosphere, publication archive, prototype atelier, bulletin plaza, charming but readable, designed for an interactive personal website game.`

### Building Seed

`Top-down pixel-art building asset for a cozy academic village website, readable silhouette, warm roof materials, inviting doorway, clean signboard area, subtle scholarly props, polished indie-game finish, suitable for reuse in a small explorable town.`

### Character Seed

`Top-down pixel-art scholar-town character, strong silhouette, cozy indie game feel, readable hair and clothing blocks, suitable for four-direction walking sprite adaptation and matching dialogue portrait art.`

### UI Seed

`Pixel-art interface frame for a scholarly village website game, wood-paper-brass material language, cream paper panel body, dark ink border, warm accent bar, readable for web overlays, elegant and cozy.`

## Milestones

### M1: Style Lock

Deliverables:

- approved style bible
- approved palette and material rules
- approved building and UI direction

Exit criteria:

- there is one stable visual direction for the whole town

### M2: World Base

Deliverables:

- usable terrain and prop asset set
- world looks materially upgraded even before building replacement is complete

Exit criteria:

- ground and environmental readability exceed the current procedural baseline

### M3: Buildings

Deliverables:

- all six buildings visually upgraded
- all buildings fit the same world

Exit criteria:

- the town reads as a finished branded environment

### M4: Characters and UI

Deliverables:

- characters and portraits match the environment
- modal and HUD surfaces match the town art

Exit criteria:

- world layer and interface layer feel unified

### M5: Polish

Deliverables:

- lighting polish
- effect polish
- final cleanup

Exit criteria:

- no obvious placeholder visuals remain

## Technical Integration Plan

### Short-Term

Keep current engine behavior and replace art in place.

Refactor targets:

- tile rendering
- building rendering
- character rendering
- UI skin components

### Mid-Term

Introduce an asset manifest with:

- file path
- sprite size
- draw size
- anchor point
- interaction footprint
- optional animation metadata

### Long-Term

Split the single-file page so the world, assets, and UI can evolve independently.

This is not required before the first art pass, but the art upgrade should avoid making future modularization harder.

## Risks

### Risk 1: Style Drift

Cause:

- generating assets in isolation without a fixed style bible

Mitigation:

- create anchor images first
- reuse references for later edits
- lock palette and material language early

### Risk 2: Generic Cozy Pixel Clone Feel

Cause:

- leaning too hard on generic farm-sim cues

Mitigation:

- encode academic identity into architecture, props, naming, and UI motifs

### Risk 3: Poor Asset Usability

Cause:

- beautiful images that are hard to crop, tile, or place in-engine

Mitigation:

- generate with asset intent
- request clean silhouettes and controlled backgrounds
- cut and normalize assets before integration

### Risk 4: UI and World Mismatch

Cause:

- world assets upgraded but overlays still feel prototype-level

Mitigation:

- treat UI as a first-class asset batch, not a late afterthought

## Acceptance Criteria

The upgrade succeeds if:

- a user immediately reads the site as a game-like personal homepage
- the town feels clearly authored for Kaijie Xu rather than a generic pixel village
- the current six-destination structure remains legible
- the world no longer looks like procedural placeholder art
- UI and world art feel like one system
- the asset pipeline is reusable for future additions

## Recommended Next Step

The next execution phase should not jump straight into random image generation.

The next phase should be:

1. create a compact style bible
2. define batch order and filenames
3. write the first production prompt set for GPT Image 2
4. only then start generating anchor images
