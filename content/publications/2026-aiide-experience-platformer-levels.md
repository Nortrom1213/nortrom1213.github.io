---
title: "From Experience to 3D Platformer Levels via Topological Graphs"
date: 2026-08-26
lastmod: 2026-08-26
tags: ["Procedural Content Generation","Game AI","3D Platformers","Topological Graphs","Experience-Driven Generation"]
author: ["Kaijie Xu, Clark Verbrugge (AIIDE 2026)"]
description: "An Experience Topological Graph pipeline for controllable 3D platformer level generation with topology-aware validation."
summary: "Topology-aware 3D platformer level generation using Experience Topological Graphs and local validation."
---

<!--more-->

##### Status

Accepted at the 22nd AAAI Conference on Artificial Intelligence and Interactive Digital Entertainment (AIIDE 2026).

---

##### Abstract

Research on 3D game level generation remains limited, especially for methods that combine structure and topological constraints on playability during spatial realization. We address this gap by introducing the Experience Topological Graph (ETG), a compact representation of progression order, branching, and gating semantics, and by building an ETG-to-level generation pipeline grounded in a five-dimensional state model (3D space, time, and progression phase). The pipeline integrates incremental construction with a local topological validator to check progression consistency, prevent unintended shortcuts, and maintain experience-level structural fidelity during generation. We evaluate the approach in a Mario-like 3D platformer simulation under strict topology validation and compare against constructive, lane-based, evolutionary, and constraint-programming baselines in a multi-scale benchmark. Results show that the proposed method achieves the highest playability, controllability, and topology scores in our benchmark, while remaining competitive on pacing variation. An additional case study in a Fall Guys Simulation environment shows that our framework can be adapted to a distinct 3D platformer-like obstacle-course domain. These results support topology-aware experience modeling as a practical approach to controllable 3D level generation while highlighting remaining challenges in robust 3D PCG.

---

##### Links

+ Paper coming soon.

---

##### Citation

Xu, K., & Verbrugge, C. (2026). From Experience to 3D Platformer Levels via Topological Graphs. In *Proceedings of the AAAI Conference on Artificial Intelligence and Interactive Digital Entertainment (AIIDE 2026)* (accepted).

```BibTeX
@inproceedings{xu2026fromexperience,
  author    = {Kaijie Xu and Clark Verbrugge},
  title     = {From Experience to 3D Platformer Levels via Topological Graphs},
  booktitle = {Proceedings of the AAAI Conference on Artificial Intelligence and Interactive Digital Entertainment},
  year      = {2026}
}
```
