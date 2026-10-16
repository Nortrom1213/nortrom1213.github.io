import * as THREE from "three";
import { buildSign } from "../buildings";
import { POI } from "../layout";
import { Baker, findClear, plaque, shuffler, textTexture, type Ctx } from "./kit";
import type { Poser } from "./poser";
import { LEAF_CANDIDATES, S, TELESCOPE_CANDIDATES } from "./spots";

// Small delights you can walk up to: benches, a bell, plaques with academic jokes,
// a knock-knock windmill, an echoing well, a mailbox, a telescope and a leaf pile.

const STONE = 0xb8b0a2;
const STONE_D = 0x8f887c;
const WOOD = 0x8a5a34;
const WOOD_D = 0x5e3a20;
const IRON = 0x3a3a40;

export function props(ctx: Ctx, poser: Poser) {
  benches(ctx, poser);
  bell(ctx);
  plaques(ctx);
  windmill(ctx);
  well(ctx);
  mailbox(ctx);
  telescope(ctx, poser);
  leafPile(ctx);
}

// ---- Benches ------------------------------------------------------------------------

function benches(ctx: Ctx, poser: Poser) {
  const thoughts = shuffler([
    "Maybe the related-work section can wait five minutes.",
    "Every dungeon is just a graph that believes in itself.",
    "If I squint, the fountain looks like a loss curve. Going down. Nice.",
    "One more experiment. Then fireflies.",
    "Somewhere, a reviewer is reading my paper right now. Breathe.",
    "What if the level designs the player? …No. Maybe. Write that down.",
    "Note to self: back up the thesis. Again.",
    "The cat has better work-life balance than me.",
  ]);
  const seats = [
    { id: "lib", s: S.libBench, label: "Sit on the reading bench" },
    { id: "tav", s: S.tavBench, label: "Sit on the tavern bench" },
  ];
  for (const { id, s, label } of seats) {
    const fx = Math.sin(s.yaw);
    const fz = Math.cos(s.yaw);
    ctx.spot({
      id: `bench-${id}`,
      x: s.x + fx * 0.55,
      z: s.z + fz * 0.55,
      radius: 1.7,
      marker: 1.3,
      label,
      discovery: "Took a seat",
      discoveryId: "bench",
      enabled: () => !poser.busy,
      onInteract: () => poser.sit({ x: s.x, z: s.z, yaw: s.yaw }, thoughts()),
    });
  }
}

// ---- Archive bell ------------------------------------------------------------------------

function bell(ctx: Ctx) {
  const { x, z } = S.bell;
  const b = new Baker();
  for (const sx of [-0.85, 0.85]) {
    b.box(0.2, 2.9, 0.2, WOOD_D, x + sx, 1.45, z);
    b.box(0.4, 0.15, 0.4, STONE_D, x + sx, 0.075, z);
  }
  b.box(2.1, 0.2, 0.26, WOOD, x, 2.95, z);
  b.prism(2.5, 0.6, 0.7, 0x4a72b0, x, 3.05, z);
  ctx.root.add(b.build());
  ctx.solidCyl(x - 0.85, z, 0.2, 3);
  ctx.solidCyl(x + 0.85, z, 0.2, 3);

  const bb = new Baker();
  bb.cyl(0.16, 0.4, 0.55, 10, 0xb8862e, 0, -0.38, 0);
  bb.cyl(0.4, 0.44, 0.08, 10, 0xa8762a, 0, -0.66, 0);
  bb.sphere(0.12, 0xb8862e, 0, -0.1, 0);
  bb.box(0.06, 0.16, 0.06, IRON, 0, -0.02, 0);
  bb.sphere(0.07, IRON, 0, -0.72, 0);
  bb.box(0.02, 1.2, 0.02, 0xd8c8a0, 0.0, -1.3, 0);
  const bellMesh = bb.build();
  const pivot = new THREE.Group();
  pivot.position.set(x, 2.84, z);
  pivot.add(bellMesh);
  ctx.root.add(pivot);
  let swing = 0;
  let phase = 0;
  ctx.every((dt) => {
    swing *= Math.exp(-dt * 0.6);
    phase += dt * 3.2;
    pivot.rotation.x = Math.sin(phase) * swing;
  });
  const day = ctx.cycle([
    "DONG. Somewhere, a deadline moves one hour closer.",
    "DONG. The pigeons file a noise complaint.",
    "DONG. That was the “submissions closed” bell. Just kidding. Probably.",
    "DONG. The Archive's librarians pretend not to notice.",
  ]);
  ctx.spot({
    id: "bell",
    x,
    z: z + 0.8,
    radius: 2.0,
    marker: 2.2,
    label: "Ring the old bell",
    discovery: "Rang the Archive bell",
    onInteract: () => {
      swing = 0.55;
      phase = 0;
      ctx.synth.bell(ctx.night() > 0.6 ? 174 : 196);
      ctx.say(`🔔 ${ctx.night() > 0.6 ? "DONG. Inside The Archive, a guard's confidence map flickers. Maybe don't do that mid-heist." : day()}`, 3600);
    },
  });
}

