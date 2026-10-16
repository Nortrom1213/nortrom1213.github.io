import * as THREE from "three";
import { hasModel, model } from "../../core/assets";
import { el } from "../../ui/ui";
import { Baker, canvasTexture, loadJSON, plaque, saveJSON, setGlow, shuffler, textTexture, type Ctx } from "./kit";
import { S } from "./spots";

// Little games around the Games Hall, the PCG Tower, the café and the tavern:
// a claw machine, a "?" block, a blueprint that regenerates itself, a gramophone
// that changes the music, a fortune-cookie stall and the tavern guestbook.

const WOOD = 0x8a5a34;
const WOOD_D = 0x5e3a20;
const IRON = 0x3a3a40;
const BRASS = 0xc89a3a;

export function fun(ctx: Ctx) {
  claw(ctx);
  qblock(ctx);
  blueprint(ctx);
  gramophone(ctx);
  fortune(ctx);
  guestbook(ctx);
}

// ---- Claw machine ------------------------------------------------------------------------

function claw(ctx: Ctx) {
  const { x, z } = S.claw;
  const yaw = -1.83; // facing the path to the hall door
  const b = new Baker();
  const PURPLE = 0x6a4ab0;
  const prizeCols = [0xf08a40, 0xf0d050, 0x5ac0e0, 0xe86aa0, 0x8ad060, 0xf4f0e8];
  b.at(x, 0, z, yaw, () => {
    b.box(0.95, 0.95, 0.95, PURPLE, 0, 0.475, 0);
    b.box(0.97, 0.12, 0.32, 0x4a3a8a, 0, 0.98, 0.5);
    b.cyl(0.02, 0.02, 0.14, 6, IRON, -0.18, 1.1, 0.52);
    b.sphere(0.05, 0xe04040, -0.18, 1.18, 0.52);
    b.cyl(0.05, 0.05, 0.03, 8, 0xf0c040, 0.15, 1.05, 0.52);
    b.box(0.22, 0.26, 0.02, 0x2a2050, 0.25, 0.55, 0.48);
    for (const sx of [-0.45, 0.45]) for (const sz of [-0.45, 0.45]) b.box(0.05, 0.95, 0.05, 0x4a3a8a, sx, 1.43, sz);
    b.box(1.0, 0.35, 1.0, PURPLE, 0, 2.08, 0);
    for (let i = 0; i < 14; i++) b.sphere(0.09, prizeCols[i % prizeCols.length], -0.32 + (i % 5) * 0.16, 1.0 + Math.floor(i / 5) * 0.06, -0.3 + ((i * 3) % 7) * 0.09);
    b.box(0.25, 0.02, 0.25, 0x2a2050, 0.3, 0.96, 0.3);
  });
  ctx.root.add(b.build());
  ctx.solidBox(x, z, 1.1, 1.1, 2.3);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.93, 0.88), new THREE.MeshStandardMaterial({ color: 0xc8e8ff, transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false }));
  glass.position.set(x, 1.43, z);
  glass.rotation.y = yaw;
  ctx.root.add(glass);
  const marquee = plaque(0.9, 0.26, textTexture(["CLAW-O-MATIC"], { w: 384, h: 110, bg: "#2a1a50", fg: "#ffe06a", sizes: [56] }), 0x2a1a50, 0.02, true);
  marquee.position.set(x + Math.sin(yaw) * 0.51, 2.08, z + Math.cos(yaw) * 0.51);
  marquee.rotation.y = yaw;
  ctx.root.add(marquee);
  ctx.every(() => setGlow(marquee, 0.5 + ctx.night() * 0.9));

  // The claw itself (local to the cabinet frame).
  const frame = new THREE.Group();
  frame.position.set(x, 0, z);
  frame.rotation.y = yaw;
  ctx.root.add(frame);
  const cb = new Baker();
  cb.box(0.025, 0.4, 0.025, 0xb0b0b8, 0, 0.2, 0);
  cb.cyl(0.05, 0.06, 0.06, 8, 0xb0b0b8, 0, 0, 0);
  const head = cb.build(false);
  frame.add(head);
  const prongs = [0, 1, 2].map((i) => {
    const pb = new Baker();
    pb.box(0.02, 0.14, 0.02, 0xb0b0b8, 0, -0.07, 0);
    pb.box(0.02, 0.02, 0.05, 0xb0b0b8, 0, -0.14, 0.02);
    const m = pb.build(false);
    const piv = new THREE.Group();
    piv.rotation.y = (i * Math.PI * 2) / 3;
    const inner = new THREE.Group();
    inner.position.z = 0.04;
    inner.add(m);
    piv.add(inner);
    head.add(piv);
    return inner;
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf08a40, roughness: 0.8 }));
  ball.visible = false;
  frame.add(ball);
  const home = new THREE.Vector3(0.3, 1.8, 0.3);
  head.position.copy(home);

  let t = -1;
  let win = false;
  let tries = 0;
  const target = new THREE.Vector3();
  const prizes = shuffler([
    "a tiny plush Perlin (very soft, slightly noisy)",
    "a rubber duck that has heard all your bugs",
    "a keychain that says “it works on my machine”",
    "an honorary “Best Paper” sticker",
    "a pocket-sized procedurally generated dungeon",
  ]);
  const misses = shuffler([
    "The claw grabs… and lets go. As tradition demands.",
    "So close! The claw has the grip strength of a weak baseline.",
    "Nothing. The claw is still in its exploration phase.",
    "The claw brushes a prize lovingly, then leaves. Relatable.",
  ]);
  ctx.spot({
    id: "claw",
    x: x + Math.sin(yaw) * 0.9,
    z: z + Math.cos(yaw) * 0.9,
    radius: 1.7,
    marker: 2.0,
    label: "Try the claw machine",
    discovery: "Played the claw machine",
    enabled: () => t < 0,
    onInteract: () => {
      tries++;
      win = tries % 4 === 0 || Math.random() < 0.3;
      if (win) tries = 0;
      t = 0;
      target.set(-0.3 + Math.random() * 0.5, 1.12, -0.3 + Math.random() * 0.45);
      (ball.material as THREE.MeshStandardMaterial).color.setHex([0xf08a40, 0xf0d050, 0x5ac0e0, 0xe86aa0][Math.floor(Math.random() * 4)]);
      ctx.game.audio.sfx("coin");
      ctx.synth.whirr(2.6);
    },
  });
  ctx.every((dt) => {
    if (t < 0) return;
    t += dt;
    const lerp = THREE.MathUtils.lerp;
    const ss = THREE.MathUtils.smoothstep;
    let close = 0;
    if (t < 0.8) {
      const k = ss(t, 0, 0.8);
      head.position.set(lerp(home.x, target.x, k), home.y, lerp(home.z, target.z, k));
    } else if (t < 1.5) {
      head.position.y = lerp(home.y, target.y, ss(t, 0.8, 1.5));
    } else if (t < 1.8) {
      close = ss(t, 1.5, 1.8);
    } else if (t < 2.5) {
      close = 1;
      head.position.y = lerp(target.y, home.y, ss(t, 1.8, 2.5));
    } else if (t < 3.1) {
      close = 1;
      const k = ss(t, 2.5, 3.1);
      head.position.x = lerp(target.x, home.x, k);
      head.position.z = lerp(target.z, home.z, k);
    }
    for (const p of prongs) p.rotation.x = -0.45 + close * 0.75;
    const carrying = win && t > 1.8 && t < 3.1;
    ball.visible = carrying || (!win && t > 1.8 && t < 2.1);
    if (ball.visible) ball.position.set(head.position.x, head.position.y - 0.2 - (!win ? (t - 1.8) * 2 : 0), head.position.z);
    if (t >= 3.2) {
      t = -1;
      ball.visible = false;
      head.position.copy(home);
      if (win) {
        ctx.game.audio.sfx("success");
        ctx.say(`🧸 You won ${prizes()}!`, 3600);
      } else {
        ctx.game.audio.sfx("fail", 0.4);
        ctx.say(`🕹️ ${misses()}`, 3200);
      }
    }
  });
}

