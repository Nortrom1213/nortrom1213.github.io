---
title: "CSP4SDG: Constraint and Information-Theory Based Role Identification in Social Deduction Games with LLM-Enhanced Inference"
date: 2025-11-12
lastmod: 2025-11-12
tags: ["Social Deduction Games","Artificial Intelligence","Information Theory","Constraint Satisfaction","LLMs"]
author: ["Kaijie Xu, Fandi Meng, Clark Verbrugge, Simon Lucas (AAAI 2026)"]
description: "A probabilistic, constraint-satisfaction framework with information-theoretic weighting for interpretable role inference in social deduction games."
summary: "Probabilistic constraint + information-gain scoring for real-time, interpretable role inference in SDGs."
---

<!--more-->

##### Abstract

In Social Deduction Games (SDGs) such as Avalon, Mafia, and Werewolf, players conceal their identities and deliberately mislead others, making hidden-role inference a central and demanding task. Accurate role identification, which forms the basis of an agent's belief state, is therefore the keystone for both human and AI performance. We introduce CSP4SDG, a probabilistic, constraint-satisfaction framework that analyses gameplay objectively. Game events and dialogue are mapped to four linguistically-agnostic constraint classes-evidence, phenomena, assertions, and hypotheses. Hard constraints prune impossible role assignments, while weighted soft constraints score the remainder; information-gain weighting links each hypothesis to its expected value under entropy reduction, and a simple closed-form scoring rule guarantees that truthful assertions converge to classical hard logic with minimum error. The resulting posterior over roles is fully interpretable and updates in real time. Experiments on three public datasets show that CSP4SDG (i) outperforms LLM-based baselines in every inference scenario, and (ii) boosts LLMs when supplied as an auxiliary "reasoning tool." Our study validates that principled probabilistic reasoning with information theory is a scalable alternative-or complement-to heavy-weight neural models for SDGs.

---

##### Links

+ [Link](https://arxiv.org/abs/2511.06175)

---

##### Citation

Xu, K., Meng, F., Verbrugge, C., & Lucas, S. (2026). CSP4SDG: Constraint and Information-Theory Based Role Identification in Social Deduction Games with LLM-Enhanced Inference. In *Proceedings of the AAAI Conference on Artificial Intelligence (AAAI 2026)* (in press).

```BibTeX
@misc{xu2025csp4sdgconstraintinformationtheorybased,
      title={CSP4SDG: Constraint and Information-Theory Based Role Identification in Social Deduction Games with LLM-Enhanced Inference}, 
      author={Kaijie Xu and Fandi Meng and Clark Verbrugge and Simon Lucas},
      year={2025},
      eprint={2511.06175},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2511.06175}, 
}
```


