---
title: "Path2Patrol: Path-Conditioned Guard Generation in Stealth Games through MAP-Elites"
date: 2026-05-09
lastmod: 2026-05-09
tags: ["Game AI","Procedural Content Generation","Stealth Games","Quality Diversity","MAP-Elites","Guard Patrols"]
author: ["Yiwei Zhang, Kaijie Xu, Richard Zhao, Clark Verbrugge (CoG 2026)"]
description: "Path2Patrol uses MAP-Elites to generate guard patrols conditioned on a designer-specified player solution path for stealth games."
summary: "A designer-centric quality-diversity framework for generating valid, diverse, and controllable stealth-game guard patrols."
---

<!--more-->

##### Abstract

Guard patrol behaviors are critical to stealth games. However, existing procedural generation approaches largely focus on the problem of constructing a valid stealth scenario with guard behaviors rather than on creating a scenario that matches a designer's intended player solution. To address this, we propose a novel, designer-centric Path2Patrol (P2P) framework that automates the procedural generation of guard patrols through a Quality Diversity algorithm. Given a designer-specified player solution path, P2P generates reasonable patrols that guarantee the feasibility of the intended trajectory. We integrate three interpretable behavioral dimensions, Coverage, Risk, and Topological Control into MAP-Elites. Our framework not only produces valid, distinct guard patrols but also empowers designers to modulate level difficulty and restrictions via intuitive parameter tuning. Evaluations across four maps against four baselines show our method outperforms existing approaches in quality, diversity, and controllability. As an early effort to characterize player experience through guard authoring from a designer-centric viewpoint, we hope P2P inspires further exploration of experience-driven NPC behavior generation in stealth games.

---

##### Links

+ Paper coming soon.

---

##### Citation

Zhang, Y., Xu, K., Zhao, R., & Verbrugge, C. (2026). Path2Patrol: Path-Conditioned Guard Generation in Stealth Games through MAP-Elites. In *2026 IEEE Conference on Games (CoG)* (in press).

```BibTeX
@inproceedings{zhang2026path2patrol,
  author    = {Yiwei Zhang and Kaijie Xu and Richard Zhao and Clark Verbrugge},
  title     = {Path2Patrol: Path-Conditioned Guard Generation in Stealth Games through MAP-Elites},
  booktitle = {2026 IEEE Conference on Games (CoG)},
  year      = {2026},
  organization = {IEEE}
}
```

