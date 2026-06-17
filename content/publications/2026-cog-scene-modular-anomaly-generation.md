---
title: "Scene-Modular LLM-Driven Procedural Level Generation for Anomaly-Detection Games"
date: 2026-06-17
lastmod: 2026-06-17
tags: ["Procedural Content Generation","Large Language Models","Anomaly-Detection Games","Level Generation","3D Environments"]
author: ["Kaijie Xu, Fandi Meng, Clark Verbrugge (CoG 2026)"]
description: "A scene-modular framework uses local open-source LLMs to generate structured, difficulty-controllable anomalies for fixed 3D environments."
summary: "Scene-modular LLM-driven anomaly generation with executable structured operations, difficulty control, and local reproducible evaluation."
---

<!--more-->

##### Abstract

Anomaly-detection games, where players traverse a fixed environment and judge whether a subtle change has occurred, represent a commercially validated genre that demands a steady supply of perceivable, well-calibrated environmental anomalies. Existing procedural generation approaches for 3D levels rely on parameterized templates or random property sampling, producing outputs with limited semantic coherence and poor difficulty calibration. We introduce a scene-modular generation framework that hierarchically decomposes a fixed 3D environment into independently addressable objects and sub-components, and directs a local open-source language model to compose anomalies as structured data operations through a context-injected prompt and iterative repair loop. This formulation supports high executability by construction while enabling fine-grained difficulty control through schema-level constraints. Evaluation across five generation methods using structural validity, multi-judge semantic quality, and portfolio diversity metrics shows that our approach achieves stronger difficulty controllability, higher semantic alignment, and the highest portfolio novelty with low redundancy among all methods. All code and evaluation run fully locally, establishing a reproducible benchmark for LLM-driven procedural anomaly generation.

---

##### Citation

Xu, K., Meng, F., & Verbrugge, C. (2026). Scene-Modular LLM-Driven Procedural Level Generation for Anomaly-Detection Games. In *2026 IEEE Conference on Games (CoG)* (in press).

```BibTeX
@inproceedings{xu2026scenemodularanomaly,
  author    = {Kaijie Xu and Fandi Meng and Clark Verbrugge},
  title     = {Scene-Modular LLM-Driven Procedural Level Generation for Anomaly-Detection Games},
  booktitle = {2026 IEEE Conference on Games (CoG)},
  year      = {2026},
  organization = {IEEE}
}
```
