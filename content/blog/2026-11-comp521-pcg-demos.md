---
title: "Interactive PCG Demos (COMP521 Guest Lecture)"
date: 2026-11-23
description: "Six browser demos from my COMP521 guest lecture on procedural content generation: noise, cellular automata, L-systems, room templates, and MAP-Elites."
summary: "Six browser demos from my McGill COMP521 guest lecture on procedural content generation — try noise, cellular automata, L-systems, room templates, and MAP-Elites yourself."
tags: ["PCG", "Teaching", "Interactive"]
---

<style>
  .demo-list { display: grid; gap: 1rem; margin: 1.2rem 0 1.6rem; }
  .demo-card {
    border: 1px solid var(--border); border-radius: 10px; padding: .9rem 1.1rem;
  }
  .demo-card h3 { margin: 0 0 .35rem; font-size: 1.1rem; }
  .demo-card p { margin: 0 0 .6rem; }
  .demo-card .demo-meta { font-size: .8rem; color: var(--secondary); margin: 0; }
  .post-content .demo-card a.demo-open {
    display: inline-block; padding: .25rem .8rem; border-radius: 999px;
    background: var(--primary); color: var(--theme); box-shadow: none; font-size: .9rem;
  }
  .demo-note { font-size: .9rem; color: var(--secondary); }
</style>

These are the interactive demos from my guest lecture for McGill's **COMP521**, *Procedural Content Generation: From Classic Techniques to Generative AI*. Each one runs entirely in your browser: open it, change the parameters, and see what the algorithm does.

<p class="demo-note">The demos were built for a 1920×1080 projector and scale to fit your window. They work best on a desktop or laptop with a keyboard; phones and touch screens are not supported. Controls are explained on each page.</p>

<div class="demo-list">

<div class="demo-card">
  <h3>1. Type a word, get a world</h3>
  <p>Type any word: it is hashed into a seed, and fractal Perlin/simplex noise grows a 3D island from it. The same word always gives the same island.</p>
  <p class="demo-meta">Topic: noise · ~1.4 MB</p>
  <a class="demo-open" href="/demos/comp521-pcg/world.html" target="_blank" rel="noopener">Open demo ↗</a>
</div>

<div class="demo-card">
  <h3>2. Cellular-automata caves</h3>
  <p>Tune the initial wall ratio and the neighbour threshold, step the automaton one generation at a time, and flood-fill to keep the connected cave. Hover a cell to see its neighbour count.</p>
  <p class="demo-meta">Topic: cellular automata</p>
  <a class="demo-open" href="/demos/comp521-pcg/ca.html" target="_blank" rel="noopener">Open demo ↗</a>
</div>

<div class="demo-card">
  <h3>3. L-system garden</h3>
  <p>Edit the axiom, rewrite rules and turning angle and watch plants grow in real time. Plant a whole row, or start from one of eight presets.</p>
  <p class="demo-meta">Topic: grammars / L-systems</p>
  <a class="demo-open" href="/demos/comp521-pcg/garden.html" target="_blank" rel="noopener">Open demo ↗</a>
</div>

<div class="demo-card">
  <h3>4. Room-template caves</h3>
  <p>A playable level generator: a 4×4 grid of rooms, a guaranteed solution path, and hand-made room templates. Show the solution path, play the level yourself, or let a bot play it.</p>
  <p class="demo-meta">Topic: constructive generation with templates</p>
  <a class="demo-open" href="/demos/comp521-pcg/caves.html" target="_blank" rel="noopener">Open demo ↗</a>
</div>

<div class="demo-card">
  <h3>5. MAP-Elites, step by step</h3>
  <p>Watch a 6×6 MAP-Elites archive fill up. Step one iteration at a time or run continuously, adjust the mutation strength, and compare against a plain genetic algorithm.</p>
  <p class="demo-meta">Topic: quality-diversity search · ~1.5 MB</p>
  <a class="demo-open" href="/demos/comp521-pcg/mapelites.html" target="_blank" rel="noopener">Open demo ↗</a>
</div>

<div class="demo-card">
  <h3>6. Play the archive</h3>
  <p>Click any cell of a MAP-Elites archive and play that level with the keyboard, or watch a bot play it, to feel how levels change across the behaviour space.</p>
  <p class="demo-meta">Topic: quality-diversity search · ~1.5 MB</p>
  <a class="demo-open" href="/demos/comp521-pcg/play.html" target="_blank" rel="noopener">Open demo ↗</a>
</div>

</div>