// ---- Plaques, stones, notices -------------------------------------------------------------

function plaques(ctx: Ctx) {
  const ui = ctx.game.ui;

  // Library plaque (mesh lives in decor).
  ctx.spot({
    id: "lib-plaque",
    x: S.libPlaque.x,
    z: S.libPlaque.z,
    radius: 1.6,
    marker: 2.5,
    label: "Read the brass plaque",
    discovery: "Read the Library plaque",
    onInteract: () => ui.dialogue("Brass Plaque", "Library", ["LIBRARY · Est. 2024.", "Late fees are payable in citations. Self-citations accepted at half value."]),
  });

  // Weathered stone near The Archive.
  const rs = S.reviewerStone;
  const b = new Baker();
  b.at(rs.x, 0, rs.z, -0.3, () => {
    b.box(0.95, 1.0, 0.3, STONE, 0, 0.5, 0, 0, 0, 0.04);
    b.cyl(0.475, 0.475, 0.3, 10, STONE, 0, 1.0, 0, Math.PI / 2, 0, 0.04);
    b.box(1.2, 0.12, 0.5, STONE_D, 0, 0.06, 0);
    b.blob(0.18, 0x5a9a4a, 0.4, 0.1, 0.2, 1.3, 0.6, 1);
    b.blob(0.14, 0x4f8f45, -0.45, 0.08, 0.18, 1.2, 0.6, 1);
  });
  ctx.root.add(b.build());
  const face = plaque(0.7, 0.55, textTexture(["R.I.P.", "“Have the authors", "considered…?”"], { w: 256, h: 200, bg: "#a8a092", fg: "#3a352c", sizes: [44, 22, 22] }), STONE_D, 0.02);
  face.position.set(rs.x + Math.sin(-0.3) * 0.17, 0.75, rs.z + Math.cos(-0.3) * 0.17);
  face.rotation.y = -0.3;
  ctx.root.add(face);
  ctx.solidCyl(rs.x, rs.z, 0.55, 1.4);
  ctx.spot({
    id: "reviewer-stone",
    x: rs.x,
    z: rs.z + 0.9,
    radius: 1.8,
    marker: 1.8,
    label: "Read the weathered stone",
    discovery: "Paid respects to Reviewer #2",
    onInteract: () =>
      ui.dialogue("Weathered Stone", "Archive grounds", [
        "HERE LIES A COMMENT FROM REVIEWER #2:",
        "“Have the authors considered comparing against every method ever published?”",
        "It was addressed in the rebuttal. It was never truly addressed.",
      ]),
  });

  // Stone lion (meshes in decor).
  const lion = shuffler([
    "You pat the stone lion. It has guarded The Archive since the first rejection letter.",
    "The lion does not blink. It has seen many drafts. It has judged them all.",
    "There's a tiny engraving on the paw: “roar = 0.05 significance”.",
  ]);
  ctx.spot({
    id: "lion",
    x: S.lions[0].x,
    z: S.lions[0].z + 1.2,
    radius: 1.6,
    marker: 2.9,
    label: "Pat the stone lion",
    discovery: "Patted a stone lion",
    onInteract: () => {
      ctx.synth.tone(110, 80, 0.6, 0.05, "sawtooth");
      ctx.say(`🦁 ${lion()}`, 3600);
    },
  });

  // GPU queue sign (mesh in decor). The queue only ever grows.
  let queue = 38;
  const why = shuffler(["Someone with a deadline cut in.", "A job named “final_final_v3” just joined.", "A labmate restarted their sweep.", "The scheduler is “rebalancing”."]);
  ctx.spot({
    id: "gpu",
    x: S.gpuSign.x,
    z: S.gpuSign.z,
    radius: 1.6,
    marker: 2.3,
    label: "Check the GPU queue",
    discovery: "Checked the GPU queue",
    onInteract: () => {
      const first = queue === 38;
      queue += first ? 0 : 1 + Math.floor(Math.random() * 3);
      ctx.say(first ? "🖥️ GPU QUEUE: you are #38. Estimated wait: one PhD." : `🖥️ GPU QUEUE: you are now #${queue}. ${why()}`, 3600);
    },
  });

  // Deadline milestone by the windmill path.
  const ms = S.milestone;
  const mb = new Baker();
  mb.at(ms.x, 0, ms.z, 0.6, () => {
    mb.box(0.5, 0.7, 0.3, STONE, 0, 0.35, 0);
    mb.cyl(0.25, 0.25, 0.3, 8, STONE, 0, 0.7, 0, Math.PI / 2);
    mb.box(0.62, 0.08, 0.42, STONE_D, 0, 0.04, 0);
  });
  ctx.root.add(mb.build());
  const mf = plaque(0.42, 0.4, textTexture(["DEADLINE", "0 km", "(AoE)"], { w: 200, h: 200, bg: "#c8c0b0", fg: "#4a2a1a", sizes: [36, 50, 26] }), STONE_D, 0.02);
  mf.position.set(ms.x + Math.sin(0.6) * 0.16, 0.5, ms.z + Math.cos(0.6) * 0.16);
  mf.rotation.y = 0.6;
  ctx.root.add(mf);
  ctx.solidCyl(ms.x, ms.z, 0.32, 0.9);
  ctx.spot({
    id: "milestone",
    x: ms.x,
    z: ms.z,
    radius: 1.6,
    marker: 1.4,
    label: "Read the milestone",
    discovery: "Found the deadline milestone",
    onInteract: () => ctx.say("🪨 DEADLINE: 0 km (Anywhere on Earth). It is always 0 km. That's the thing about deadlines.", 4000),
  });

  // Café chalkboard.
  ctx.spot({
    id: "menu",
    x: S.cafeBoard.x,
    z: S.cafeBoard.z,
    radius: 1.5,
    marker: 1.5,
    label: "Read the café chalkboard",
    discovery: "Read the café menu",
    onInteract: () =>
      ui.dialogue("Chalkboard", "Notebook Café", [
        "TODAY: Espresso of Insight · Reviewer Roast (bitter, lingering) · Camera-Ready Cold Brew.",
        "Deadline Decaf is sold out. It's always sold out.",
        "Free refills for anyone who can explain their own Figure 3.",
      ]),
  });

  // Seasonal notice on the plaza.
  const ss = S.seasons;
  const sign = buildSign("Seasonal Notice", { width: 1.9, sub: "Xu Town changes with the seasons" });
  sign.position.set(ss.x, 0, ss.z);
  sign.rotation.y = Math.atan2(-ss.x, -ss.z);
  sign.scale.setScalar(0.85);
  ctx.root.add(sign);
  ctx.solidCyl(ss.x, ss.z, 0.3, 2.2);
  const seasonal: Record<Ctx["season"], string> = {
    spring: "Spring: blossoms drift, ducklings appear, and so do new research ideas. Most of them will be pruned.",
    summer: "Summer: long evenings, loud crickets and the annual “I'll finally clean my code” festival.",
    autumn: "Autumn: leaves fall, pumpkins grow by the windmill, and so do conference deadlines. Kick a leaf pile responsibly.",
    winter: "Winter: snow on the roofs, cocoa at the café and a quiet hush over the reviewing season.",
  };
  ctx.spot({
    id: "seasons",
    x: ss.x,
    z: ss.z,
    radius: 1.8,
    marker: 2.4,
    label: "Read the seasonal notice",
    discovery: "Read the seasonal notice",
    onInteract: () => ui.dialogue("Seasonal Notice", "Town Council", ["This town changes with the seasons — and with your local clock.", seasonal[ctx.season]]),
  });

  // Lost & found by the notice board.
  const finds = shuffler([
    "a USB stick labelled “final_v7_REAL”",
    "one (1) sense of work-life balance, slightly used",
    "a red pen, nearly empty. Reviewer #2's, presumably",
    "a sticky note: “TODO: everything”",
    "a conference lanyard from a conference that hasn't happened yet",
    "a sock. Just the one",
  ]);
  ctx.spot({
    id: "lost-found",
    x: S.lostFound.x,
    z: S.lostFound.z,
    radius: 1.5,
    marker: 1.3,
    label: "Rummage in the lost & found",
    discovery: "Rummaged in the lost & found",
    onInteract: () => {
      ctx.synth.paper();
      ctx.say(`📦 You find ${finds()}. You put it back.`, 3400);
    },
  });
}

