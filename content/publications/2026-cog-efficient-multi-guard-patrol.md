---
title: "Efficient Multi-Guard Patrol through Extended Composite Potential Fields"
date: 2026-06-17
lastmod: 2026-06-17
tags: ["Game AI","Stealth Games","Guard Patrols","Potential Fields","Multi-Agent Coordination"]
author: ["Kaijie Xu, Yiwei Zhang, Clark Verbrugge (CoG 2026)"]
description: "Three modular CPF extensions improve real-time efficiency, spatial coordination, and area coverage for multi-guard stealth patrols."
summary: "Lazy Field Evaluation, Voronoi Territorial Coordination, and Shared Novelty Patrol extend CPF for efficient coordinated stealth-game guard patrols."
---

<!--more-->

##### Abstract

Stealth games depend on believable guard patrol behavior that balances pursuit, area coverage, and multi-guard coordination under real-time constraints. Composite Potential Fields (CPF) provide an interpretable, training-free approach combining information tracking, patrol belief, and topological awareness, but suffer from per-tick computational overhead, lack of spatial coordination among guards, and absence of temporal coverage incentives. We propose three modular extensions addressing these limitations separately: Lazy Field Evaluation eliminates per-tick global computation through deferred decay with provable behavioral equivalence; Voronoi Territorial Coordination creates implicit spatial separation via map partitioning; and Shared Novelty Patrol encourages systematic coverage through lightweight shared visit memory. The ablation study across five maps and two scenarios confirms that all three extensions compose without interference, collectively improving computational efficiency, patrol distribution, and area coverage over both CPF and classical baselines.

---

##### Citation

Xu, K., Zhang, Y., & Verbrugge, C. (2026). Efficient Multi-Guard Patrol through Extended Composite Potential Fields. In *2026 IEEE Conference on Games (CoG)* (in press).

```BibTeX
@inproceedings{xu2026efficientmultiguardpatrol,
  author    = {Kaijie Xu and Yiwei Zhang and Clark Verbrugge},
  title     = {Efficient Multi-Guard Patrol through Extended Composite Potential Fields},
  booktitle = {2026 IEEE Conference on Games (CoG)},
  year      = {2026},
  organization = {IEEE}
}
```
