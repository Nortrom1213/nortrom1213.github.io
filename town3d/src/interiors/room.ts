import * as THREE from "three";
import type { Stage } from "../core/stage";
import { flatMat } from "../actors/chibi";

// Shared interior shell: floor, four walls (the one facing the camera is cut away),
// a door back to town, windows that follow the time of day, warm lights.

export interface RoomOptions {
  w: number;
  d: number;
  h?: number;
  floor: "wood" | "stone" | "carpet";
  wall: number;
  trim?: number;
  /** Stage + spawn to return to through the south door. */
  exit: { stage: string; spawn: string };
  windows?: number;
  lightColor?: number;
}

export interface Room {
  /** Updates window colours from the sky (0 day .. 1 night). */
  update(night: number): void;
  wallZ: { n: number; s: number };
  wallX: { w: number; e: number };
}

function floorTexture(kind: RoomOptions["floor"]): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  if (kind === "wood") {
    for (let i = 0; i < 16; i++) {
      const shade = 150 + Math.floor(Math.random() * 30);
      g.fillStyle = `rgb(${shade},${Math.floor(shade * 0.66)},${Math.floor(shade * 0.42)})`;
      g.fillRect(0, i * 32, 512, 32);
      g.fillStyle = "rgba(60,30,10,0.35)";
      g.fillRect(0, i * 32 + 30, 512, 2);
      const off = (i % 2) * 128 + Math.random() * 60;
      for (let x = off; x < 512; x += 256) g.fillRect(x, i * 32, 2, 32);
    }
  } else if (kind === "stone") {
    g.fillStyle = "#a8a2a0";
    g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const s = 150 + Math.floor(Math.random() * 40);
        g.fillStyle = `rgb(${s},${s - 6},${s - 10})`;
        g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
      }
  } else {
    g.fillStyle = "#7a2e3a";
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = "rgba(240,200,120,0.35)";
    g.lineWidth = 6;
    for (let i = -512; i < 1024; i += 64) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 512, 512);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildRoom(stage: Stage, o: RoomOptions): Room {
  const { w, d } = o;
  const h = o.h ?? 4.2;
  const scene = stage.scene;
  scene.background = new THREE.Color(0x1a1410);
  const T = 0.3;

  const ftex = floorTexture(o.floor);
  ftex.repeat.set(w / 4, d / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: o.wall, roughness: 0.95 });
  const trimMat = flatMat(o.trim ?? 0x6a4428);
  const mkWall = (sx: number, sz: number, x: number, z: number, normal: THREE.Vector3) => {
    const grp = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), wallMat);
    m.position.set(x, h / 2, z);
    m.receiveShadow = true;
    grp.add(m);
    const base = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.02, 0.25, sz + 0.02), trimMat);
    base.position.set(x, 0.125, z);
    grp.add(base);
    const top = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.02, 0.18, sz + 0.02), trimMat);
    top.position.set(x, h - 0.09, z);
    grp.add(top);
    scene.add(grp);
    stage.addCutawayWall(grp, normal, new THREE.Vector3(x, 0, z));
    return grp;
  };
  mkWall(w + 2 * T, T, 0, -d / 2 - T / 2, new THREE.Vector3(0, 0, -1));
  mkWall(T, d, -w / 2 - T / 2, 0, new THREE.Vector3(-1, 0, 0));
  mkWall(T, d, w / 2 + T / 2, 0, new THREE.Vector3(1, 0, 0));
  // South wall with a door gap.
  const gap = 1.8;
  const seg = (w - gap) / 2;
  const south = new THREE.Group();
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(seg + T, h, T), wallMat);
    m.position.set(sx * (gap / 2 + seg / 2 + T / 2), h / 2, d / 2 + T / 2);
    south.add(m);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(gap, h - 2.6, T), wallMat);
  lintel.position.set(0, 2.6 + (h - 2.6) / 2, d / 2 + T / 2);
  south.add(lintel);
  scene.add(south);
  stage.addCutawayWall(south, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, d / 2));

  // Door frame + mat (always visible so the exit reads even with the wall cut away).
  const frame = new THREE.Group();
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.7, 0.4), trimMat);
    post.position.set(sx * (gap / 2 + 0.09), 1.35, d / 2);
    frame.add(post);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(gap + 0.36, 0.2, 0.4), trimMat);
  head.position.set(0, 2.7, d / 2);
  frame.add(head);
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 1 }));
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(0, 0.01, d / 2 - 0.6);
  frame.add(mat);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(gap, 2.6), new THREE.MeshBasicMaterial({ color: 0xfff2d0 }));
  outside.position.set(0, 1.3, d / 2 + T + 0.01);
  outside.rotation.y = Math.PI;
  frame.add(outside);
  // The frame belongs to the south wall so it hides with it; the mat stays.
  frame.remove(mat);
  scene.add(mat);
  south.add(frame);

  // Physics: walls as boxes (camera ignores them; they get cut away instead).
  const wd = stage.world;
  wd.addBox(0, -d / 2 - T / 2, w + 2, T, 0, h, { noCamera: true });
  wd.addBox(-w / 2 - T / 2, 0, T, d + 2, 0, h, { noCamera: true });
  wd.addBox(w / 2 + T / 2, 0, T, d + 2, 0, h, { noCamera: true });
  wd.addBox(-(gap / 2 + seg / 2), d / 2 + T / 2, seg, T, 0, h, { noCamera: true });
  wd.addBox(gap / 2 + seg / 2, d / 2 + T / 2, seg, T, 0, h, { noCamera: true });
  wd.boundsRect = { minX: -w / 2, maxX: w / 2, minZ: -d / 2, maxZ: d / 2 + 0.6 };

  stage.addInteractable({
    id: "exit",
    pos: new THREE.Vector3(0, 0, d / 2 - 0.3),
    radius: 1.5,
    label: "Go outside",
    markerHeight: 2.6,
    onInteract: () => void stage.game.goTo(o.exit.stage, o.exit.spawn),
  });
  stage.spawns.default = { pos: new THREE.Vector3(0, 0, d / 2 - 1.6), yaw: Math.PI };

  // Windows on the side walls.
  const windowMats: THREE.MeshStandardMaterial[] = [];
  const nWin = o.windows ?? 2;
  for (const side of [-1, 1]) {
    for (let i = 0; i < nWin; i++) {
      const z = -d / 2 + ((i + 1) * d) / (nWin + 1);
      const wm = new THREE.MeshStandardMaterial({ color: 0xbfe0ff, emissive: 0xbfe0ff, emissiveIntensity: 0.6 });
      windowMats.push(wm);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5), wm);
      pane.position.set(side * (w / 2 - 0.01), 2.2, z);
      pane.rotation.y = -side * (Math.PI / 2);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 1.4), trimMat);
      fr.position.set(side * (w / 2 - 0.03), 2.2, z);
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 1.2), trimMat);
      cross.position.set(side * (w / 2 - 0.04), 2.2, z);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 1.5), trimMat);
      sill.position.set(side * (w / 2 - 0.12), 1.4, z);
      const holder = side < 0 ? stage.cutawayWalls[1].mesh : stage.cutawayWalls[2].mesh;
      (holder as THREE.Group).add(fr, pane, cross, sill);
    }
  }

  // Lighting: warm ambient, a soft key light with shadows, and a fill.
  const hemi = new THREE.HemisphereLight(0xfff0d8, 0x4a3828, 1.0);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(o.lightColor ?? 0xffe2b0, 1.6);
  key.position.set(w * 0.3, h * 3, d * 0.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const sc = key.shadow.camera;
  sc.left = -w;
  sc.right = w;
  sc.top = d;
  sc.bottom = -d;
  sc.far = 60;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.03;
  scene.add(key);
  const fill = new THREE.PointLight(o.lightColor ?? 0xffc880, 8, Math.max(w, d) * 1.4, 1.5);
  fill.position.set(0, h - 0.6, 0);
  scene.add(fill);

  const dayCol = new THREE.Color(0xbfe0ff);
  const nightCol = new THREE.Color(0x1a2850);
  return {
    update(night: number) {
      for (const m of windowMats) {
        m.color.copy(dayCol).lerp(nightCol, night);
        m.emissive.copy(m.color);
        m.emissiveIntensity = 0.7 - night * 0.4;
      }
      hemi.intensity = 1.0 - night * 0.25;
    },
    wallZ: { n: -d / 2, s: d / 2 },
    wallX: { w: -w / 2, e: w / 2 },
  };
}

/** Painted canvas label on a plane (posters, plaques). */
export function labelPlane(lines: { text: string; size: number; color?: string; font?: string }[], wPx: number, hPx: number, bg: string, worldW: number): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = wPx;
  c.height = hPx;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, wPx, hPx);
  g.textAlign = "center";
  g.textBaseline = "middle";
  const total = lines.reduce((s, l) => s + l.size * 1.3, 0);
  let y = hPx / 2 - total / 2;
  for (const l of lines) {
    g.font = l.font ?? `700 ${l.size}px Fraunces, Georgia, serif`;
    g.fillStyle = l.color ?? "#fbf0d8";
    y += l.size * 0.65;
    g.fillText(l.text, wPx / 2, y);
    y += l.size * 0.65;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(worldW, (worldW * hPx) / wPx), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  return m;
}
