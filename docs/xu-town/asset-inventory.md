# Xu Town Asset Inventory

Date: 2026-04-24
Version: v1
Purpose: Production inventory for the first art-upgrade pass

## Batch Order

1. Style anchors
2. Terrain and props
3. Building families
4. Characters
5. UI skin

## Folder Convention

Planned generated-source structure:

- `static/xu-town/assets/source-gpt-image-2/world/`
- `static/xu-town/assets/source-gpt-image-2/buildings/`
- `static/xu-town/assets/source-gpt-image-2/characters/`
- `static/xu-town/assets/source-gpt-image-2/ui/`

Planned processed-game structure:

- `static/xu-town/assets/world/`
- `static/xu-town/assets/buildings/`
- `static/xu-town/assets/characters/`
- `static/xu-town/assets/ui/`
- `static/xu-town/assets/fx/`

## Naming Convention

Pattern:

`xu-town_<category>_<asset-name>_<variant>_v01.png`

Examples:

- `xu-town_world_anchor-plaza_day_v01.png`
- `xu-town_building_library_facade_v01.png`
- `xu-town_character_town-chronicler_portrait_v01.png`
- `xu-town_ui_panel-library_v01.png`

## Batch 1: Style Anchors

| ID | Asset | Purpose | Target Output |
|----|-------|---------|---------------|
| A1 | World overview anchor | Lock global palette and village mood | Landscape concept |
| A2 | Plaza anchor | Lock center-of-town visual language | Landscape concept |
| A3 | Library anchor | Lock archive architecture direction | Building concept |
| A4 | Portal anchor | Lock special-effect accent direction | Building concept |
| A5 | Character family anchor | Lock sprite and portrait family | Character concept |
| A6 | UI frame anchor | Lock panel material language | UI concept |

## Batch 2: Terrain and Props

| ID | Asset | Purpose | Notes |
|----|-------|---------|-------|
| T1 | Grass base | Core ground tile | Needs readable tiling |
| T2 | Dark grass | Depth variation | Must match base palette |
| T3 | Flower grass | Accent ground | Use sparingly |
| T4 | Path stone / dirt | Main navigation path | Readable at scale |
| T5 | Plaza stone | Center square material | Cleaner than field path |
| T6 | Water surface | Pond base | Needs soft highlight treatment |
| T7 | Sand edge | Pond border transition | Should not overpower water |
| P1 | Tree family | Large environmental prop | 2-3 variants |
| P2 | Bush family | Mid-size prop | 2-3 variants |
| P3 | Flower clusters | Accent prop | Small and readable |
| P4 | Lantern / lamp | Warm light prop | Works in day and night |
| P5 | Books / archive piles | Academic prop | Reused near Library |
| P6 | Crates / barrels | Structural filler prop | Avoid clutter overload |
| P7 | Signposts / stands | Wayfinding prop | Supports branded world feel |
| P8 | Research props | Atelier filler set | For Artifact surroundings |

## Batch 3: Buildings

| ID | Asset | Purpose | Notes |
|----|-------|---------|-------|
| B1 | About sign / welcome marker | Identity anchor | Highly branded |
| B2 | Library facade | Publications destination | Most authoritative building |
| B3 | News board structure | News destination | Layered bulletin feel |
| B4 | Cafe facade | Notebook destination | Warm and social |
| B5 | Artifact facade | Gallery / prototype destination | More inventive accent |
| B6 | Portal structure | Links destination | Cool accent, restrained |

For each building family, plan these sub-assets:

- facade source
- sign source
- doorway treatment
- window treatment
- micro props

## Batch 4: Characters

| ID | Asset | Purpose | Notes |
|----|-------|---------|-------|
| C1 | Player concept | Baseline playable identity | Supports color variants |
| C2 | Verbrugge-Wizard concept | NPC identity | Scholar-mentor cue |
| C3 | Town Chronicler concept | NPC identity | Archivist cue |
| C4 | Perlin cat concept | NPC identity | Mascot cue |
| C5 | Bard of CHI concept | NPC identity | Reviewer-bard cue |
| C6 | Innkeeper Berkeley concept | NPC identity | Warm grounded cue |
| C7 | Portrait family | Dialog consistency | Match sprite family |

## Batch 5: UI

| ID | Asset | Purpose | Notes |
|----|-------|---------|-------|
| U1 | Main panel frame | Shared modal base | Paper + ink + header |
| U2 | Title bar variants | Building-category accents | Must stay in same family |
| U3 | Button family | Shared controls | World-consistent |
| U4 | Pill / filter family | Library and chips | Readable at small size |
| U5 | Portal card frame | Link panel | Slightly more special |
| U6 | Minimap frame | HUD | Simple, readable |
| U7 | Prompt / hint frame | Near prompts and overlays | Lightweight |

## Ready-to-Start Criteria

This inventory is ready for generation when:

- anchor IDs A1-A6 are prioritized
- filenames are accepted
- output folders are created
- prompt pack v1 is approved for use