// ---- Windmill ------------------------------------------------------------------------------

function windmill(ctx: Ctx) {
  const { x, z } = S.windmillDoor;
  const note = plaque(0.32, 0.4, textTexture(["Gone", "grinding", "(data)"], { w: 160, h: 200, bg: "#f8f2e0", fg: "#3a2a1a", sizes: [34, 30, 26] }), 0xe8e0c8, 0.01);
  note.position.set(x + 0.62, 1.55, POI.windmill.z + 2.6 + 0.12);
  note.rotation.z = 0.08;
  ctx.root.add(note);
  const lines = ctx.cycle([
    "Knock knock. No answer. The note says: “Gone grinding (data). Back at epoch 200.”",
    "Knock knock. — Who's there? — Overfit. — Overfit who? — Overfit you perfectly, and nobody else.",
    "Knock knock. — Who's there? — Baseline. — Baseline who? — Exactly. Nobody remembers the baseline.",
    "The windmill creaks politely. It's busy turning.",
  ]);
  ctx.spot({
    id: "windmill-door",
    x,
    z,
    radius: 1.8,
    marker: 2.6,
    label: "Knock on the windmill door",
    discovery: "Knocked on the windmill",
    onInteract: () => {
      ctx.synth.knock();
      setTimeout(() => ctx.say(`🚪 ${lines()}`, 4200), 650);
    },
  });
}

