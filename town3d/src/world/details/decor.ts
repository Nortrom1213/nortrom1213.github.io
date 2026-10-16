import * as THREE from "three";
import { hasModel, instanced, type Placement } from "../../core/assets";
import { Baker, canvasTexture, fit, glowSprite, plaque, setGlow, textTexture, type Ctx } from "./kit";
import { S } from "./spots";

// Static set dressing that gives each place its own identity, plus a few ambient
// animations (neon flicker, string lights, swinging sign, orbiting rune stone).

const WOOD = 0x8a5a34;
const WOOD_D = 0x5e3a20;
const WOOD_L = 0xb8885a;
const STONE = 0xb8b0a2;
const STONE_D = 0x8f887c;
const IRON = 0x3a3a40;
const BRASS = 0xc89a3a;
const BOARD_YAW = 2.6;
const BOOKS = [0x8a3a3a, 0x3a5a8a, 0x4a7a4a, 0xc8a050, 0x6a4a8a, 0xd8d0c0, 0x2a4a5a, 0xa05a30];

/** A wooden bench with its seat top at 0.48 m; the sitter faces local +z. */
export function bakeBench(b: Baker, len = 1.8) {
  b.box(len, 0.07, 0.5, WOOD_L, 0, 0.445, 0);
  b.box(len, 0.32, 0.06, WOOD_L, 0, 0.82, -0.24, -0.12);
  for (const sx of [-1, 1]) {
    b.box(0.08, 0.44, 0.44, WOOD_D, sx * (len / 2 - 0.12), 0.22, 0);
    b.box(0.07, 0.62, 0.07, WOOD_D, sx * (len / 2 - 0.12), 0.72, -0.24);
    b.box(0.07, 0.06, 0.48, WOOD_D, sx * (len / 2 - 0.08), 0.66, -0.01);
  }
}

function bookStack(b: Baker, n: number, seed: number) {
  let y = 0;
  for (let i = 0; i < n; i++) {
    const h = 0.06 + ((seed * 7 + i * 13) % 5) * 0.012;
    const w = 0.34 + ((seed + i * 3) % 4) * 0.04;
    b.box(w, h, 0.26 + (i % 2) * 0.03, BOOKS[(seed + i) % BOOKS.length], 0, y + h / 2, 0, 0, ((seed + i * 5) % 7) * 0.12 - 0.36, 0);
    y += h;
  }
  return y;
}

function ivy(b: Baker, x: number, z: number, nx: number, nz: number, height: number, seed: number) {
  const greens = [0x3f7a3a, 0x4f8f45, 0x356a32, 0x5a9a4a];
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const tx = -nz;
  const tz = nx;
  for (let i = 0; i < 26; i++) {
    const h = rnd() * height;
    const spread = 0.25 + (1 - h / height) * 0.55;
    const off = (rnd() - 0.5) * 2 * spread;
    const r = 0.14 + rnd() * 0.12;
    b.blob(r, greens[i % greens.length], x + tx * off + nx * 0.06, h + 0.1, z + tz * off + nz * 0.06, nx ? 0.45 : 1, 1, nz ? 0.45 : 1);
  }
  // A trailing vine stem.
  b.box(nx ? 0.04 : 0.05, height, nz ? 0.04 : 0.05, 0x3a5a2a, x + nx * 0.04, height / 2, z + nz * 0.04);
}

/** Catenary points between a and b. */
function sagLine(a: THREE.Vector3, b: THREE.Vector3, sag: number, n: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return pts;
}

export function buildDecor(ctx: Ctx) {
  library(ctx);
  cafe(ctx);
  hall(ctx);
  tavern(ctx);
  archive(ctx);
  tower(ctx);
  plaza(ctx);
  noticeAndPortal(ctx);
}

// ---- Library (NW) ------------------------------------------------------------------

