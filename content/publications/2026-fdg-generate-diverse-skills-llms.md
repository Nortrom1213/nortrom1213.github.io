---
title: "Generate Diverse Skills with Large Language Models"
date: 2026-05-09
lastmod: 2026-05-09
tags: ["Procedural Content Generation","Large Language Models","Game AI","Roguelike","Auto-battler","Skill Generation"]
author: ["Kaijie Xu, Clark Verbrugge (FDG 2026 PCG Workshop)"]
description: "Neural Spore Genesis evaluates local open-weight LLMs for generating coherent and diverse auto-battler combat skills from spatial elemental layouts."
summary: "A browser-based roguelike auto-battler and evaluation framework for intent-aware procedural skill generation with local LLMs."
---

<!--more-->

##### Abstract

Roguelike and auto-battler games derive much of their replayability from randomized progression, rewards, and encounter sequencing, yet this randomness rarely extends to genuinely diverse game mechanics and content such as skills or combat units. Existing procedural systems for such content usually depend on fixed rule spaces, hand-authored templates, or proxy spell engines, which limit their ability to produce outputs that are semantically meaningful, valuable in play, and sufficiently expressive. We present Neural Spore Genesis, a browser-based roguelike auto-battler in which players buy elemental cells, arrange them on a 5-by-5 grid, and compile that spatial layout into a combat skill for auto-battle. To support this task, we build a high-expressivity structured skill framework covering a broad range of 2D auto-battler combat behaviors, and evaluate local open-weight language models against deterministic, template-based, random, and calibrated sampler baselines. Across 6 generator conditions and a 105-configuration corpus evaluated with 11 metrics, local LLMs achieve near-perfect element coherence while maintaining high intra-config diversity, a combination the baselines do not match. This work offers a practical evaluation environment for intent-aware procedural mechanic generation and supports future research on semantically grounded content systems for high randomness games.

---

##### Links

+ Paper coming soon.

---

##### Citation

Xu, K., & Verbrugge, C. (2026). Generate Diverse Skills with Large Language Models. In *Proceedings of the 17th Workshop on Procedural Content Generation (PCG 2026)* (in press).

```BibTeX
@inproceedings{xu2026generatediverseskills,
  author    = {Kaijie Xu and Clark Verbrugge},
  title     = {Generate Diverse Skills with Large Language Models},
  booktitle = {Proceedings of the 17th Workshop on Procedural Content Generation (PCG 2026)},
  year      = {2026}
}
```

