# Xu Town Style Bible

Date: 2026-04-24
Version: v1
Scope: Pre-generation visual lock for GPT Image 2 production

## Purpose

This document locks the visual rules for Xu Town before any large-scale image generation begins.

It exists to keep:

- world art consistent
- buildings in one family
- characters readable
- UI and world visually unified
- generated outputs usable for later slicing and integration

## Brand Position

Xu Town is:

- a game-like personal homepage
- a cozy academic pixel village
- a branded world for Kaijie Xu

Xu Town is not:

- a generic farm-sim clone
- a pure fantasy RPG town
- a neutral academic website skin

## Core Identity

The site should feel like a small research village where ideas have become places.

Functional mapping:

- `About` -> welcome sign / identity anchor
- `Library` -> publication archive
- `News Board` -> event and announcement plaza
- `Cafe` -> notebook cafe and study corner
- `Artifact` -> prototype atelier / research lab
- `Portal` -> external links gateway

## Visual Priorities

Priority order:

1. Personal brand clarity
2. Polished game-like finish
3. Cozy pixel-village atmosphere
4. Light whimsical charm

## Perspective and Readability

- Primary camera language: top-down to near top-down
- Assets must remain readable at small web-game scale
- Silhouettes matter more than micro-detail
- Doors, windows, signs, and interaction points must remain obvious
- Decorative detail should support function, not obscure it

## Pixel Style Rules

- Handcrafted pixel-art feel, not AI-smoothed painterly art
- Crisp blocky silhouettes
- Selective texture detail
- Controlled shadow clusters
- Warm highlight pixels, especially around windows and signs
- Minimal noisy dithering unless it improves material readability

## Palette

### Core Neutrals

- paper cream
- aged parchment
- dark ink brown
- deep wood brown
- muted stone gray

### World Colors

- moss green
- field green
- dusty path tan
- roof terracotta red
- warm lantern gold

### Accent Colors

- archive red-brown
- twilight blue
- restrained portal violet-blue
- occasional teal-blue research glow

### Usage Rules

- Keep the base world warm and grounded.
- Use cool accents only for portal, research-light, or special emphasis.
- Do not flood the world with saturated purple or blue.
- Gold should imply interaction, value, or warmth.

## Lighting

Baseline lighting:

- warm late-afternoon sunlight

Supported variants:

- dusk
- night with warm windows and lanterns

Lighting rules:

- buildings should feel cozy from light placement alone
- warm interior light should read clearly from outside
- portal glow should be distinct but not overpower the whole town
- water highlights should stay soft and readable

## Material System

Repeat these materials across world and UI:

- wood
- paper
- brass
- stone
- cloth
- warm glass

If an asset introduces a new material language, it should be rejected unless it clearly improves the whole world.

## Architecture Language

### Shared Traits

- slightly idealized village proportions
- readable front-facing signage within top-down readability constraints
- warm roof shapes
- inviting entry points
- trim and props used to imply function

### Building-Specific Motifs

`About`

- crest
- welcome marker
- identity-first framing

`Library`

- shelves
- ledgers
- archive boxes
- subtle award symbolism

`News Board`

- pinned papers
- event strips
- layered notice surfaces

`Cafe`

- reading nook
- reference sheets
- handwritten notes
- low-pressure social warmth

`Artifact`

- prototype table
- apparatus
- diagrams
- workshop-lab blend

`Portal`

- star-map geometry
- graph-like lines
- gateway energy without full fantasy excess

## Prop Language

Preferred prop families:

- books
- notes
- pinned papers
- wood crates
- lanterns
- barrels
- planters
- research boxes
- instruments
- signposts

Avoid props that would push the world into:

- medieval fantasy
- steampunk overload
- sci-fi lab sterility

## Character Rules

### Shared Rules

- readable at sprite scale
- distinct silhouettes
- clothing blocks larger than unnecessary detail
- palette harmonizes with the town
- portraits and sprites must feel like the same character family

### Player

- scholar-adventurer
- grounded and approachable
- customizable via hair and shirt color families

### NPCs

Each NPC should read from one dominant visual cue:

- elder scholar
- archivist
- mascot cat
- critic-bard
- warm innkeeper

## UI Rules

### Shared UI Grammar

- paper panel body
- ink border
- wood or brass header strip
- restrained decorative corners
- clear hierarchy and breathing room

### UI Tone

- tactile
- warm
- authored
- readable

### UI Must Avoid

- generic desktop app panels
- purely fantasy scroll UI
- ultra-flat modern web dashboard styling

## Generation Acceptance Rules

A generated image is acceptable only if:

- it matches the approved perspective
- it reads clearly at game scale
- it belongs to the same material and palette family
- it avoids generic clone energy
- it improves asset usability instead of only adding pretty detail

Reject an image if:

- it becomes painterly or blurry
- the palette drifts cold or neon
- signs, doors, or silhouettes become muddy
- the image feels like a different game than the rest of the set

## Operational Notes for GPT Image 2

- Use GPT Image 2 as the primary image-generation model.
- Use image references aggressively once a good baseline is found.
- Keep output backgrounds controlled and easy to cut because transparent backgrounds are not currently supported for `gpt-image-2`.
- Generate anchor images before generating production batches.
- Prefer medium quality for exploration and high quality for final source picks.

## First-Wave Lock Targets

The first generation wave should lock these before anything else:

- one world overview anchor
- one plaza / town-center anchor
- one library anchor
- one portal anchor
- one character-family anchor
- one UI frame anchor