// ---- "?" block ------------------------------------------------------------------------------

function qblock(ctx: Ctx) {
  const { x, z } = S.qblock;
  const Y0 = 2.15;
  const tex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = "#f0b828";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#c88010";
    g.fillRect(0, h - 10, w, 10);
    g.fillRect(w - 10, 0, 10, h);
    g.fillStyle = "#ffe080";
    g.fillRect(0, 0, w, 8);
    g.fillRect(0, 0, 8, h);
    g.fillStyle = "#7a4a10";
    for (const [px, py] of [[16, 16], [104, 16], [16, 104], [104, 104]]) g.fillRect(px, py, 8, 8);
    // Pixel "?".
    const q = [".XXXX.", "XX..XX", "....XX", "...XX.", "..XX..", "......", "..XX.."];
    const s = 10;
    q.forEach((row, ry) =>
      [...row].forEach((ch, rx) => {
        if (ch !== "X") return;
        g.fillStyle = "#7a4a10";
        g.fillRect(34 + rx * s + 3, 26 + ry * s + 3, s, s);
        g.fillStyle = "#fff4d0";
        g.fillRect(34 + rx * s, 26 + ry * s, s, s);
      }),
    );
  });
  tex.magFilter = THREE.NearestFilter;
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshStandardMaterial({ map: tex, emissive: 0x3a2400, emissiveIntensity: 0.4, roughness: 0.6 }));
  block.castShadow = true;
  ctx.root.add(block);
  ctx.town.world.addBox(x, z, 0.9, 0.9, Y0, Y0 + 0.9, { noCamera: true });
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0xf0c030, emissive: 0x8a6010, emissiveIntensity: 0.6, roughness: 0.4 }));
  coin.rotation.x = Math.PI / 2;
  coin.visible = false;
  ctx.root.add(coin);
  const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.set(x, 0.02, z);
  ctx.root.add(shadowDisc);

  let bump = 0;
  let coinT = -1;
  let cool = 0;
  let hits = 0;
  const lines = ctx.cycle([
    "+1 coin! Sadly not accepted for conference fees.",
    "+1 citation! (A self-citation, but it counts.)",
    "A mushroom-shaped research idea pops out. It grows on you.",
    "+1 coin. The block looks smug.",
    "The block is empty. Like the related-work section of a first draft.",
  ]);
  const bonk = () => {
    if (cool > 0) return;
    cool = 0.6;
    bump = 1;
    hits++;
    const empty = hits % 5 === 0;
    if (!empty) {
      coinT = 0;
      coin.visible = true;
      ctx.game.audio.sfx("coin");
    } else ctx.synth.tone(180, 120, 0.15, 0.08, "square");
    ctx.say(`❓ ${lines()}`, 2600);
  };
  ctx.spot({
    id: "qblock",
    x,
    z,
    radius: 1.8,
    marker: 1.5,
    label: "Bonk the ? block (or jump into it)",
    discovery: "Bonked the ? block",
    onInteract: bonk,
  });
  // The prompt's discovery hook only runs via E; jumping counts as a discovery too.
  const viaJump = () => {
    bonk();
    ctx.discover("qblock", "Bonked the ? block");
  };
  ctx.every((dt, t) => {
    cool = Math.max(0, cool - dt);
    const p = ctx.player();
    const pc = ctx.game.player;
    // Head bump from below: physics stops the jump at the block's underside.
    if (!pc.onGround && Math.abs(p.x - x) < 0.7 && Math.abs(p.z - z) < 0.7 && Math.abs(p.y + pc.height - Y0) < 0.06 && pc.vel.y <= 0.01) viaJump();
    bump = Math.max(0, bump - dt * 4);
    block.position.set(x, Y0 + 0.45 + Math.sin(bump * Math.PI) * 0.28 + Math.sin(t * 2) * 0.03, z);
    block.rotation.y = Math.sin(t * 0.5) * 0.05;
    if (coinT >= 0) {
      coinT += dt;
      const k = coinT / 0.7;
      coin.position.set(x, Y0 + 1.0 + Math.sin(Math.min(1, k) * Math.PI * 0.5) * 1.3, z);
      coin.rotation.z = coinT * 18;
      if (k >= 1) {
        coin.visible = false;
        coinT = -1;
      }
    }
  });
}