// ---- Wishing well (it echoes) ----------------------------------------------------------------

function well(ctx: Ctx) {
  const { x, z } = S.well;
  const b = new Baker();
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + layer * 0.29;
      b.box(0.5, 0.36, 0.3, i % 3 === 0 ? STONE_D : STONE, x + Math.cos(a) * 0.82, 0.2 + layer * 0.36, z + Math.sin(a) * 0.82, 0, -a + Math.PI / 2, 0);
    }
  }
  b.cyl(0.72, 0.72, 0.04, 12, 0x1a2a3a, x, 0.45, z);
  for (const sx of [-0.85, 0.85]) b.box(0.14, 2.0, 0.14, WOOD_D, x + sx, 1.0, z);
  b.prism(2.3, 0.7, 1.5, 0x9a4a30, x, 2.0, z);
  b.cyl(0.07, 0.07, 1.7, 6, WOOD, x, 1.55, z, 0, 0, Math.PI / 2);
  b.box(0.05, 0.3, 0.05, WOOD, x + 0.95, 1.4, z + 0.12);
  b.box(0.02, 0.55, 0.02, 0xd8c8a0, x, 1.25, z);
  b.cyl(0.13, 0.1, 0.2, 8, 0x8a6a40, x, 0.9, z);
  ctx.root.add(b.build());
  ctx.solidCyl(x, z, 1.05, 0.95);
  const calls: [string, string, string?][] = [
    ["Hello?", "…hello? …llo? …o?"],
    ["Is my paper accepted?", "…accepted? …cepted? …ted?", "(very faintly) …major revisions…"],
    ["Reviewer #2?", "…two? …two? …too much?"],
    ["Will the GPU queue clear?", "…queue… queue… …ueue…", "(it does not)"],
    ["Verbrugge, what are the constraints?", "…constraints? …straints? …aints?"],
  ];
  const pick = shuffler(calls);
  ctx.spot({
    id: "well",
    x,
    z,
    radius: 2.2,
    marker: 2.7,
    label: "Shout into the well",
    discovery: "Shouted into the well",
    onInteract: () => {
      const [call, echo, after] = pick();
      ctx.say(`🗣️ “${call}”`, 2400);
      ctx.synth.echo();
      setTimeout(() => ctx.say(`🌀 <i>${echo}</i>`, 2800), 900);
      if (after) setTimeout(() => ctx.say(`<i>${after}</i>`, 2800), 2300);
    },
  });
}

