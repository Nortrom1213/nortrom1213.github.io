---
title: "High Dimensional Procedural Content Generation"
date: 2026-02-21
lastmod: 2026-02-21
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

+ [Link](https://arxiv.org/abs/2602.18943)

---

##### Citation

Xu, K., & Verbrugge, C. (2026). High Dimensional Procedural Content Generation. In *Proceedings of the 21st Foundations of Digital Games Conference (FDG 2026)* (in press).

```BibTeX
@misc{xu2026highdimensionalproceduralcontentgeneration,
      title={High Dimensional Procedural Content Generation},
      author={Kaijie Xu and Clark Verbrugge},
      year={2026},
      eprint={2602.18943},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2602.18943},
}
```