// ---- Blueprint table (PCG Tower) ---------------------------------------------------------------

function blueprint(ctx: Ctx) {
  const { x, z } = S.blueprint;
  const b = new Baker();
  b.box(1.7, 0.07, 1.05, WOOD, x, 0.86, z);
  for (const sx of [-0.7, 0.7]) {
    b.box(0.08, 0.84, 0.08, WOOD_D, x + sx, 0.42, z - 0.4);
    b.box(0.08, 0.84, 0.08, WOOD_D, x + sx, 0.42, z + 0.4);
    b.box(0.06, 0.06, 0.8, WOOD_D, x + sx, 0.25, z);
  }
  b.cyl(0.05, 0.05, 0.7, 8, 0xd8e4f4, x - 0.55, 0.95, z - 0.62, 0, 0.3, Math.PI / 2);
  b.cyl(0.04, 0.04, 0.6, 8, 0xc8d8f0, x + 0.6, 0.94, z - 0.66, 0, -0.2, Math.PI / 2);
  b.cyl(0.05, 0.06, 0.08, 8, 0x1a1a2a, x + 0.72, 0.93, z + 0.38);
  b.box(0.02, 0.2, 0.02, 0xe8e0d0, x + 0.74, 1.02, z + 0.38, 0, 0, 0.4);
  b.box(0.04, 0.3, 0.04, IRON, x - 0.75, 1.04, z + 0.4);
  b.cone(0.12, 0.12, 6, 0x4a6a3a, x - 0.75, 1.24, z + 0.4, Math.PI);
  ctx.root.add(b.build());
  ctx.solidBox(x, z, 1.7, 1.05, 1.0);

  const W = 512;
  const H = 336;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const draw = (seed: number) => {
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.fillStyle = "#24508c";
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(255,255,255,0.12)";
    g.lineWidth = 1;
    for (let i = 0; i <= W; i += 16) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, H);
      g.stroke();
    }
    for (let j = 0; j <= H; j += 16) {
      g.beginPath();
      g.moveTo(0, j);
      g.lineTo(W, j);
      g.stroke();
    }
    const rooms: { x: number; y: number; w: number; h: number }[] = [];
    for (let tries = 0; tries < 200 && rooms.length < 11; tries++) {
      const w = 3 + Math.floor(rnd() * 5);
      const h = 2 + Math.floor(rnd() * 4);
      const rx = 1 + Math.floor(rnd() * (W / 16 - w - 2));
      const ry = 2 + Math.floor(rnd() * (H / 16 - h - 3));
      if (rooms.some((r) => rx < r.x + r.w + 1 && rx + w + 1 > r.x && ry < r.y + r.h + 1 && ry + h + 1 > r.y)) continue;
      rooms.push({ x: rx, y: ry, w, h });
    }
    rooms.sort((a, c) => a.x - c.x);
    g.strokeStyle = "#e8f0ff";
    g.lineWidth = 3;
    let dead = 0;
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1];
      const c = rooms[i];
      const ax = (a.x + a.w / 2) * 16;
      const ay = (a.y + a.h / 2) * 16;
      const cx = (c.x + c.w / 2) * 16;
      const cy = (c.y + c.h / 2) * 16;
      g.beginPath();
      g.moveTo(ax, ay);
      if (rnd() < 0.5) g.lineTo(cx, ay);
      else g.lineTo(ax, cy);
      g.lineTo(cx, cy);
      g.stroke();
      if (rnd() < 0.25) {
        dead++;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx, cy + (rnd() < 0.5 ? -40 : 40));
        g.stroke();
      }
    }
    rooms.forEach((r, i) => {
      g.fillStyle = i === 0 ? "#5ad08a" : i === rooms.length - 1 ? "#e86a5a" : "#3a6aa8";
      g.fillRect(r.x * 16, r.y * 16, r.w * 16, r.h * 16);
      g.strokeStyle = "#e8f0ff";
      g.lineWidth = 2;
      g.strokeRect(r.x * 16, r.y * 16, r.w * 16, r.h * 16);
    });
    const secrets = Math.floor(rnd() * 3);
    g.setLineDash([4, 4]);
    for (let k = 0; k < secrets; k++) {
      const r = rooms[1 + Math.floor(rnd() * Math.max(1, rooms.length - 2))] ?? rooms[0];
      g.strokeStyle = "#f0d060";
      g.strokeRect(r.x * 16 - 6, r.y * 16 - 6, r.w * 16 + 12, r.h * 16 + 12);
    }
    g.setLineDash([]);
    g.fillStyle = "#e8f0ff";
    g.font = "700 18px Nunito, sans-serif";
    g.fillText(`PCG TOWER — FLOOR PLAN · SEED #${seed % 10000}`, 12, 22);
    g.font = "600 13px Nunito, sans-serif";
    g.fillText("start", rooms[0].x * 16 + 4, rooms[0].y * 16 + 14);
    const last = rooms[rooms.length - 1];
    g.fillText("boss", last.x * 16 + 4, last.y * 16 + 14);
    tex.needsUpdate = true;
    return { rooms: rooms.length, secrets, dead };
  };
  let seed = 1213;
  draw(seed);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.98), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  sheet.rotation.x = -Math.PI / 2;
  sheet.rotation.z = 0.04;
  sheet.position.set(x, 0.9, z + 0.02);
  sheet.receiveShadow = true;
  ctx.root.add(sheet);
  ctx.spot({
    id: "blueprint",
    x,
    z: z + 1.0,
    radius: 1.8,
    marker: 1.6,
    label: "Regenerate the blueprint",
    discovery: "Regenerated a blueprint",
    onInteract: () => {
      seed = 1 + Math.floor(Math.random() * 2147483000);
      const r = draw(seed);
      ctx.synth.paper();
      const pl = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
      ctx.say(`📐 Seed #${seed % 10000}: ${pl(r.rooms, "room")}, ${pl(r.secrets, "secret")}, ${pl(r.dead, "dead end")}. No two towers alike.`, 3800);
    },
  });
}

