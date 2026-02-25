---
title: "(Perlin) Noise as AI coordinator"
date: 2026-02-21
lastmod: 2026-02-21
tags: ["Game AI","Perlin Noise","Coordination","NPCs","Procedural Generation"]
author: ["Kaijie Xu, Clark Verbrugge (FDG 2026)"]
description: "A general framework that uses continuous noise fields (e.g., Perlin noise) as a scalable coordinator for large-scale nonplayer agent control."
summary: "Noise fields as a practical AI coordinator for smooth local behavior and globally coordinated variety across space and time."
---

<!--more-->

##### Abstract

Large scale control of nonplayer agents is central to modern games, while production systems still struggle to balance several competing goals: locally smooth, natural behavior, and globally coordinated variety across space and time. Prior approaches rely on handcrafted rules or purely stochastic triggers, which either converge to mechanical synchrony or devolve into uncorrelated noise that is hard to tune. Continuous noise signals such as Perlin noise are well suited to this gap because they provide spatially and temporally coherent randomness, and they are already widely used for terrain, biomes, and other procedural assets. We adapt these signals for the first time to large scale AI control and present a general framework that treats continuous noise fields as an AI coordinator. The framework combines three layers of control: behavior parameterization for movement at the agent level, action time scheduling for when behaviors start and stop, and spawn or event type and feature generation for what appears and where. We instantiate the framework reproducibly and evaluate Perlin noise as a representative coordinator across multiple maps, scales, and seeds against random, filtered, deterministic, neighborhood constrained, and physics inspired baselines. Experiments show that coordinated noise fields provide stable activation statistics without lockstep, strong spatial coverage and regional balance, better diversity with controllable polarization, and competitive runtime. We hope this work motivates a broader exploration of coordinated noise in game AI as a practical path to combine efficiency, controllability, and quality.

---

##### Links

+ [Link](https://arxiv.org/abs/2602.18947)

---

##### Citation

Xu, K., & Verbrugge, C. (2026). (Perlin) Noise as AI coordinator. In *Proceedings of the 21st Foundations of Digital Games Conference (FDG 2026)* (in press).

```BibTeX
@misc{xu2026perlinnoiseasaicoordinator,
      title={(Perlin) Noise as AI coordinator},
      author={Kaijie Xu and Clark Verbrugge},
      year={2026},
      eprint={2602.18947},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2602.18947},
}
```