function library(ctx: Ctx) {
  const b = new Baker();
  const wallZ = -18 + (3 * 2.6) / 2; // south facade
  // Reading bench.
  b.at(S.libBench.x, 0, S.libBench.z, S.libBench.yaw, () => bakeBench(b));
  ctx.solidBox(S.libBench.x, S.libBench.z, 1.8, 0.6, 0.48);
  // A book on the bench, left open.
  b.at(S.libBench.x + 0.6, 0.48, S.libBench.z + 0.02, 0.3, () => {
    b.box(0.22, 0.03, 0.3, 0xf0e8d8, -0.11, 0.015, 0, 0, 0, 0.08);
    b.box(0.22, 0.03, 0.3, 0xf0e8d8, 0.11, 0.015, 0, 0, 0, -0.08);
    b.box(0.46, 0.012, 0.32, 0x8a3a3a, 0, 0.004, 0);
  });

  // Book cart.
  b.at(S.libCart.x, 0, S.libCart.z, 0.25, () => {
    b.box(1.2, 0.05, 0.5, WOOD, 0, 0.35, 0);
    b.box(1.2, 0.05, 0.5, WOOD, 0, 0.8, 0);
    for (const sx of [-0.58, 0.58]) for (const sz of [-0.22, 0.22]) b.box(0.05, 0.9, 0.05, WOOD_D, sx, 0.5, sz);
    for (const sx of [-0.45, 0.45]) b.cyl(0.09, 0.09, 0.05, 8, IRON, sx, 0.1, 0.27, Math.PI / 2);
    b.box(0.04, 0.04, 0.6, IRON, 0.7, 0.95, 0, 0, 0, 0.3);
    for (const [y, row] of [[0.375, 0], [0.825, 1]] as const) {
      let x = -0.55;
      let i = row * 5;
      while (x < 0.5) {
        const w = 0.06 + (i % 3) * 0.02;
        const h = 0.26 + ((i * 7) % 4) * 0.03;
        b.box(w, h, 0.3, BOOKS[i % BOOKS.length], x + w / 2, y + h / 2, 0, 0, 0, i % 6 === 5 ? 0.25 : 0);
        x += w + 0.01;
        i++;
      }
    }
  });
  ctx.solidCyl(S.libCart.x, S.libCart.z, 0.7, 1.0);

  // Book stacks by the door.
  b.at(S.libBooks.x, 0, S.libBooks.z, 0, () => {
    b.at(-0.15, 0, 0, 0.2, () => bookStack(b, 7, 1));
    b.at(0.25, 0, 0.15, -0.4, () => bookStack(b, 4, 4));
    b.at(0.05, 0, -0.25, 0.9, () => bookStack(b, 5, 7));
  });
  ctx.solidCyl(S.libBooks.x, S.libBooks.z, 0.4, 0.6);

  // Stone owl on a pedestal.
  b.at(S.libOwl.x, 0, S.libOwl.z, -0.4, () => {
    b.box(0.7, 0.12, 0.7, STONE_D, 0, 0.06, 0);
    b.box(0.56, 0.9, 0.56, STONE, 0, 0.57, 0);
    b.box(0.68, 0.1, 0.68, STONE_D, 0, 1.07, 0);
    b.blob(0.27, STONE, 0, 1.38, 0, 1, 1.25, 0.95, 1);
    b.blob(0.22, STONE, 0, 1.72, 0.02, 1.1, 0.95, 1, 1);
    for (const sx of [-1, 1]) {
      b.cyl(0.075, 0.075, 0.04, 10, 0xe8e2d4, sx * 0.09, 1.74, 0.2, Math.PI / 2);
      b.cyl(0.035, 0.035, 0.05, 8, 0x2a2a2a, sx * 0.09, 1.74, 0.215, Math.PI / 2);
      b.cone(0.05, 0.14, 4, STONE_D, sx * 0.14, 1.92, 0, 0, 0, sx * -0.35);
      b.blob(0.13, STONE_D, sx * 0.22, 1.36, 0.02, 0.4, 1.1, 0.9);
    }
    b.cone(0.035, 0.08, 4, 0xc8a050, 0, 1.68, 0.21, Math.PI / 2);
    // Mortarboard, because of course.
    b.box(0.36, 0.03, 0.36, 0x2a2a35, 0, 1.94, 0, 0, 0.785);
    b.cyl(0.11, 0.11, 0.06, 8, 0x2a2a35, 0, 1.9, 0);
    b.box(0.015, 0.16, 0.015, 0xe8c060, 0.15, 1.86, 0.1);
  });
  ctx.solidCyl(S.libOwl.x, S.libOwl.z, 0.45, 2.0);

  // Brass globe on the east side (the sphere turns slowly).
  b.at(S.libGlobe.x, 0, S.libGlobe.z, 0, () => {
    b.cyl(0.4, 0.5, 0.15, 8, STONE_D, 0, 0.075, 0);
    b.cyl(0.12, 0.18, 1.1, 8, STONE, 0, 0.7, 0);
    b.cyl(0.25, 0.14, 0.12, 8, BRASS, 0, 1.3, 0);
    b.torus(0.62, 0.03, BRASS, 0, 1.95, 0, 0, Math.PI / 2, 0.41);
  });
  ctx.solidCyl(S.libGlobe.x, S.libGlobe.z, 0.55, 2.6);
  const gb = new Baker();
  gb.sphere(0.55, 0x4a8ac8);
  for (const [x, y, z, s] of [[0.3, 0.2, 0.35, 0.28], [-0.35, -0.1, 0.3, 0.24], [0.1, -0.3, -0.4, 0.3], [-0.2, 0.35, -0.3, 0.2], [0.45, -0.15, -0.1, 0.18]]) gb.blob(s, 0x5aa05a, x, y, z, 1, 0.7, 1);
  const globe = gb.build();
  globe.position.set(S.libGlobe.x, 1.95, S.libGlobe.z);
  globe.rotation.z = 0.41;
  ctx.root.add(globe);
  ctx.every((dt) => (globe.rotation.y += dt * 0.25));

  // Ivy climbing the facade.
  ivy(b, -31.7, wallZ + 0.02, 0, 1, 4.2, 11);
  ivy(b, -20.3, wallZ + 0.02, 0, 1, 3.4, 23);
  ivy(b, -19.5 + 0.02, -20.5, 1, 0, 4.6, 37);

  const mesh = b.build();
  ctx.root.add(mesh);

  // "Est. 2024" plaque beside the door.
  const p = plaque(1.15, 0.6, textTexture(["LIBRARY", "Est. 2024"], { bg: "#c9b48a", fg: "#3a2a18", border: "#6a4a28", w: 384, h: 200 }), 0x6a4a28);
  p.position.set(S.libPlaque.x, 1.9, wallZ + 0.04);
  ctx.root.add(p);
}

// ---- Notebook Café (SW) ------------------------------------------------------------

