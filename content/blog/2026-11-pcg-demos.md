---
title: "Interactive PCG Demos"
date: 2026-11-23
description: "Six browser demos of procedural content generation: noise, cellular automata, L-systems, room templates, and MAP-Elites."
summary: "Six browser demos of procedural content generation: noise, cellular automata, L-systems, room templates, and MAP-Elites."
tags: ["PCG", "Interactive"]
aliases: ["/blog/2026-11-comp521-pcg-demos/"]
---

<style>
  .demo-list { display: grid; gap: 1rem; margin: 1.2rem 0 1.6rem; }
  .demo-card { border: 1px solid var(--border); border-radius: 10px; padding: .9rem 1.1rem; }
  .demo-card h3 { margin: 0 0 .35rem; font-size: 1.1rem; }
  .demo-card p { margin: 0 0 .6rem; }
  .post-content .demo-card a.demo-open {
    display: inline-block; padding: .25rem .8rem; border-radius: 999px;
    background: var(--primary); color: var(--theme); box-shadow: none; font-size: .9rem;
  }
</style>

Six small demos of classic procedural content generation techniques. Each one runs in your browser: change the parameters and watch the algorithm work.

<div class="demo-list">

<div class="demo-card">
  <h3>Type a word, get a world</h3>
  <p>Any word is hashed into a seed, and fractal noise grows a 3D island from it. The same word always gives the same island.</p>
  <a class="demo-open" href="/demos/pcg/world.html" target="_blank" rel="noopener">Open demo ↗</a>
</div>

<div class="demo-card">
  <h3>Cellular-automata caves</h3>
  <p>Set the initial wall ratio and neighbour threshold, step the automaton generation by generation, and flood-fill to keep the connected cave.</p>
  <a class="demo-open" href="/demos/pcg/ca.html" target="_blank" rel="noopener">Open demo ↗</a>
</div>

<div class="demo-card">
  <h3>L-system garden</h3>
  <p>Edit the axiom, rewrite rules and angle, and watch plants grow in real time.</p>
  <a class="demo-open" href="/demos/pcg/garden.html" target="_blank" rel="noopener">Open demo ↗</a>
</div>

<div class="demo-card">
  <h3>Room-template caves</h3>
  <p>A grid of rooms, a guaranteed solution path, and hand-made room templates make a playable level. Play it yourself or let a bot play.</p>
  <a class="demo-open" href="/demos/pcg/caves.html" target="_blank" rel="noopener">Open demo ↗</a>
</div>

<div class="demo-card">
  <h3>MAP-Elites, step by step</h3>
  <p>Watch a MAP-Elites archive fill up one iteration at a time, and compare it with a plain genetic algorithm.</p>
  <a class="demo-open" href="/demos/pcg/mapelites.html" target="_blank" rel="noopener">Open demo ↗</a>
</div>

<div class="demo-card">
  <h3>Play the archive</h3>
  <p>Pick any cell of a MAP-Elites archive and play that level, or watch a bot play it.</p>
  <a class="demo-open" href="/demos/pcg/play.html" target="_blank" rel="noopener">Open demo ↗</a>
</div>

</div>
