---
title: "Action Selection in Multiplayer Hidden-Information Games with Expected Target Entropy"
date: 2026-06-17
lastmod: 2026-06-17
tags: ["Hidden-Information Games","Game AI","Entropy","Belief States","Action Selection"]
author: ["Kaijie Xu, Fandi Meng, Clark Verbrugge, Simon Lucas (CoG 2026)"]
description: "A reusable belief-state adapter and one-step expected-target-entropy policy evaluate information-seeking action selection in multiplayer hidden-information games."
summary: "Expected-target-entropy action selection transfers well to target-identification games and exposes when task-progress costs are needed."
---

<!--more-->

##### Abstract

Hidden-information board games require agents to choose actions that reveal useful evidence under uncertainty. We study single-agent action selection under multiplayer observation mechanics in simplified environments through a reusable belief-state adapter and a one-step expected-target-entropy policy. The policy scores legal actions by how uncertain the agent expects to remain about a task target after acting, exposing information value across game-specific observation models. We evaluate simplified Clue, Sleuth, and Scotland Yard environments through systematic multi-seed experiments against random, heuristic, and observation-sampling baselines. Entropy selection reaches target identification in fewer turns in the two card games, while the hidden-movement pursuit task favors a distance heuristic. This contrast suggests that information objectives transfer most directly to target-identification games and should be paired with task-progress costs when control dominates. We extend expected-entropy action selection from single-agent deduction settings to multiplayer observation settings, motivating future agents that balance information gathering with task progress and control.

---

##### Citation

Xu, K., Meng, F., Verbrugge, C., & Lucas, S. (2026). Action Selection in Multiplayer Hidden-Information Games with Expected Target Entropy. In *2026 IEEE Conference on Games (CoG)* (in press).

```BibTeX
@inproceedings{xu2026expectedtargetentropy,
  author    = {Kaijie Xu and Fandi Meng and Clark Verbrugge and Simon Lucas},
  title     = {Action Selection in Multiplayer Hidden-Information Games with Expected Target Entropy},
  booktitle = {2026 IEEE Conference on Games (CoG)},
  year      = {2026},
  organization = {IEEE}
}
```