function cafe(ctx: Ctx) {
  const b = new Baker();
  const canopies = [0xd0604a, 0x4a9a8a, 0xe0a040];
  S.cafeTables.forEach((t, i) => {
    b.at(t.x, 0, t.z, i * 0.7, () => {
      b.cyl(0.3, 0.34, 0.04, 10, IRON, 0, 0.02, 0);
      b.cyl(0.04, 0.04, 0.74, 6, IRON, 0, 0.39, 0);
      b.cyl(0.5, 0.5, 0.05, 12, 0xe8dcc4, 0, 0.77, 0);
      // Umbrella with alternating stripes.
      b.cyl(0.025, 0.025, 1.65, 6, 0xe8e0d0, 0, 1.55, 0);
      for (let k = 0; k < 8; k++) {
        b.add(new THREE.ConeGeometry(1.15, 0.45, 1, 1, false, (k * Math.PI) / 4, Math.PI / 4), k % 2 ? 0xf4ecd8 : canopies[i], 0, 2.32, 0);
      }
      b.sphere(0.05, 0xe8e0d0, 0, 2.58, 0);
      // A cup and a notebook on the table.
      b.cyl(0.05, 0.04, 0.09, 8, 0xf4f0e8, 0.18, 0.84, 0.05);
      b.box(0.22, 0.02, 0.3, i === 1 ? 0x3a5a8a : 0x8a3a3a, -0.15, 0.81, -0.05, 0, 0.3, 0);
      // Chairs.
      for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
        b.at(Math.sin(a) * 0.85, 0, Math.cos(a) * 0.85, a + Math.PI, () => {
          b.box(0.4, 0.05, 0.4, WOOD_L, 0, 0.46, 0);
          b.box(0.4, 0.4, 0.05, WOOD_L, 0, 0.7, -0.19);
          for (const sx of [-0.17, 0.17]) for (const sz of [-0.17, 0.17]) b.box(0.04, 0.46, 0.04, WOOD_D, sx, 0.23, sz);
        });
      }
    });
    ctx.solidCyl(t.x, t.z, 0.55, 0.9);
  });

  // Chalkboard A-frame (menu face added below).
  b.at(S.cafeBoard.x, 0, S.cafeBoard.z, BOARD_YAW, () => {
    for (const s of [-1, 1]) b.box(0.66, 1.0, 0.04, WOOD, 0, 0.5, s * 0.18, s * -0.2);
  });
  ctx.solidCyl(S.cafeBoard.x, S.cafeBoard.z, 0.4, 1.1);

  // Coffee-bean sacks against the south wall.
  b.at(S.cafeSacks.x, 0, S.cafeSacks.z, 0, () => {
    for (const [x, y, z, ry] of [[-0.5, 0.3, 0, 0.2], [0.42, 0.3, 0.05, -0.3], [-0.05, 0.78, 0.0, 0.5]]) {
      b.blob(0.36, 0xc8a878, x, y, z, 1, 0.85, 0.85, 1);
      b.cyl(0.08, 0.12, 0.14, 6, 0xb09060, x, y + 0.33, z, 0, ry);
      b.box(0.3, 0.16, 0.02, 0x6a4a28, x, y, z + 0.3);
    }
    b.box(0.5, 0.4, 0.5, WOOD, 0.95, 0.2, 0.05);
    for (let i = 0; i < 9; i++) b.blob(0.05, 0x4a2a18, 0.85 + (i % 3) * 0.1, 0.42, -0.05 + Math.floor(i / 3) * 0.1, 1, 0.6, 1.3);
  });
  ctx.solidBox(S.cafeSacks.x + 0.2, S.cafeSacks.z, 2.2, 0.8, 1.0);

  // Planters by the door.
  for (const z of [17.0, 21.0]) {
    const pot = fit("nature", "pot_small", 0.7);
    pot.position.set(-20.5, 0, z);
    ctx.root.add(pot);
    const bush = fit("nature", "plant_bushSmall", 0.5);
    bush.position.set(-20.5, 0.62, z);
    ctx.root.add(bush);
    ctx.solidCyl(-20.5, z, 0.35, 1.0);
  }

  // String-light poles.
  for (const p of S.cafePoles) {
    b.cyl(0.06, 0.08, 2.9, 6, WOOD_D, p.x, 1.45, p.z);
    b.box(0.2, 0.06, 0.2, IRON, p.x, 2.92, p.z);
    ctx.solidCyl(p.x, p.z, 0.12, 2.9);
  }
  ctx.root.add(b.build());

  // Menu face.
  const menu = canvasTexture(256, 384, (g, w, h) => {
    g.fillStyle = "#22302a";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#8a5a34";
    g.lineWidth = 12;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = "#f4f0e0";
    g.textAlign = "center";
    g.font = "700 34px Fraunces, Georgia, serif";
    g.fillText("Today", w / 2, 56);
    g.font = "600 21px Nunito, sans-serif";
    ["Espresso of Insight", "Reviewer Roast", "Camera-Ready", "Cold Brew", "Deadline Decaf"].forEach((s, i) => g.fillText(s, w / 2, 112 + i * 44));
    g.strokeStyle = "#f4f0e0";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(40, 112 + 4 * 44 - 7);
    g.lineTo(w - 40, 112 + 4 * 44 - 7);
    g.stroke();
    g.font = "600 18px Nunito, sans-serif";
    g.fillStyle = "#f0c860";
    g.fillText("(sold out)", w / 2, 112 + 5 * 44 - 8);
  });
  const face = plaque(0.56, 0.84, menu, 0x22302a, 0.02);
  const yaw = BOARD_YAW;
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  face.position.set(S.cafeBoard.x, 0.5, S.cafeBoard.z).addScaledVector(fwd, 0.205);
  face.rotation.set(0, yaw, 0);
  face.rotateX(-0.2);
  ctx.root.add(face);

  // String lights: café corner → poles → café wall.
  const anchors = [
    new THREE.Vector3(-21.0, 2.45, 22.95),
    ...S.cafePoles.map((p) => new THREE.Vector3(p.x, 2.88, p.z)),
    new THREE.Vector3(-24.2, 2.45, 22.95),
  ];
  const bulbPos: THREE.Vector3[] = [];
  const wirePts: number[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const c = anchors[i + 1];
    const n = Math.max(4, Math.round(a.distanceTo(c) / 0.6));
    const pts = sagLine(a, c, 0.45, n);
    for (let k = 0; k < pts.length - 1; k++) wirePts.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
    for (let k = 1; k < pts.length - 1; k++) bulbPos.push(pts[k].clone().add(new THREE.Vector3(0, -0.07, 0)));
  }
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute("position", new THREE.Float32BufferAttribute(wirePts, 3));
  ctx.root.add(new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0x2a2a2a })));
  addBulbs(ctx, bulbPos, [0xffd890, 0xffb860, 0xff9a9a, 0x9ae0d8, 0xfff0c0], 0.07);
  // One warm light for the patio.
  const pl = new THREE.PointLight(0xffc070, 0, 10, 1.6);
  pl.position.set(-16.6, 2.6, 24.6);
  ctx.root.add(pl);
  ctx.every(() => (pl.intensity = THREE.MathUtils.smoothstep(ctx.night(), 0.25, 0.75) * 6));
}

