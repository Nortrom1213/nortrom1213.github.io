import * as THREE from "three";
import type { Stage } from "../../core/stage";
import { instanced, type Placement } from "../../core/assets";
import { flatMat } from "../../actors/chibi";
import { labelPlane } from "../../interiors/room";
import { COLS, ROWS, X0, Z0, type Grid } from "./grid";
import { rampColor } from "./heatmap";

// Night-time museum floor built from the occupancy grid: partitions, glass cabinets,
// statues, archive shelves and plants all come from the same PLAN the guards use.
// Repeated pieces are InstancedMeshes so the whole hall is a few dozen draw calls.

export const FURNITURE = ["pottedPlant", "bookcaseClosedWide", "rugRectangle", "lampRoundFloor"];

const WALL_H = 1.8;
const OUTER_H = 3.0;
const DOOR_HALF = 1.1;

export interface ArchiveScenery {
  /** The manuscript on its lectern (hidden while carried). */
  book: THREE.Group;
  bookLight: THREE.PointLight;
  beam: THREE.Mesh;
  exitGlow: THREE.MeshBasicMaterial;
  /** Light pools, for a gentle flicker. */
  pools: THREE.InstancedMesh;
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function floorTexture(): THREE.CanvasTexture {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = "#1c2030";
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        const dark = (x + y) % 2 === 0;
        g.fillStyle = dark ? "#2b3044" : "#363c54";
        g.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
        // Faint marble veins.
        g.strokeStyle = dark ? "rgba(120,130,170,0.12)" : "rgba(160,170,210,0.14)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x * 128 + 10, y * 128 + 20 + Math.random() * 80);
        g.bezierCurveTo(x * 128 + 50, y * 128 + Math.random() * 128, x * 128 + 80, y * 128 + Math.random() * 128, x * 128 + 120, y * 128 + 30 + Math.random() * 80);
        g.stroke();
      }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(COLS / 2, ROWS / 2);
  t.anisotropy = 4;
  return t;
}

function poolTexture(): THREE.CanvasTexture {
  return canvasTex(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.45, "rgba(255,255,255,0.45)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  });
}

/** A small abstract canvas: the museum hangs potential-field "paintings". */
function paintingTexture(seed: number): THREE.CanvasTexture {
  return canvasTex(160, 112, (g) => {
    const col = new THREE.Color();
    g.fillStyle = "#0b0f22";
    g.fillRect(0, 0, 160, 112);
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const blobs = Array.from({ length: 4 }, () => ({ x: rnd() * 160, y: rnd() * 112, r: 30 + rnd() * 50, v: 0.4 + rnd() * 0.6 }));
    for (let y = 0; y < 112; y += 8)
      for (let x = 0; x < 160; x += 8) {
        let v = 0;
        for (const b of blobs) v += b.v * Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (b.r * b.r));
        rampColor(Math.min(1, v), col);
        g.fillStyle = `#${col.getHexString(THREE.SRGBColorSpace)}`;
        g.fillRect(x + 1, y + 1, 6, 6);
      }
  });
}