// ---- Gramophone (changes the music) --------------------------------------------------------------

function gramophone(ctx: Ctx) {
  const { x, z } = S.gramophone;
  const yaw = 2.6;
  const b = new Baker();
  b.at(x, 0, z, yaw, () => {
    b.cyl(0.24, 0.3, 0.04, 8, WOOD_D, 0, 0.02, 0);
    b.cyl(0.04, 0.04, 0.66, 6, WOOD_D, 0, 0.35, 0);
    b.cyl(0.34, 0.34, 0.05, 10, WOOD, 0, 0.68, 0);
    b.box(0.42, 0.16, 0.36, 0x7a3a24, 0, 0.79, 0);
    b.box(0.44, 0.03, 0.38, BRASS, 0, 0.87, 0);
    b.cyl(0.02, 0.02, 0.1, 6, BRASS, 0.24, 0.8, 0.05, 0, 0, Math.PI / 2);
    b.box(0.02, 0.02, 0.2, BRASS, 0.13, 0.92, -0.05, 0, 0.3, 0);
    // Horn: neck plus a flared bell aimed forward and up.
    b.cyl(0.03, 0.03, 0.22, 6, BRASS, 0.12, 0.98, -0.12);
    b.atR(0.12, 1.08, -0.08, 1.0, 0, 0, () => {
      b.cyl(0.3, 0.035, 0.55, 10, BRASS, 0, 0.27, 0);
      b.cyl(0.27, 0.27, 0.01, 10, 0x3a2a14, 0, 0.545, 0);
    });
  });
  ctx.root.add(b.build());
  ctx.solidCyl(x, z, 0.38, 1.4);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 16), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 }));
  disc.position.set(x, 0.895, z);
  ctx.root.add(disc);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.014, 10), new THREE.MeshStandardMaterial({ color: 0xd0504a }));
  label.position.copy(disc.position);
  ctx.root.add(label);

  const noteTex = canvasTexture(64, 64, (g2) => {
    g2.fillStyle = "#fff4d0";
    g2.font = "700 48px serif";
    g2.textAlign = "center";
    g2.textBaseline = "middle";
    g2.fillText("♪", 32, 34);
  });
  const notes = [0, 1, 2].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.scale.setScalar(0.32);
    ctx.root.add(s);
    return s;
  });
  const records: { music: "night" | "tense" | "day" | "silent" | "auto"; name: string }[] = [
    { music: "night", name: "late-night lo-fi" },
    { music: "tense", name: "a brisk deadline march" },
    { music: "day", name: "a sunny village strum" },
    { music: "silent", name: "silence (writing mode)" },
    { music: "auto", name: "the town's own tune again" },
  ];
  let idx = -1;
  const playing = () => idx >= 0 && records[idx].music !== "auto" && records[idx].music !== "silent";
  ctx.spot({
    id: "gramophone",
    x: x + Math.sin(yaw) * 0.6,
    z: z + Math.cos(yaw) * 0.6,
    radius: 1.6,
    marker: 1.7,
    label: () => (idx < 0 || records[idx].music === "auto" ? "Wind up the gramophone" : "Change the record"),
    discovery: "Changed the music",
    onInteract: () => {
      idx = (idx + 1) % records.length;
      const r = records[idx];
      ctx.town.music = r.music;
      ctx.synth.crackle(1.0);
      ctx.say(`🎶 The gramophone plays ${r.name}.`, 3000);
      if (r.music === "auto") idx = -1;
    },
  });
  ctx.every((dt, t) => {
    // Out of earshot (or indoors): the town's own music returns.
    if (idx >= 0) {
      const p = ctx.player();
      const away = ctx.game.stage !== ctx.town || Math.hypot(p.x - x, p.z - z) > 32;
      if (away) {
        idx = -1;
        ctx.town.music = "auto";
        if (ctx.game.stage === ctx.town) ctx.say("The gramophone's tune fades behind you.", 2400);
      }
    }
    const on = playing();
    if (on) {
      disc.rotation.y += dt * 3.5;
      label.rotation.y = disc.rotation.y;
    }
    notes.forEach((n, i) => {
      const k = (t * 0.45 + i / 3) % 1;
      const hx = x + Math.sin(yaw) * 0.25;
      const hz = z + Math.cos(yaw) * 0.25;
      n.position.set(hx + Math.sin(k * 6 + i) * 0.2, 1.3 + k * 1.1, hz);
      n.material.opacity = on ? Math.sin(k * Math.PI) * 0.9 : 0;
    });
  });
}