/** Instanced little bulbs that glow brighter at night. */
function addBulbs(ctx: Ctx, pos: THREE.Vector3[], colors: number[], r: number) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(r, 0), mat, pos.length);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  pos.forEach((p, i) => {
    mesh.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
    mesh.setColorAt(i, c.setHex(colors[i % colors.length]));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  ctx.root.add(mesh);
  ctx.every((_dt, t) => {
    const on = THREE.MathUtils.smoothstep(ctx.night(), 0.2, 0.7);
    mat.color.setScalar(0.5 + on * (1.1 + Math.sin(t * 2.3) * 0.05));
  });
}

// ---- Games Hall (SE) -------------------------------------------------------------------

function hall(ctx: Ctx) {
  const wallZ = 19 - (3 * 2.6) / 2; // north facade
  // Neon arcade sign over the door.
  const neonTex = canvasTexture(512, 160, (g, w, h) => {
    g.fillStyle = "#14102a";
    g.fillRect(0, 0, w, h);
    g.lineJoin = "round";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "900 92px 'Trebuchet MS', Nunito, sans-serif";
    g.shadowColor = "#ff4ad0";
    g.shadowBlur = 22;
    g.strokeStyle = "#ff7ae0";
    g.lineWidth = 7;
    g.strokeText("ARCADE", w / 2, h * 0.43);
    g.fillStyle = "#ffe0f8";
    g.fillText("ARCADE", w / 2, h * 0.43);
    g.shadowColor = "#3ae8ff";
    g.font = "800 30px Nunito, sans-serif";
    g.fillStyle = "#b8f8ff";
    g.fillText("★ INSERT CITATION ★", w / 2, h * 0.84);
    g.shadowBlur = 0;
    g.strokeStyle = "#3ae8ff";
    g.lineWidth = 5;
    g.strokeRect(8, 8, w - 16, h - 16);
  });
  const neon = plaque(3.2, 1.0, neonTex, 0x1a1428, 0.12, true);
  neon.position.set(25, 3.75, wallZ - 0.07);
  neon.rotation.y = Math.PI;
  ctx.root.add(neon);
  const light = new THREE.PointLight(0xff60d0, 0, 8, 1.8);
  light.position.set(25, 3.6, wallZ - 1.4);
  ctx.root.add(light);
  let flick = 0;
  let next = 3;
  ctx.every((dt, t) => {
    const on = 0.55 + THREE.MathUtils.smoothstep(ctx.night(), 0.15, 0.7) * 1.1;
    next -= dt;
    if (next <= 0) {
      flick = 0.12 + Math.random() * 0.25;
      next = 2 + Math.random() * 6;
    }
    let k = on * (0.95 + Math.sin(t * 40) * 0.03);
    if (flick > 0) {
      flick -= dt;
      k *= Math.sin(t * 90) > 0 ? 0.25 : 1;
    }
    setGlow(neon, k);
    light.intensity = k * THREE.MathUtils.smoothstep(ctx.night(), 0.2, 0.7) * 3.5;
  });

  // Posters on the ground floor.
  const posters: [string, string, string, string][] = [
    ["NIGHT SHIFT", "now playing inside", "#2a2050", "#ffd860"],
    ["HIGH SCORE", "R2 ....... 0 accepts", "#0f3a4a", "#7af0ff"],
  ];
  posters.forEach(([a, sub, bg, fg], i) => {
    const tex = canvasTexture(256, 360, (g, w, h) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      // Pixel stars.
      g.fillStyle = "rgba(255,255,255,0.6)";
      for (let k = 0; k < 40; k++) g.fillRect((k * 53) % w, (k * 97) % h, 4, 4);
      // A chunky pixel sprite.
      const px = 16;
      const sprite = i === 0 ? ["..XXXX..", ".XXXXXX.", "XX.XX.XX", "XXXXXXXX", ".X.XX.X.", "X......X"] : ["...XX...", "..XXXX..", ".XXXXXX.", "XX.XX.XX", "XXXXXXXX", "..X..X.."];
      g.fillStyle = fg;
      sprite.forEach((row, ry) => [...row].forEach((ch, rx) => ch === "X" && g.fillRect(w / 2 - 4 * px + rx * px, 150 + ry * px, px - 1, px - 1)));
      g.textAlign = "center";
      g.font = "900 38px 'Trebuchet MS', Nunito, sans-serif";
      g.fillText(a, w / 2, 70);
      g.font = "700 20px Nunito, sans-serif";
      g.fillStyle = "#ffffff";
      g.fillText(sub, w / 2, 300);
    });
    const p = plaque(0.9, 1.26, tex, 0x222222, 0.03);
    p.position.set(i === 0 ? 20.6 : 29.4, 1.45, wallZ - 0.025);
    p.rotation.y = Math.PI;
    ctx.root.add(p);
  });
}

// ---- Tavern (W) ------------------------------------------------------------------------

