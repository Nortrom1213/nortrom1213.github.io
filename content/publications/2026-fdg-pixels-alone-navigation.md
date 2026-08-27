---
title: "How Far Can We Go with Pixels Alone? A Pilot Study on Screen-Only Navigation in Commercial 3D ARPGs"
date: 2026-02-21
lastmod: 2026-08-26
tags: ["Computer Vision","Game AI","Navigation","Visual Affordances","ARPGs"]
author: ["Kaijie Xu, Mustafa Bugti, Clark Verbrugge (FDG 2026)"]
description: "A screen-only exploration and navigation agent driven by visual affordances for Dark Souls-style linear 3D ARPG levels."
summary: "A vision-only navigation baseline for commercial 3D ARPGs using visual affordances and a simple finite-state controller."
---

<!--more-->

##### Abstract

Modern 3D game levels rely heavily on visual guidance, yet the navigability of level layouts remains difficult to quantify. Prior work either simulates play in simplified environments or analyzes static screenshots for visual affordances, but neither setting faithfully captures how players explore complex, real-world game levels. In this paper, we build on an existing open-source visual affordance detector and instantiate a screen-only exploration and navigation agent that operates purely from visual affordances. Our agent consumes live game frames, identifies salient interest points, and drives a simple finite-state controller over a minimal action space to explore Dark Souls-style linear levels and attempt to reach expected goal regions. Pilot experiments show that the agent can traverse most required segments and exhibits meaningful visual navigation behavior, but also highlight that limitations of the underlying visual model prevent truly comprehensive and reliable auto-navigation. We argue that this system provides a concrete, shared baseline and evaluation protocol for visual navigation in complex games, and we call for more attention to this necessary task. Our results suggest that purely vision-based sense-making models, with discrete single-modality inputs and without explicit reasoning, can effectively support navigation and environment understanding in idealized settings, but are unlikely to be a general solution on their own.

---

##### Links

+ [ACM Digital Library](https://dl.acm.org/doi/10.1145/3815598.3815607)

---

##### Citation

Xu, K., Bugti, M., & Verbrugge, C. (2026). How Far Can We Go with Pixels Alone? A Pilot Study on Screen-Only Navigation in Commercial 3D ARPGs. In *Proceedings of the 21st International Conference on the Foundations of Digital Games (FDG 2026)* (Article 8, pp. 1–12). ACM. https://doi.org/10.1145/3815598.3815607

```BibTeX
@inproceedings{xu2026howfarcanwegowithpixelsalone,
  author    = {Kaijie Xu and Mustafa Bugti and Clark Verbrugge},
  title     = {How Far Can We Go with Pixels Alone? A Pilot Study on Screen-Only Navigation in Commercial 3D ARPGs},
  booktitle = {Proceedings of the 21st International Conference on the Foundations of Digital Games},
  pages     = {8:1--8:12},
  publisher = {ACM},
  year      = {2026},
  doi       = {10.1145/3815598.3815607},
  url       = {https://doi.org/10.1145/3815598.3815607}
}
```