// ---- Mailbox ------------------------------------------------------------------------------

function mailbox(ctx: Ctx) {
  const { x, z } = S.mailbox;
  const yaw = 0.6;
  const b = new Baker();
  b.at(x, 0, z, yaw, () => {
    b.box(0.1, 1.05, 0.1, WOOD_D, 0, 0.52, 0);
    b.box(0.36, 0.3, 0.52, 0x3a6ab0, 0, 1.2, 0);
    b.cyl(0.18, 0.18, 0.52, 10, 0x3a6ab0, 0, 1.35, 0, Math.PI / 2);
    b.box(0.24, 0.03, 0.02, 0x1a2a4a, 0, 1.28, 0.27);
    b.box(0.37, 0.06, 0.53, 0xe8c060, 0, 1.06, 0);
  });
  ctx.root.add(b.build());
  ctx.solidCyl(x, z, 0.25, 1.4);
  const fb = new Baker();
  fb.box(0.03, 0.42, 0.03, IRON, 0, 0.21, 0);
  fb.box(0.03, 0.14, 0.18, 0xd0403a, 0, 0.36, 0.08);
  const flag = fb.build(false);
  const flagPivot = new THREE.Group();
  flagPivot.position.set(x + Math.cos(yaw) * 0.2, 1.12, z - Math.sin(yaw) * 0.2);
  flagPivot.rotation.order = "YXZ";
  flagPivot.rotation.y = yaw;
  flagPivot.rotation.x = Math.PI / 2;
  flagPivot.add(flag);
  ctx.root.add(flagPivot);
  const letter = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.14), new THREE.MeshStandardMaterial({ color: 0xfaf6ea }));
  letter.visible = false;
  ctx.root.add(letter);
  let t0 = -1;
  let flagUp = 0;
  const start = new THREE.Vector3(x + Math.sin(yaw) * 0.3, 1.28, z + Math.cos(yaw) * 0.3);
  ctx.every((dt) => {
    flagUp = Math.max(0, flagUp - dt);
    const want = flagUp > 0 ? 0 : Math.PI / 2;
    flagPivot.rotation.x += (want - flagPivot.rotation.x) * Math.min(1, dt * 6);
    if (t0 >= 0) {
      t0 += dt;
      const k = t0 / 2.2;
      letter.position.copy(start).add(new THREE.Vector3(Math.sin(k * 7) * 0.6 * k, k * 9, -k * 6));
      letter.rotation.set(k * 5, k * 3, k * 2);
      if (k >= 1) {
        letter.visible = false;
        t0 = -1;
      }
    }
  });
  const to = ctx.cycle([
    "To: everyone who ever wrote a kind review. ETA: eventually.",
    "To: the open-source maintainers. Postage: one GitHub star.",
    "To: Verbrugge, for asking “what are the constraints?” one more time.",
    "To: whoever invented the undo button.",
    "To: you, for visiting. (It came straight back. Thank you!)",
  ]);
  ctx.spot({
    id: "mailbox",
    x,
    z,
    radius: 1.6,
    marker: 1.9,
    label: "Post a thank-you note",
    discovery: "Sent a thank-you note",
    onInteract: () => {
      flagUp = 3.2;
      t0 = 0;
      letter.visible = true;
      ctx.synth.paper();
      ctx.synth.chime([76, 79, 84], 0.12);
      ctx.say(`✉️ Thank-you note sent. ${to()}`, 3800);
    },
  });
}

// ---- Telescope ------------------------------------------------------------------------------