function tavern(ctx: Ctx) {
  const b = new Baker();
  const wallX = -42 + (3 * 2.6) / 2; // east facade
  const barrel = (x: number, y: number, z: number, lying = false) => {
    b.atR(x, y, z, lying ? Math.PI / 2 : 0, 0, 0, () => {
      b.cyl(0.4, 0.4, 0.95, 10, 0x9a6a3a, 0, 0, 0);
      b.cyl(0.43, 0.43, 0.42, 10, 0xa8784a, 0, 0, 0);
      for (const yy of [-0.36, 0, 0.36]) b.cyl(0.445, 0.445, 0.05, 10, IRON, 0, yy, 0);
      b.cyl(0.36, 0.36, 0.02, 10, 0x7a4a28, 0, 0.48, 0);
    });
  };
  barrel(-37.45, 0.48, -5.3);
  barrel(-37.45, 0.48, -6.3);
  barrel(-36.55, 0.48, -5.8);
  barrel(-37.45, 1.43, -5.8);
  ctx.solidCyl(-37.45, -5.3, 0.45, 1.0);
  ctx.solidCyl(-37.45, -6.3, 0.45, 1.0);
  ctx.solidCyl(-36.55, -5.8, 0.45, 1.0);

  // Bench along the wall.
  b.at(S.tavBench.x, 0, S.tavBench.z, S.tavBench.yaw, () => bakeBench(b));
  ctx.solidBox(S.tavBench.x, S.tavBench.z, 0.6, 1.8, 0.48);

  // Sign bracket and lantern bracket (the sign / lantern themselves swing / glow).
  b.box(1.3, 0.07, 0.07, IRON, wallX + 0.65, 3.35, 2.6);
  b.box(0.07, 0.6, 0.07, IRON, wallX + 0.05, 3.1, 2.6);
  b.box(0.06, 0.06, 0.6, IRON, wallX + 0.08, 2.5, -2.4, 0, 0, 0);
  b.box(0.35, 0.05, 0.05, IRON, wallX + 0.2, 2.55, -2.4);

  // Hay cart.
  b.at(S.hayCart.x, 0, S.hayCart.z, 0.3, () => {
    b.box(2.2, 0.12, 1.3, WOOD, 0, 0.75, 0);
    for (const sz of [-0.62, 0.62]) b.box(2.2, 0.35, 0.06, WOOD_D, 0, 0.98, sz);
    b.box(0.06, 0.35, 1.3, WOOD_D, -1.08, 0.98, 0);
    for (const sz of [-0.72, 0.72]) {
      b.cyl(0.42, 0.42, 0.08, 10, WOOD_D, 0.1, 0.42, sz, Math.PI / 2);
      b.cyl(0.08, 0.08, 0.12, 6, IRON, 0.1, 0.42, sz, Math.PI / 2);
    }
    for (const sz of [-0.4, 0.4]) b.box(1.4, 0.07, 0.07, WOOD_D, 1.75, 0.55, sz, 0, 0, -0.25);
    b.box(0.08, 0.08, 0.6, WOOD_D, 1.2, 0.72, 0);
    // Hay.
    b.box(1.0, 0.5, 0.6, 0xe0c060, -0.4, 1.05, -0.3, 0, 0.1, 0);
    b.box(1.0, 0.5, 0.6, 0xd8b850, 0.55, 1.05, 0.25, 0, -0.15, 0);
    b.box(0.9, 0.45, 0.55, 0xe8cc70, 0.05, 1.5, 0, 0, 0.3, 0);
    for (let i = 0; i < 10; i++) b.blob(0.18, i % 2 ? 0xe8cc70 : 0xd0b050, -0.9 + i * 0.2, 1.35 + (i % 3) * 0.12, (i % 2) * 0.4 - 0.2, 1.4, 0.5, 1);
    b.cyl(0.02, 0.02, 1.6, 4, WOOD_L, -0.6, 1.6, 0.45, 0.2, 0, 0.6);
  });
  ctx.solidBox(S.hayCart.x, S.hayCart.z, 2.8, 2.0, 1.9);

  ctx.root.add(b.build());

  // Hanging sign with a mug (swings gently).
  const sb = new Baker();
  sb.box(0.02, 0.35, 0.02, IRON, -0.35, -0.17, 0);
  sb.box(0.02, 0.35, 0.02, IRON, 0.35, -0.17, 0);
  sb.box(0.95, 0.65, 0.08, WOOD, 0, -0.67, 0);
  sb.box(1.0, 0.06, 0.1, WOOD_D, 0, -0.33, 0);
  sb.box(1.0, 0.06, 0.1, WOOD_D, 0, -1.0, 0);
  for (const s of [-1, 1]) {
    sb.cyl(0.13, 0.12, 0.3, 10, 0xe8b030, -0.05, -0.68, s * 0.06, Math.PI / 2);
    sb.blob(0.12, 0xfaf4e8, -0.05, -0.53, s * 0.07, 1.2, 0.6, 0.4);
    sb.torus(0.08, 0.025, 0xe8b030, 0.12, -0.68, s * 0.06);
  }
  const sign = sb.build();
  const pivot = new THREE.Group();
  pivot.position.set(wallX + 1.0, 3.32, 2.6);
  pivot.rotation.y = 0.3;
  pivot.add(sign);
  ctx.root.add(pivot);
  ctx.every((_dt, t) => (sign.rotation.x = Math.sin(t * 1.3) * 0.06 + Math.sin(t * 0.7) * 0.03));

  // Wall lantern by the door.
  const lb = new Baker();
  lb.box(0.26, 0.04, 0.26, IRON, 0, 0.2, 0);
  lb.box(0.3, 0.05, 0.3, IRON, 0, -0.18, 0);
  for (const sx of [-0.12, 0.12]) for (const sz of [-0.12, 0.12]) lb.box(0.025, 0.36, 0.025, IRON, sx, 0, sz);
  lb.cone(0.2, 0.18, 4, IRON, 0, 0.3, 0, 0, Math.PI / 4);
  const lantern = lb.build();
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb050, emissiveIntensity: 0.4, transparent: true, opacity: 0.9 }));
  const lpos = new THREE.Vector3(wallX + 0.38, 2.28, -2.4);
  lantern.position.copy(lpos);
  glass.position.copy(lpos);
  ctx.root.add(lantern, glass);
  const glow = glowSprite(ctx.glowTex, 0xffb860, 1.5);
  glow.position.copy(lpos);
  ctx.root.add(glow);
  ctx.every((_dt, t) => {
    const on = THREE.MathUtils.smoothstep(ctx.night(), 0.2, 0.7);
    const f = 0.9 + Math.sin(t * 7.3) * 0.06 + Math.sin(t * 13.1) * 0.04;
    setGlow(glass, 0.3 + on * 1.4 * f);
    glow.material.opacity = on * 0.85 * f;
  });
}