// ---- Fortune cookie stall ----------------------------------------------------------------------

function fortune(ctx: Ctx) {
  const { x, z } = S.fortune;
  const a = Math.atan2(x, z);
  // Local frame: +x faces the plaza centre, z runs along the counter.
  const yaw = a + Math.PI / 2;
  const top = 0.37 * 2.6;
  if (hasModel("town", "stall")) {
    const st = model("town", "stall", 2.6);
    st.position.set(x, 0, z);
    st.rotation.y = yaw;
    ctx.root.add(st);
  }
  const b = new Baker();
  b.at(x, 0, z, yaw, () => {
    if (!hasModel("town", "stall")) b.box(1.6, top, 2.5, WOOD, 0, top / 2, 0);
    // Striped awning on four poles.
    for (const sx of [-0.75, 0.75]) for (const sz of [-1.2, 1.2]) b.box(0.08, 2.5 - (sx > 0 ? 0.25 : 0), 0.08, WOOD_D, sx, (2.5 - (sx > 0 ? 0.25 : 0)) / 2, sz);
    for (let k = 0; k < 6; k++) b.box(1.8, 0.05, 0.44, k % 2 ? 0xf4ecd8 : 0xc8403a, 0, 2.38, -1.1 + k * 0.44, 0, 0, -0.14);
    for (let k = 0; k < 6; k++) b.atR(0.9, 2.25, -1.1 + k * 0.44, 0, Math.PI / 2, Math.PI, () => b.prism(0.44, 0.18, 0.02, k % 2 ? 0xf4ecd8 : 0xc8403a));
    // Cookie bowl, a teapot-ish jar and a little stack of paper slips.
    b.cyl(0.24, 0.16, 0.12, 10, 0xf4ecd8, 0.35, top + 0.06, 0.2);
    for (let i = 0; i < 7; i++) {
      const ang = i * 0.9;
      b.blob(0.065, 0xe0b060, 0.35 + Math.cos(ang) * 0.12, top + 0.13 + (i % 2) * 0.03, 0.2 + Math.sin(ang) * 0.12, 1.3, 0.7, 0.9);
    }
    b.cyl(0.1, 0.12, 0.26, 8, 0x4a8a7a, 0.3, top + 0.13, -0.5);
    b.box(0.2, 0.04, 0.14, 0xfaf6ea, 0.4, top + 0.02, -0.15, 0, 0.4, 0);
  });
  ctx.root.add(b.build());
  const rx = Math.sin(a);
  const rz = Math.cos(a);
  const tx = Math.cos(a);
  const tz = -Math.sin(a);
  ctx.solidCyl(x + tx * 0.6, z + tz * 0.6, 0.85, 2.4);
  ctx.solidCyl(x - tx * 0.6, z - tz * 0.6, 0.85, 2.4);
  const board = plaque(1.5, 0.36, textTexture(["FORTUNE COOKIES", "wisdom free · accuracy not guaranteed"], { w: 512, h: 124, bg: "#f4ecd8", fg: "#8a2a20", border: "#c8403a", sizes: [46, 22] }), 0xc8403a, 0.04);
  board.position.set(x - rx * 0.95, 2.1, z - rz * 0.95);
  board.rotation.y = a + Math.PI;
  ctx.root.add(board);
  const fortunes = shuffler([
    "Your next experiment will work on the first try. Statistically, this is not that experiment.",
    "A reviewer will soon call your work “interesting”. Do not ask what they mean.",
    "Lucky numbers: p < 0.05.",
    "You will find the bug in the last place you look. Look there first.",
    "Great things await you after the camera-ready deadline.",
    "Your GPU job will start… soon.",
    "An unexpected citation is coming your way.",
    "Today is a good day to back up your thesis.",
    "Help! I'm trapped in a procedural fortune generator.",
    "The seed you seek is 1213.",
  ]);
  ctx.spot({
    id: "fortune",
    x: x - rx * 1.5,
    z: z - rz * 1.5,
    radius: 1.7,
    marker: 1.6,
    label: "Crack a fortune cookie",
    discovery: "Cracked a fortune cookie",
    onInteract: () => {
      ctx.synth.crunch();
      ctx.say(`🥠 “${fortunes()}”`, 4200);
    },
  });
}

