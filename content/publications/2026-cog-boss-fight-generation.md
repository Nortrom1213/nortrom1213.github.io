---
title: "Boss Fights as Spatio-Temporal Level Generation"
date: 2026-06-17
lastmod: 2026-06-17
tags: ["Procedural Content Generation","Boss Fights","2D Action Games","Spatio-Temporal Generation","Constraint Solving"]
author: ["Kaijie Xu, Clark Verbrugge (CoG 2026)"]
description: "A constrained time-expanded representation coordinates spatial navigation and evolving hazards for auditable 2D boss-fight generation."
summary: "Time-expanded boss-fight synthesis with route corridors, avatar-physics validation, survival traces, and boss-pressure diagnostics."
---

<!--more-->

##### Abstract

Boss fights are a central component of 2D action games, but procedural content generation (PCG) for them remains challenging because spatial navigation and time-evolving hazards must be coordinated together. Existing boss-oriented generators usually handle scripts, bullet patterns, or tuning in isolation, leaving holistic encounter synthesis difficult to validate and control. To address this, we formulate boss-fight generation as constrained synthesis over a shared time-expanded (x,y,t) representation in a fixed-screen, Cuphead-inspired 2D platformer simulator. Our pipeline sketches a route corridor, validates survival under avatar physics, refines a replayable survival trace, and compares it with a boss-removed scaffold. Through systematic experiments across arena scales and difficulty settings, we show that the representation exposes operating ranges, failure modes, difficulty-control behavior, and boss-pressure diagnostics, with supporting baseline and component trends. By explicitly modeling feasible player space over time, our approach provides auditable solvability checks and mechanics-aware feedback. We view this work as a practical instantiation of complex spatio-temporal level generation, offering a step toward robust, mechanics-aware combat encounter synthesis.

---

##### Citation

Xu, K., & Verbrugge, C. (2026). Boss Fights as Spatio-Temporal Level Generation. In *2026 IEEE Conference on Games (CoG)* (in press).

```BibTeX
@inproceedings{xu2026bossfighttimeexpanded,
  author    = {Kaijie Xu and Clark Verbrugge},
  title     = {Boss Fights as Spatio-Temporal Level Generation},
  booktitle = {2026 IEEE Conference on Games (CoG)},
  year      = {2026},
  organization = {IEEE}
}
```