// ---- The Archive (N) ---------------------------------------------------------------------

function archive(ctx: Ctx) {
  const b = new Baker();
  const z = -36.9;
  const cols = [-8.2, -5.8, -3.4, 3.4, 5.8, 8.2];
  for (const x of cols) {
    b.box(0.92, 0.26, 0.92, STONE_D, x, 0.13, z);
    b.cyl(0.3, 0.35, 3.9, 10, 0xe4ddd0, x, 2.21, z);
    b.box(0.86, 0.24, 0.86, STONE, x, 4.28, z);
    ctx.solidCyl(x, z, 0.46, 4.4);
  }
  // Entablature, cornice and a pediment.
  b.box(17.8, 0.5, 1.2, 0xe4ddd0, 0, 4.65, z - 0.15);
  b.box(18.3, 0.16, 1.4, STONE, 0, 4.98, z - 0.15);
  b.prism(8.4, 1.6, 0.9, 0xe4ddd0, 0, 5.06, z - 0.2);
  b.prism(7.6, 1.3, 0.92, STONE, 0, 5.18, z - 0.2);
  b.blob(0.32, BRASS, 0, 5.75, z + 0.27, 1, 1, 0.3);
  // Steps in front of the portico (flat enough to walk over).
  b.box(17.4, 0.12, 0.7, STONE_D, 0, 0.06, z + 0.75);
  // Banners between columns.
  for (const x of [-7.0, -4.6, 4.6, 7.0]) {
    b.box(0.08, 0.08, 0.1, IRON, x, 4.36, z + 0.45);
    b.box(0.95, 2.0, 0.04, 0x34548e, x, 3.32, z + 0.47);
    b.box(0.95, 0.12, 0.05, 0xd8b050, x, 4.26, z + 0.47);
    b.box(0.95, 0.08, 0.05, 0xd8b050, x, 2.36, z + 0.47);
    b.box(0.34, 0.34, 0.05, 0xd8b050, x, 3.45, z + 0.48, 0, 0, Math.PI / 4);
    b.box(0.2, 0.2, 0.06, 0x34548e, x, 3.45, z + 0.49, 0, 0, Math.PI / 4);
    b.atR(x, 2.33, z + 0.47, 0, 0, Math.PI, () => b.prism(0.95, 0.3, 0.04, 0x34548e));
  }
  // Stone lions on plinths, facing the plaza.
  for (const l of S.lions) {
    b.at(l.x, 0, l.z, 0, () => {
      b.box(1.3, 0.9, 1.3, STONE_D, 0, 0.45, 0);
      b.box(1.4, 0.1, 1.4, STONE, 0, 0.95, 0);
      b.at(0, 1.0, 0, 0, () => {
        b.box(0.62, 0.5, 0.8, STONE, 0, 0.25, -0.12);
        b.box(0.5, 0.75, 0.42, STONE, 0, 0.5, 0.2, -0.2);
        for (const sx of [-0.15, 0.15]) b.box(0.14, 0.5, 0.16, STONE, sx, 0.25, 0.42);
        b.blob(0.42, STONE_D, 0, 1.0, 0.3, 1, 1, 0.8, 1);
        b.blob(0.27, STONE, 0, 1.02, 0.5, 1, 1, 0.9, 1);
        b.box(0.18, 0.12, 0.14, STONE, 0, 0.94, 0.72);
        for (const sx of [-0.2, 0.2]) b.blob(0.08, STONE, sx, 1.26, 0.42);
        b.cyl(0.04, 0.05, 0.6, 5, STONE, 0.3, 0.35, -0.5, 0.6, 0, -0.5);
        b.blob(0.09, STONE_D, 0.42, 0.62, -0.68);
      });
    });
    ctx.solidBox(l.x, l.z, 1.35, 1.35, 2.3);
  }
  ctx.root.add(b.build());

  // Obelisks.
  for (const o of S.obelisks) {
    const ob = fit("nature", "statue_obelisk", 4.2);
    ob.position.set(o.x, 0, o.z);
    ctx.root.add(ob);
    ctx.solidCyl(o.x, o.z, 0.7, 4);
  }

  // MUSEUM plaque on the entablature.
  const tex = textTexture(["MUSEUM · THE ARCHIVE", "est. MMXXIV · drafts, rejections & revisions"], { w: 1024, h: 96, bg: "#e4ddd0", fg: "#5a4a30", sizes: [44, 22] });
  const p = plaque(5.2, 0.44, tex, 0xe4ddd0, 0.04);
  p.position.set(0, 4.65, z + 0.47);
  ctx.root.add(p);
}

// ---- PCG Tower (NE) ------------------------------------------------------------------------