export function buildScenery(stage: Stage, grid: Grid, quality: "high" | "low"): ArchiveScenery {
  const scene = stage.scene;
  const world = stage.world;
  const W = COLS;
  const D = ROWS;
  scene.background = new THREE.Color(0x0a0d18);

  // ---- Floor ----------------------------------------------------------------------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.55, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  // Red runner from the gallery doorways to the lectern, and a rug in the hall.
  const runnerMat = new THREE.MeshStandardMaterial({ color: 0x6a1e2a, roughness: 0.95 });
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5.4), runnerMat);
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(0, 0.012, -6.3);
  runner.receiveShadow = true;
  scene.add(runner);
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.6 });
  for (const sx of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 5.4), trimMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(sx * 1.16, 0.014, -6.3);
    scene.add(edge);
  }

  // ---- Outer walls (cut away when the camera is behind them) ------------------------
  const outerMat = new THREE.MeshStandardMaterial({ color: 0x39435e, roughness: 0.9 });
  const capMat = flatMat(0x5e3a20);
  const T = 0.4;
  const mkWall = (sx: number, sz: number, x: number, z: number, normal: THREE.Vector3, gap = 0) => {
    const grp = new THREE.Group();
    const pieces: [number, number][] = gap ? [[-(sx / 2 + gap) / 2, sx / 2 - gap], [(sx / 2 + gap) / 2, sx / 2 - gap]] : [[0, sx]];
    for (const [off, len] of pieces) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, OUTER_H, sz), outerMat);
      m.position.set(x + off, OUTER_H / 2, z);
      m.receiveShadow = true;
      grp.add(m);
      const base = new THREE.Mesh(new THREE.BoxGeometry(len + 0.02, 0.22, sz + 0.04), capMat);
      base.position.set(x + off, 0.11, z);
      grp.add(base);
      world.addBox(x + off, z, len, sz, 0, OUTER_H, { noCamera: true });
    }
    scene.add(grp);
    stage.addCutawayWall(grp, normal, new THREE.Vector3(x, 0, z));
    return grp;
  };
  const north = mkWall(W + 2 * T, T, 0, -D / 2 - T / 2, new THREE.Vector3(0, 0, -1));
  const south = mkWall(W + 2 * T, T, 0, D / 2 + T / 2, new THREE.Vector3(0, 0, 1), DOOR_HALF);
  // Side walls are built along x then rotated by swapping dimensions.
  const west = new THREE.Group();
  const east = new THREE.Group();
  for (const [grp, sx] of [[west, -1], [east, 1]] as const) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(T, OUTER_H, D), outerMat);
    m.position.set(sx * (W / 2 + T / 2), OUTER_H / 2, 0);
    m.receiveShadow = true;
    const base = new THREE.Mesh(new THREE.BoxGeometry(T + 0.04, 0.22, D), capMat);
    base.position.set(sx * (W / 2 + T / 2), 0.11, 0);
    grp.add(m, base);
    scene.add(grp);
    stage.addCutawayWall(grp, new THREE.Vector3(sx, 0, 0), new THREE.Vector3(sx * (W / 2), 0, 0));
    world.addBox(sx * (W / 2 + T / 2), 0, T, D + 2, 0, OUTER_H, { noCamera: true });
  }
  world.boundsRect = { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 };

  // Paintings on the inner faces.
  const frameMat = flatMat(0x8a6a2a);
  const hang = (parent: THREE.Group, x: number, z: number, rotY: number, seed: number) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.05), new THREE.MeshBasicMaterial({ map: paintingTexture(seed) }));
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.25, 0.06), frameMat);
    const g = new THREE.Group();
    g.add(f, p);
    p.position.z = 0.035;
    g.position.set(x, 2.15, z);
    g.rotation.y = rotY;
    parent.add(g);
  };
  [-9, -4.5, 4.5, 9].forEach((x, i) => hang(north, x, -D / 2 + 0.03, 0, i + 1));
  [-6, 4].forEach((z, i) => {
    hang(west, -W / 2 + 0.03, z, Math.PI / 2, 10 + i);
    hang(east, W / 2 - 0.03, z, -Math.PI / 2, 20 + i);
  });
  const title = labelPlane([{ text: "The Archive", size: 64 }, { text: "Hall of Guard AI", size: 30, font: "600 30px Nunito, sans-serif", color: "#e8c870" }], 640, 190, "#2a2030", 3.2);
  title.position.set(0, 2.3, -D / 2 + 0.04);
  north.add(title);

  // ---- Entrance --------------------------------------------------------------------
  const frame = new THREE.Group();
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.8, 0.5), capMat);
    post.position.set(sx * (DOOR_HALF + 0.11), 1.4, D / 2);
    frame.add(post);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(DOOR_HALF * 2 + 0.44, 0.22, 0.5), capMat);
  head.position.set(0, 2.8, D / 2);
  frame.add(head);
  const night = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_HALF * 2, 2.7), new THREE.MeshBasicMaterial({ color: 0x1c2a52 }));
  night.position.set(0, 1.35, D / 2 + T);
  night.rotation.y = Math.PI;
  frame.add(night);
  south.add(frame);
  const exitGlow = new THREE.MeshBasicMaterial({ color: 0x3ad6a0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const exitPad = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_HALF * 2 + 0.6, 1.6), exitGlow);
  exitPad.rotation.x = -Math.PI / 2;
  exitPad.position.set(0, 0.02, D / 2 - 0.8);
  scene.add(exitPad);
  const exitLabel = labelPlane([{ text: "EXIT", size: 70, color: "#bff5dc" }], 256, 96, "#173a32", 1.3);
  exitLabel.rotation.x = -Math.PI / 2;
  exitLabel.position.set(0, 0.025, D / 2 - 1.95);
  scene.add(exitLabel);

  // ---- Partitions from wall runs -------------------------------------------------
  const wallBoxes: { x: number; z: number; sx: number; sz: number }[] = [];
  const isWall = (i: number, j: number) => i >= 0 && j >= 0 && i < COLS && j < ROWS && grid.kind[j * COLS + i] === "#";
  const used = new Uint8Array(grid.n);
  const TH = 0.6;
  const edgeOrInset = (k: number, max: number, lo: boolean) => (lo ? (k === 0 ? 0 : k + 0.5 - TH / 2) : k === max - 1 ? max : k + 0.5 + TH / 2);
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      if (!isWall(i, j) || isWall(i - 1, j)) continue;
      let e = i;
      while (isWall(e + 1, j)) e++;
      if (e > i) {
        const a = edgeOrInset(i, COLS, true);
        const b = edgeOrInset(e, COLS, false);
        wallBoxes.push({ x: X0 + (a + b) / 2, z: Z0 + j + 0.5, sx: b - a, sz: TH });
        for (let k = i; k <= e; k++) used[j * COLS + k] = 1;
      }
    }
  }
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      if (!isWall(i, j) || isWall(i, j - 1)) continue;
      let e = j;
      while (isWall(i, e + 1)) e++;
      if (e > j) {
        const a = edgeOrInset(j, ROWS, true);
        const b = edgeOrInset(e, ROWS, false);
        wallBoxes.push({ x: X0 + i + 0.5, z: Z0 + (a + b) / 2, sx: TH, sz: b - a });
        for (let k = j; k <= e; k++) used[k * COLS + i] = 1;
      }
    }
  }
  for (let c = 0; c < grid.n; c++) {
    if (grid.kind[c] === "#" && !used[c]) wallBoxes.push({ x: grid.cx(c), z: grid.cz(c), sx: TH, sz: TH });
  }
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const wallMesh = new THREE.InstancedMesh(unitBox, new THREE.MeshStandardMaterial({ color: 0xd9ccb0, roughness: 0.9 }), wallBoxes.length);
  const wallCap = new THREE.InstancedMesh(unitBox, flatMat(0x6a4428), wallBoxes.length);
  const m4 = new THREE.Matrix4();
  wallBoxes.forEach((b, k) => {
    m4.makeScale(b.sx, WALL_H, b.sz).setPosition(b.x, WALL_H / 2, b.z);
    wallMesh.setMatrixAt(k, m4);
    m4.makeScale(b.sx + 0.08, 0.1, b.sz + 0.08).setPosition(b.x, WALL_H + 0.05, b.z);
    wallCap.setMatrixAt(k, m4);
    world.addBox(b.x, b.z, b.sx, b.sz, 0, WALL_H, { noCamera: true });
  });
  for (const im of [wallMesh, wallCap]) {
    im.castShadow = true;
    im.receiveShadow = true;
    scene.add(im);
  }

  // ---- Cabinets, statues, shelves, plants, lectern -----------------------------------
  const cells = (ch: string) => [...Array(grid.n).keys()].filter((c) => grid.kind[c] === ch);
  const cabinets = cells("C");
  const statues = cells("p");
  const instancedBoxes = (list: number[], geo: THREE.BufferGeometry, mat: THREE.Material, y: number, shadow = true) => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    im.count = list.length;
    list.forEach((c, k) => {
      m4.makeTranslation(grid.cx(c), y, grid.cz(c));
      im.setMatrixAt(k, m4);
    });
    im.castShadow = shadow;
    im.receiveShadow = true;
    scene.add(im);
    return im;
  };
  // Glass display cabinets with a little golden artefact inside.
  instancedBoxes(cabinets, new THREE.BoxGeometry(0.92, 0.7, 0.92), flatMat(0x4a2e1c), 0.35);
  instancedBoxes(cabinets, new THREE.BoxGeometry(0.94, 0.08, 0.94), flatMat(0x2e1c12), 1.76);
  instancedBoxes(cabinets, new THREE.IcosahedronGeometry(0.2, 0), flatMat(0xe8b84a, { emissive: 0x6a4410, rough: 0.4 }), 1.0);
  const glass = instancedBoxes(
    cabinets,
    new THREE.BoxGeometry(0.86, 1.02, 0.86),
    new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x24405a, transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false }),
    1.21,
    false,
  );
  glass.renderOrder = 1;
  for (const c of cabinets) world.addBox(grid.cx(c), grid.cz(c), 0.92, 0.92, 0, 1.8);

  // Marble busts on plinths.
  const marble = flatMat(0xe9e3d6, { rough: 0.6 });
  instancedBoxes(statues, new THREE.BoxGeometry(0.78, 1.0, 0.78), flatMat(0x8a8494), 0.5);
  instancedBoxes(statues, new THREE.CylinderGeometry(0.2, 0.32, 0.46, 7), marble, 1.23);
  instancedBoxes(statues, new THREE.IcosahedronGeometry(0.2, 0), marble, 1.64);
  for (const c of statues) world.addBox(grid.cx(c), grid.cz(c), 0.78, 0.78, 0, 1.9);

  // Archive shelves (pairs of B cells) and plants / lamps (t cells).
  const shelves: Placement[] = [];
  for (let c = 0; c < grid.n; c++) {
    if (grid.kind[c] === "B" && grid.kind[c - 1] !== "B") {
      shelves.push({ x: grid.cx(c) + 0.5, z: grid.cz(c) - 0.1 });
      world.addBox(grid.cx(c) + 0.5, grid.cz(c), 2, 0.8, 0, 2.2);
    }
  }
  scene.add(instanced("furniture", "bookcaseClosedWide", shelves, 2.4));
  const plants: Placement[] = [];
  const lamps: Placement[] = [];
  for (const c of cells("t")) {
    const lamp = grid.row(c) >= 17 && (c % COLS === 0 || c % COLS === COLS - 1);
    (lamp ? lamps : plants).push({ x: grid.cx(c), z: grid.cz(c), rotY: (c * 1.7) % 6.28 });
    world.addCylinder(grid.cx(c), grid.cz(c), 0.32, 0, 1.6);
  }
  scene.add(instanced("furniture", "pottedPlant", plants, 2.6));
  scene.add(instanced("furniture", "lampRoundFloor", lamps, 2.6));
  scene.add(instanced("furniture", "rugRectangle", [{ x: 0, z: 7.6, rotY: Math.PI / 2 }], 4.4, false));

  // The lectern and the manuscript.
  const lx = 0;
  const lz = Z0 + 2.5;
  const lectern = new THREE.Group();
  const wood = flatMat(0x5a3820);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 0.7), wood);
  body.position.y = 0.475;
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.8), flatMat(0x3e2614));
  top.position.y = 1.0;
  top.rotation.x = 0.18;
  lectern.add(body, top);
  lectern.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  lectern.position.set(lx, 0, lz);
  scene.add(lectern);
  world.addBox(lx, lz, 1.6, 0.8, 0, 1.05);
  const book = new THREE.Group();
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.04, 0.5), flatMat(0x7a1e2a));
  const pageMat = flatMat(0xfff2c8, { emissive: 0xd0902a });
  for (const sx of [-1, 1]) {
    const page = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.04, 0.46), pageMat);
    page.position.set(sx * 0.175, 0.035, 0);
    page.rotation.z = -sx * 0.08;
    book.add(page);
  }
  book.add(cover);
  book.position.set(lx, 1.1, lz);
  book.rotation.x = 0.18;
  scene.add(book);
  const plaque = labelPlane([{ text: "Original manuscript", size: 34 }, { text: "Composite Potential Fields", size: 26, font: "600 26px Nunito, sans-serif", color: "#e8c870" }], 512, 130, "#2a1a10", 1.5);
  plaque.rotation.x = -Math.PI / 2;
  plaque.position.set(lx, 0.02, lz + 1.15);
  scene.add(plaque);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 1.3, 4.2, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.position.set(lx, 2.1, lz);
  beam.renderOrder = 5;
  scene.add(beam);

  // ---- Light ---------------------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0x5a70b8, 0x161a26, 0.75));
  const moon = new THREE.DirectionalLight(0x9ab0ff, 0.7);
  moon.position.set(-8, 22, 10);
  if (quality === "high") {
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    const sc = moon.shadow.camera;
    sc.left = -W / 2 - 2;
    sc.right = W / 2 + 2;
    sc.top = D / 2 + 2;
    sc.bottom = -D / 2 - 2;
    sc.far = 60;
    moon.shadow.bias = -0.0008;
    moon.shadow.normalBias = 0.03;
  }
  scene.add(moon);
  const bookLight = new THREE.PointLight(0xffc46a, 14, 9, 1.6);
  bookLight.position.set(lx, 2.6, lz + 0.4);
  scene.add(bookLight);
  const warm: [number, number][] = quality === "high" ? [[0, 0.5], [-10.5, 0], [10.5, 0], [0, 8]] : [[0, 3]];
  for (const [x, z] of warm) {
    const l = new THREE.PointLight(0xffb066, quality === "high" ? 7 : 10, 10, 1.6);
    l.position.set(x, 2.8, z);
    scene.add(l);
  }

  // Warm light pools under every exhibit (fake spotlights, one draw call).
  const spots: { x: number; z: number; r: number }[] = [
    ...statues.map((c) => ({ x: grid.cx(c), z: grid.cz(c), r: 2.2 })),
    { x: lx, z: lz, r: 4.2 },
  ];
  for (let c = 0; c < grid.n; c++) {
    if (grid.kind[c] === "C" && grid.kind[c - 1] !== "C") {
      let n = 1;
      while (grid.kind[c + n] === "C") n++;
      spots.push({ x: grid.cx(c) + (n - 1) / 2, z: grid.cz(c), r: 1.6 + n * 0.6 });
    }
  }
  const pools = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: poolTexture(), color: 0xffb35a, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }),
    spots.length,
  );
  spots.forEach((s, k) => {
    m4.makeScale(s.r * 2, 1, s.r * 2).setPosition(s.x, 0.015, s.z);
    pools.setMatrixAt(k, m4);
  });
  pools.renderOrder = 1;
  scene.add(pools);

  return { book, bookLight, beam, exitGlow, pools };
}
