---
title: "High Dimensional Procedural Content Generation"
date: 2026-02-21
lastmod: 2026-08-26
tags: ["Procedural Content Generation","Game AI","Reachability","Time-Expanded Graphs","Level Generation"]
author: ["Kaijie Xu, Clark Verbrugge (FDG 2026)"]
description: "We introduce High-Dimensional PCG (HDPCG), treating gameplay-relevant dimensions beyond geometry as first-class coordinates for controllable, verifiable generation."
summary: "A general HDPCG framework that augments geometry with gameplay dimensions (layer/time) for controllable generation and high-dimensional validation."
---

<!--more-->

##### Abstract

Procedural content generation (PCG) has made substantial progress in shaping static 2D/3D geometry, while most methods treat gameplay mechanics as auxiliary and optimize only over space. We argue that this limits controllability and expressivity, and formally introduce High-Dimensional PCG (HDPCG): a framework that elevates non-geometric gameplay dimensions to first-class coordinates of a joint state space. We instantiate HDPCG along two concrete directions. Direction-Space augments geometry with a discrete layer dimension and validates reachability in 4D (x,y,z,l), enabling unified treatment of 2.5D/3.5D mechanics such as gravity inversion and parallel-world switching. Direction-Time augments geometry with temporal dynamics via time-expanded graphs, capturing action semantics and conflict rules. For each direction, we present three general, practicable algorithms with a shared pipeline of abstract skeleton generation, controlled grounding, high-dimensional validation, and multi-metric evaluation. Large-scale experiments across diverse settings validate the integrity of our problem formulation and the effectiveness of our methods on playability, structure, style, robustness, and efficiency. Beyond quantitative results, Unity-based case studies recreate playable scenarios that accord with our metrics. We hope HDPCG encourages a shift in PCG toward general representations and the generation of gameplay-relevant dimensions beyond geometry, paving the way for controllable, verifiable, and extensible level generation.

---

##### Links

+ [ACM Digital Library](https://dl.acm.org/doi/10.1145/3815598.3815606)

---

##### Recognition

+ Honourable Mention, FDG 2026.

---

##### Citation

Xu, K., & Verbrugge, C. (2026). High Dimensional Procedural Content Generation. In *Proceedings of the 21st International Conference on the Foundations of Digital Games (FDG 2026)* (Article 7, pp. 1–16). ACM. https://doi.org/10.1145/3815598.3815606

```BibTeX
@inproceedings{xu2026highdimensionalproceduralcontentgeneration,
  author    = {Kaijie Xu and Clark Verbrugge},
  title     = {High Dimensional Procedural Content Generation},
  booktitle = {Proceedings of the 21st International Conference on the Foundations of Digital Games},
  pages     = {7:1--7:16},
  publisher = {ACM},
  year      = {2026},
  doi       = {10.1145/3815598.3815606},
  url       = {https://doi.org/10.1145/3815598.3815606}
}
```