function tower(ctx: Ctx) {
  const b = new Baker();
  const x0 = 30.4;
  const x1 = 31.8;
  const zs = [-37.3, -34.0, -30.7];
  const POLE = 0x7a6a58;
  for (const x of [x0, x1]) for (const zz of zs) b.box(0.1, 8.2, 0.1, POLE, x, 4.1, zz);
  for (const y of [2.6, 5.2, 7.8]) {
    b.box(1.6, 0.07, 6.9, WOOD_L, (x0 + x1) / 2, y, -34.0);
    b.box(0.08, 0.08, 6.7, POLE, x0, y + 0.5, -34.0);
    for (const zz of zs) b.box(1.5, 0.08, 0.08, POLE, (x0 + x1) / 2, y - 0.04, zz);
  }
  // Cross braces on the outer face.
  for (let lvl = 0; lvl < 3; lvl++) {
    for (let k = 0; k < 2; k++) {
      const zc = (zs[k] + zs[k + 1]) / 2;
      b.box(0.06, 4.1, 0.06, POLE, x0 - 0.04, lvl * 2.6 + 1.3, zc, (k + lvl) % 2 ? 0.9 : -0.9);
    }
  }
  // Ladder on the south end.
  for (const dx of [0.35, 0.95]) b.box(0.06, 7.9, 0.06, WOOD_D, x0 + dx, 3.95, -30.55);
  for (let y = 0.4; y < 7.8; y += 0.4) b.box(0.66, 0.05, 0.05, WOOD_D, x0 + 0.65, y, -30.55);
  // Pulley, rope and bucket.
  b.box(1.4, 0.08, 0.08, WOOD_D, x0 - 0.5, 8.1, -35.5);
  b.box(0.02, 4.5, 0.02, 0xd8c8a0, x0 - 1.15, 5.85, -35.5);
  b.cyl(0.18, 0.14, 0.28, 8, 0x8a7050, x0 - 1.15, 3.5, -35.5);
  // Logs at the foot.
  ctx.root.add(b.build());
  ctx.solidBox((x0 + x1) / 2, -34.0, 1.8, 7.0, 8.2);
  const logs = fit("nature", "log_stack", 0.9);
  logs.position.set(30.0, 0, -27.8);
  logs.rotation.y = 0.4;
  ctx.root.add(logs);
  ctx.solidCyl(30.0, -27.8, 0.7, 0.9);

  // GPU queue sign on the scaffold.
  const gpu = plaque(1.3, 0.75, textTexture(["GPU QUEUE", "you are #38", "est. wait: one PhD"], { w: 384, h: 220, bg: "#f0e8c8", fg: "#3a2a18", border: "#c05030", sizes: [52, 34, 26] }), 0x7a6a58);
  gpu.position.set((x0 + x1) / 2, 1.35, -30.6);
  ctx.root.add(gpu);

  // Floating rune stone orbiting the top.
  const rb = new Baker();
  rb.add(new THREE.OctahedronGeometry(0.55, 0), 0x6a58b8, 0, 0, 0, 0, 0, 0, 0.8, 1.4, 0.8);
  const rune = rb.build(false);
  const runeGlow = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.2, 0),
    new THREE.MeshStandardMaterial({ color: 0xd8c8ff, emissive: 0x8a6aff, emissiveIntensity: 1.2 }),
  );
  rune.add(runeGlow);
  runeGlow.position.set(0, 0, 0.3);
  const halo = glowSprite(ctx.glowTex, 0xa080ff, 2.6);
  ctx.root.add(rune, halo);
  const shards = [0, 1, 2].map(() => {
    const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: 0xc8b8ff, emissive: 0x6a4ad0, emissiveIntensity: 0.9 }));
    ctx.root.add(s);
    return s;
  });
  ctx.every((_dt, t) => {
    const a = t * 0.35;
    rune.position.set(36 + Math.cos(a) * 5.4, 13.6 + Math.sin(t * 1.1) * 0.5, -34 + Math.sin(a) * 5.4);
    rune.rotation.y = t * 0.8;
    halo.position.copy(rune.position);
    halo.material.opacity = 0.35 + ctx.night() * 0.45 + Math.sin(t * 2) * 0.08;
    shards.forEach((s, i) => {
      const k = t * 1.6 + (i * Math.PI * 2) / 3;
      s.position.set(rune.position.x + Math.cos(k) * 1.1, rune.position.y + Math.sin(k * 1.3) * 0.4, rune.position.z + Math.sin(k) * 1.1);
      s.rotation.set(t * 2, t * 1.5, 0);
    });
  });
}

// ---- Plaza ------------------------------------------------------------------------------