function telescope(ctx: Ctx, poser: Poser) {
  // Generous radius so no tree canopy blocks the view.
  const p = findClear(ctx.town, TELESCOPE_CANDIDATES, 2.2);
  const yaw = Math.PI; // facing north, over the hills
  const b = new Baker();
  b.at(p.x, 0, p.z, yaw, () => {
    b.box(1.8, 0.18, 1.8, WOOD, 0, 0.09, 0);
    for (const sx of [-0.8, 0.8]) for (const sz of [-0.8, 0.8]) b.box(0.12, 0.2, 0.12, WOOD_D, sx, 0.1, sz);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.box(0.05, 1.4, 0.05, WOOD_D, Math.sin(a) * 0.22, 0.85, Math.cos(a) * 0.22, Math.cos(a) * 0.22, 0, -Math.sin(a) * 0.22);
    }
    b.box(0.16, 0.12, 0.16, IRON, 0, 1.55, 0);
    b.atR(0, 1.62, 0, -0.55, 0, 0, () => {
      b.cyl(0.08, 0.1, 1.3, 10, 0xc89a3a, 0, 0, 0, Math.PI / 2);
      b.cyl(0.12, 0.12, 0.14, 10, 0x8a6a2a, 0, 0, 0.62, Math.PI / 2);
      b.cyl(0.04, 0.05, 0.16, 8, IRON, 0, 0, -0.72, Math.PI / 2);
      b.cyl(0.04, 0.04, 0.24, 6, 0xc89a3a, 0, 0.12, 0.2, Math.PI / 2);
    });
  });
  ctx.root.add(b.build());
  ctx.solidCyl(p.x, p.z, 0.9, 0.2);
  ctx.solidCyl(p.x, p.z, 0.3, 1.9);
  const sign = buildSign("Stargazing", { width: 1.6, sub: "Best after dark" });
  sign.scale.setScalar(0.7);
  sign.position.set(p.x + Math.cos(yaw) * 1.6, 0, p.z - Math.sin(yaw) * 1.6);
  sign.rotation.y = yaw + Math.PI;
  ctx.root.add(sign);

  const moonLines = shuffler([
    "The Moon. Still no sign of the camera-ready version.",
    "The Moon, in full. Or a very confident p-value.",
    "The Moon. Its craters look procedurally generated. Seed 1213?",
  ]);
  const starLines = shuffler(["Stars everywhere. One of them is definitely a satellite pretending.", "A shooting star! You wish for a reproducible result."]);
  const dayLines = shuffler(["Daytime. A cloud drifts by shaped like a confusion matrix.", "Blue sky, no stars. The telescope sighs and waits for night.", "You spot a bird. It is not peer-reviewed."]);
  ctx.spot({
    id: "telescope",
    x: p.x,
    z: p.z,
    radius: 2.0,
    marker: 2.3,
    label: () => (ctx.night() > 0.5 ? "Look through the telescope" : "Look through the telescope (better at night)"),
    discovery: "Looked through the telescope",
    enabled: () => !poser.busy,
    onInteract: () => {
      const g = ctx.game;
      const h = g.sky.hour;
      const ang = ((h - 6) / 12) * Math.PI;
      const sun = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.35).normalize();
      const moon = sun.clone().negate();
      moon.z = -0.3;
      moon.normalize();
      const cloudy = g.weather.kind === "rain" || g.weather.kind === "cloudy" || g.weather.kind === "snow";
      let dir: THREE.Vector3;
      let text: string;
      if (cloudy) {
        dir = new THREE.Vector3(Math.sin(yaw), 0.6, Math.cos(yaw));
        text = "Clouds. Somewhere above them, a GPU sits idle. Probably.";
      } else if (ctx.night() > 0.5 && moon.y > 0.06) {
        dir = moon;
        text = moonLines();
      } else if (ctx.night() > 0.5) {
        dir = new THREE.Vector3(Math.sin(yaw) * 0.6, 0.8, Math.cos(yaw) * 0.6);
        text = starLines();
      } else {
        dir = new THREE.Vector3(Math.sin(yaw), 0.35, Math.cos(yaw));
        text = dayLines();
      }
      const eye = new THREE.Vector3(p.x - Math.sin(yaw) * 0.6, 1.75, p.z - Math.cos(yaw) * 0.6);
      ctx.synth.creak();
      poser.peer(eye, dir, text);
    },
  });
}

// ---- Leaf pile (seasonal) -----------------------------------------------------------------------