// ---- Tavern guestbook (local only) -------------------------------------------------------------------

interface Entry {
  name: string;
  note: string;
  date: string;
}

const GB_KEY = "xutown.details.guestbook";
const PRESET: Entry[] = [
  { name: "Perlin", note: "mrrow. 5/5, would nap here again.", date: "always" },
  { name: "Bard of CHI", note: "Lovely inn. Have you considered a thematic analysis of the soup?", date: "last week" },
  { name: "A tired PhD student", note: "Came for the coffee, stayed for the fireflies.", date: "3 a.m." },
  { name: "Reviewer #2", note: "Nice town. Please add more baselines.", date: "rebuttal period" },
];

function guestbook(ctx: Ctx) {
  const { x, z } = S.guestbook;
  const yaw = Math.PI / 2 + 0.4;
  const b = new Baker();
  b.at(x, 0, z, yaw, () => {
    b.box(0.5, 0.08, 0.4, WOOD_D, 0, 0.04, 0);
    b.box(0.12, 1.0, 0.12, WOOD, 0, 0.55, 0);
    b.box(0.6, 0.05, 0.42, WOOD, 0, 1.07, 0.02, 0.35);
    b.box(0.26, 0.03, 0.34, 0xfaf6ea, -0.13, 1.11, 0.03, 0.35, 0, 0.06);
    b.box(0.26, 0.03, 0.34, 0xfaf6ea, 0.13, 1.11, 0.03, 0.35, 0, -0.06);
    b.box(0.56, 0.02, 0.36, 0x6a2a2a, 0, 1.09, 0.03, 0.35);
    b.cyl(0.04, 0.04, 0.06, 8, 0x1a1a2a, 0.25, 1.13, -0.12);
    b.box(0.01, 0.22, 0.03, 0xf4f0e8, 0.25, 1.24, -0.12, 0.3, 0, -0.25);
  });
  ctx.root.add(b.build());
  ctx.solidCyl(x, z, 0.3, 1.2);

  const open = () => {
    const ui = ctx.game.ui;
    const mine = loadJSON<Entry[]>(GB_KEY, []);
    const all = [...PRESET, ...mine];
    const body = el("div");
    body.append(el("p", undefined, "The Tavern's guestbook. Your entries stay in <i>this browser</i> only — nothing is sent anywhere."));
    const list = el("div");
    list.style.cssText = "display:flex;flex-direction:column;gap:6px;margin:0.6rem 0;max-height:40vh;overflow:auto";
    for (const e of all.slice(-10).reverse()) {
      const row = el("div");
      row.style.cssText = "padding:6px 10px;border-radius:10px;background:rgba(0,0,0,0.05)";
      const who = el("b");
      who.textContent = e.name;
      const when = el("small");
      when.textContent = ` · ${e.date}`;
      when.style.opacity = "0.7";
      const note = el("div");
      note.textContent = e.note;
      row.append(who, when, note);
      list.append(row);
    }
    body.append(list);
    const form = el("div");
    form.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;align-items:center";
    const name = el("input");
    name.maxLength = 24;
    name.placeholder = "Your name";
    const note = el("input");
    note.maxLength = 80;
    note.placeholder = "A short note";
    for (const i of [name, note]) i.style.cssText = "flex:1 1 140px;min-width:0;padding:7px 10px;border-radius:10px;border:2px solid rgba(0,0,0,0.2);font:inherit";
    const btn = el("button", "btn small", "Sign");
    const sign = () => {
      const entry: Entry = {
        name: name.value.trim().slice(0, 24) || "A friendly traveller",
        note: note.value.trim().slice(0, 80) || "Was here. Liked it.",
        date: new Date().toLocaleDateString(),
      };
      const next = [...mine, entry].slice(-40);
      saveJSON(GB_KEY, next);
      ctx.synth.paper();
      ui.closePanel();
      ctx.say(`🖋️ Signed! You're visitor #${PRESET.length + next.length} in this copy of the book.`, 3800);
    };
    btn.addEventListener("click", sign);
    for (const i of [name, note]) i.addEventListener("keydown", (e) => e.key === "Enter" && !e.isComposing && sign());
    form.append(name, note, btn);
    body.append(form);
    if (mine.length) body.append(el("p", undefined, `<small>You've signed ${mine.length} time${mine.length === 1 ? "" : "s"} so far.</small>`));
    ctx.game.audio.sfx("open");
    ui.openPanel({ title: "Guestbook", kicker: "The Tavern", body, onClose: () => ctx.game.audio.sfx("close") });
    setTimeout(() => name.focus({ preventScroll: true }), 50);
  };
  ctx.spot({
    id: "guestbook",
    x: x + Math.sin(yaw) * 0.7,
    z: z + Math.cos(yaw) * 0.7,
    radius: 1.6,
    marker: 1.7,
    label: "Sign the guestbook",
    discovery: "Signed the guestbook",
    onInteract: open,
  });
}