function plaza(ctx: Ctx) {
  const b = new Baker();
  // Bunting poles with little lantern heads.
  const tops: THREE.Vector3[] = [];
  for (const p of S.poles) {
    b.cyl(0.06, 0.09, 4.2, 6, 0x4a3a30, p.x, 2.1, p.z);
    b.cyl(0.14, 0.16, 0.12, 6, 0x4a3a30, p.x, 0.06, p.z);
    b.box(0.2, 0.22, 0.2, 0xe8d8a0, p.x, 4.32, p.z);
    b.cone(0.18, 0.16, 4, 0x4a3a30, p.x, 4.51, p.z, 0, Math.PI / 4);
    ctx.solidCyl(p.x, p.z, 0.12, 4.2);
    // Rope sags to ~3.5 m: clear of the welcome sign and market stalls.
    tops.push(new THREE.Vector3(p.x, 4.02, p.z));
  }
  const flagColors = [0xd0504a, 0xf0c040, 0x4aa0a0, 0xf4ecd8, 0x7a5ab0, 0x5aa05a];
  const rope: number[] = [];
  let fi = 0;
  for (let i = 0; i < tops.length - 1; i++) {
    const a = tops[i];
    const c = tops[i + 1];
    const n = Math.max(6, Math.round(a.distanceTo(c) / 0.42));
    const pts = sagLine(a, c, 0.5, n);
    for (let k = 0; k < pts.length - 1; k++) rope.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
    const ry = Math.atan2(-(c.z - a.z), c.x - a.x);
    for (let k = 1; k < pts.length - 1; k++) {
      const p = pts[k];
      b.atR(p.x, p.y, p.z, 0, ry, Math.PI, () => b.prism(0.3, 0.38, 0.012, flagColors[fi++ % flagColors.length]));
    }
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute("position", new THREE.Float32BufferAttribute(rope, 3));
  ctx.root.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x5a4a3a })));
  // Pole lantern glow at night (sprites only, no extra lights).
  const glows = tops.map((p) => {
    const g = glowSprite(ctx.glowTex, 0xffc070, 1.3);
    g.position.set(p.x, 4.32, p.z);
    ctx.root.add(g);
    return g;
  });
  ctx.every((_dt, t) => {
    const on = THREE.MathUtils.smoothstep(ctx.night(), 0.2, 0.7);
    glows.forEach((g, i) => (g.material.opacity = on * (0.8 + Math.sin(t * 3 + i) * 0.08)));
  });

  // Flower beds.
  const flowers: Record<string, Placement[]> = { flower_redA: [], flower_yellowA: [], flower_purpleA: [], flower_yellowB: [] };
  const names = Object.keys(flowers);
  let n = 0;
  for (const bed of S.beds) {
    b.at(bed.x, 0, bed.z, bed.yaw, () => {
      b.box(2.4, 0.3, 1.1, 0x6a4a30, 0, 0.15, 0);
      for (const sz of [-0.55, 0.55]) b.box(2.5, 0.36, 0.14, STONE, 0, 0.18, sz);
      for (const sx of [-1.2, 1.2]) b.box(0.14, 0.36, 1.24, STONE, sx, 0.18, 0);
    });
    const tx = Math.cos(bed.yaw);
    const tz = -Math.sin(bed.yaw);
    for (let i = 0; i < 9; i++) {
      const along = -0.95 + (i % 5) * 0.48 + (i >= 5 ? 0.24 : 0);
      const across = i >= 5 ? 0.22 : -0.2;
      flowers[names[n++ % names.length]].push({ x: bed.x + tx * along - tz * across, y: 0.3, z: bed.z + tz * along + tx * across, rotY: i * 1.7, scale: 1.7 + (i % 3) * 0.2 });
    }
    ctx.solidCyl(bed.x + tx * 0.6, bed.z + tz * 0.6, 0.6, 0.5);
    ctx.solidCyl(bed.x - tx * 0.6, bed.z - tz * 0.6, 0.6, 0.5);
  }
  for (const name of names) if (hasModel("nature", name)) ctx.root.add(instanced("nature", name, flowers[name], 1, false));
  ctx.root.add(b.build());
}

// ---- Notice board & portal ------------------------------------------------------------------

function noticeAndPortal(ctx: Ctx) {
  const b = new Baker();
  // Lost & found crate with paper stacks beside the notice board.
  b.at(S.lostFound.x, 0, S.lostFound.z, -0.5, () => {
    b.box(0.8, 0.6, 0.6, WOOD, 0, 0.3, 0);
    for (const y of [0.15, 0.45]) b.box(0.82, 0.06, 0.62, WOOD_D, 0, y, 0);
    let y = 0.6;
    for (let i = 0; i < 6; i++) {
      b.box(0.32, 0.025, 0.42, i % 2 ? 0xfaf6ea : 0xf0e8d0, -0.18, y + 0.0125, 0, 0, (i - 3) * 0.08, 0);
      y += 0.025;
    }
    b.box(0.32, 0.03, 0.42, 0xfff3c0, 0.2, 0.615, 0.05, 0, 0.5, 0);
    b.cyl(0.06, 0.05, 0.12, 8, 0xc05030, 0.22, 0.69, -0.12);
    b.torus(0.04, 0.014, 0xc05030, 0.29, 0.69, -0.12);
    b.cyl(0.04, 0.04, 0.5, 6, 0xe8e0c8, 0.05, 0.66, 0.2, 0, 0.3, Math.PI / 2);
    // A paper that blew onto the grass.
    b.box(0.3, 0.01, 0.4, 0xfaf6ea, 0.7, 0.005, 0.5, 0, 0.7, 0);
  });
  ctx.solidCyl(S.lostFound.x, S.lostFound.z, 0.5, 0.75);
  const lf = plaque(0.62, 0.22, textTexture(["LOST & FOUND"], { w: 256, h: 80, bg: "#f4ecd8", fg: "#5a3a20", sizes: [36] }), WOOD_D, 0.02);
  const yaw = -0.5;
  lf.position.set(S.lostFound.x + Math.sin(yaw) * 0.32, 0.36, S.lostFound.z + Math.cos(yaw) * 0.32);
  lf.rotation.y = yaw;
  ctx.root.add(lf);

  // Stepping stones that wander off behind the portal.
  const stones: [number, number, number][] = [[39.7, 1.0, 0.5], [41.1, 0.2, 0.42], [42.6, 0.9, 0.46], [44.0, 0.1, 0.38], [45.2, 0.8, 0.3]];
  stones.forEach(([x, z, r], i) => b.cyl(r, r * 1.1, 0.1, 7, i % 2 ? 0xa8a49a : 0x9a968c, x, 0.04, z, 0, i));
  ctx.root.add(b.build(false));

  // Glowing pebbles ringing the portal base.
  const gb = new Baker();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI) < 0.5 || Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) + Math.PI) < 0.5) continue;
    gb.add(new THREE.OctahedronGeometry(0.1, 0), i % 2 ? 0xb8a0ff : 0x8ae8ff, 36 + Math.cos(a) * 3.3, 0.1, 1 + Math.sin(a) * 3.3, 0, a, 0.3);
  }
  const pebbles = gb.build(false);
  pebbles.material = new THREE.MeshBasicMaterial({ vertexColors: true });
  ctx.root.add(pebbles);
}