function leafPile(ctx: Ctx) {
  const p = findClear(ctx.town, LEAF_CANDIDATES, 1.0);
  const palette: Record<Ctx["season"], number[]> = {
    autumn: [0xd8642a, 0xe89a30, 0xc84a2a, 0xf0c040, 0xa85a2a],
    winter: [0xf4f8ff, 0xdde8f4, 0xffffff, 0xe8f0fa],
    spring: [0xf4b8c8, 0xf8d0dc, 0xfff4f8, 0xe890a8],
    summer: [0x6aa04a, 0x8ab85a, 0x5a8a3a, 0x9ac060],
  };
  const what: Record<Ctx["season"], string> = { autumn: "leaf pile", winter: "snow pile", spring: "blossom pile", summer: "pile of grass clippings" };
  const cols = palette[ctx.season];
  const b = new Baker();
  for (let i = 0; i < 26; i++) {
    const a = i * 2.4;
    const r = Math.sqrt((i % 13) / 13) * 0.8;
    const h = (1 - r / 0.9) * 0.45;
    b.blob(0.2 + (i % 4) * 0.04, cols[i % cols.length], Math.cos(a) * r, h, Math.sin(a) * r, 1.2, 0.55, 1.2);
  }
  const pile = b.build(false);
  pile.position.set(p.x, 0, p.z);
  ctx.root.add(pile);

  const N = 44;
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.17, 0.12), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.9 }), N);
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) leaves.setColorAt(i, c.setHex(cols[i % cols.length]));
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  leaves.visible = false;
  leaves.frustumCulled = false;
  ctx.root.add(leaves);
  const parts = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), spin: new THREE.Vector3(), rot: new THREE.Euler() }));
  let life = 0;
  let regrow = 1;
  let cool = 0;
  const dummy = new THREE.Object3D();
  const kickLines = shuffler([
    `You kick the ${what[ctx.season]}. Wheee!`,
    `The ${what[ctx.season]} explodes in a very satisfying way.`,
    `Particles everywhere. Somewhere, a graphics programmer smiles.`,
  ]);

  const kick = (silent = false) => {
    if (cool > 0) return;
    cool = 1.2;
    life = 5;
    regrow = 0.25;
    leaves.visible = true;
    const pl = ctx.player();
    const away = new THREE.Vector3(p.x - pl.x, 0, p.z - pl.z).normalize();
    for (const q of parts) {
      q.p.set(p.x + (Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 0.3, p.z + (Math.random() - 0.5) * 0.8);
      const a = Math.random() * Math.PI * 2;
      q.v.set(Math.cos(a) * 1.8 + away.x * 2.2, 3 + Math.random() * 3.5, Math.sin(a) * 1.8 + away.z * 2.2);
      q.spin.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
      q.rot.set(Math.random() * 6, Math.random() * 6, 0);
    }
    ctx.synth.rustle();
    ctx.game.audio.sfx("jump", 0.5);
    if (!silent) ctx.say(`🍂 ${kickLines()}`);
  };

  ctx.spot({
    id: "leaf-pile",
    x: p.x,
    z: p.z,
    radius: 1.8,
    marker: 1.2,
    label: `Kick the ${what[ctx.season]}`,
    discovery: `Kicked the ${what[ctx.season]}`,
    discoveryId: "leaf-pile",
    enabled: () => cool <= 0 && regrow > 0.9,
    onInteract: () => kick(),
  });

  ctx.every((dt) => {
    cool = Math.max(0, cool - dt);
    // Running straight through it kicks it too.
    const pl = ctx.player();
    const v = ctx.game.player.vel;
    if (regrow > 0.9 && cool <= 0 && Math.hypot(pl.x - p.x, pl.z - p.z) < 0.9 && Math.hypot(v.x, v.z) > 5.5) kick(true);
    regrow = Math.min(1, regrow + dt / 10);
    pile.scale.set(0.6 + regrow * 0.4, regrow, 0.6 + regrow * 0.4);
    if (life <= 0) return;
    life -= dt;
    parts.forEach((q, i) => {
      if (q.p.y > 0.02) {
        q.v.y -= 7 * dt;
        q.v.multiplyScalar(Math.exp(-dt * 1.4));
        q.v.y = Math.max(q.v.y, -1.6);
        q.p.addScaledVector(q.v, dt);
        q.rot.x += q.spin.x * dt;
        q.rot.y += q.spin.y * dt;
        q.rot.z += q.spin.z * dt;
        q.p.x += Math.sin(life * 3 + i) * dt * 0.5;
      } else {
        q.p.y = 0.02;
        q.rot.x = -Math.PI / 2;
      }
      dummy.position.copy(q.p);
      dummy.rotation.copy(q.rot);
      dummy.scale.setScalar(life < 1.2 ? Math.max(0, life / 1.2) : 1);
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    });
    leaves.instanceMatrix.needsUpdate = true;
    if (life <= 0) leaves.visible = false;
  });
}
