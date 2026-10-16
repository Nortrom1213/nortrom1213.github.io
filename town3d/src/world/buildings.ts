import * as THREE from "three";
import { mergeStatic, model, tintRoof } from "../core/assets";
import { TILE, type BuildingDef, type Side, doorOf } from "./layout";

// Assemble a building from Kenney fantasy-town wall modules plus one stretched
// roof piece. Wall modules are 1x1 tiles with the wall on the tile's +x edge.

const SIDE_ROT: Record<Side, number> = { e: 0, s: -Math.PI / 2, w: Math.PI, n: Math.PI / 2 };
const SIDE_NORMAL: Record<Side, [number, number]> = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] };

export interface BuiltBuilding {
  group: THREE.Group;
  door: { x: number; z: number; yaw: number };
  /** Warm window quads that light up at night. */
  glows: THREE.Mesh[];
  height: number;
}

const glowMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, emissive: 0xffb860, emissiveIntensity: 0, roughness: 0.5 });

export function setWindowGlow(night: number) {
  glowMat.emissiveIntensity = THREE.MathUtils.smoothstep(night, 0.25, 0.8) * 1.6;
  glowMat.color.setHex(night > 0.3 ? 0x3a2a18 : 0x2a3440);
}

function pieceName(style: BuildingDef["style"], floor: number, kind: "plain" | "window" | "door" | "detail", def: BuildingDef) {
  const wood = style === "wood" || (style === "mixed" && floor > 0);
  const w = wood ? "wall-wood" : "wall";
  if (kind === "door") return def.id === "archive" ? "wall-doorway-round" : `${w}-door`;
  if (kind === "detail") return `${w}-detail-cross`;
  if (kind === "window") return `${w}-window-${def.windows}`;
  return w;
}

export function buildBuilding(def: BuildingDef): BuiltBuilding {
  const group = new THREE.Group();
  group.position.set(def.x, 0, def.z);
  const S = TILE;
  const W = def.w;
  const D = def.d;
  const x0 = -(W * S) / 2;
  const z0 = -(D * S) / 2;
  const glows: THREE.Mesh[] = [];
  const glowGeo = new THREE.PlaneGeometry(S * 0.3, S * 0.36);

  const sides: Side[] = ["n", "s", "e", "w"];
  for (const side of sides) {
    const along = side === "n" || side === "s" ? W : D;
    for (let i = 0; i < along; i++) {
      // Tile centre on this edge.
      let tx: number;
      let tz: number;
      if (side === "n" || side === "s") {
        tx = x0 + (i + 0.5) * S;
        tz = side === "n" ? z0 + 0.5 * S : z0 + (D - 0.5) * S;
      } else {
        tz = z0 + (i + 0.5) * S;
        tx = side === "w" ? x0 + 0.5 * S : x0 + (W - 0.5) * S;
      }
      const mid = Math.floor(along / 2);
      for (let f = 0; f < def.floors; f++) {
        let kind: "plain" | "window" | "door" | "detail";
        if (f === 0 && side === def.door && i === mid) kind = "door";
        else if (along >= 3 && (i === 0 || i === along - 1)) kind = f === 0 ? "plain" : "detail";
        else kind = (i + f) % 2 === 0 || along <= 3 ? "window" : f === 0 ? "plain" : "detail";
        if (def.id === "tower" && kind === "detail") kind = "window";
        const piece = model("town", pieceName(def.style, f, kind, def), S);
        piece.position.set(tx, f * S, tz);
        piece.rotation.y = SIDE_ROT[side];
        group.add(piece);
        if (kind === "window") {
          const g = new THREE.Mesh(glowGeo, glowMat);
          const [nx, nz] = SIDE_NORMAL[side];
          g.position.set(tx + nx * (S * 0.5 - 0.02), f * S + S * 0.5, tz + nz * (S * 0.5 - 0.02));
          g.rotation.y = Math.atan2(nx, nz);
          glows.push(g);
          group.add(g);
        }
      }
    }
  }

  // Solid core so gaps between modules never show the sky.
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(W * S - 0.5, def.floors * S - 0.05, D * S - 0.5),
    new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 1 }),
  );
  core.position.y = (def.floors * S) / 2;
  group.add(core);

  // Roof.
  const top = def.floors * S;
  const ridge = def.ridge ?? (W >= D ? "x" : "z");
  let roof: THREE.Group;
  let roofH: number;
  if (def.roof === "point") {
    roof = model("town", "roof-high-point", 1);
    roof.scale.set(W * S * 1.05, W * S * 1.1, D * S * 1.05);
    roofH = W * S * 1.1;
  } else {
    roof = model("town", def.roof === "high" ? "roof-high-gable" : "roof-gable", 1);
    const span = ridge === "x" ? D : W;
    const len = ridge === "x" ? W : D;
    const hk = def.roof === "high" ? 0.55 : 1.0;
    roof.scale.set(len * S * 1.02, span * S * hk, span * S * 1.02);
    if (ridge === "z") roof.rotation.y = Math.PI / 2;
    roofH = span * S * hk * (def.roof === "high" ? 1.1 : 0.57);
  }
  roof.position.y = top;
  tintRoof(roof, def.roofColor);
  group.add(roof);

  // Chimney for homely buildings.
  if (def.style !== "stone" && def.id !== "tower") {
    const ch = model("town", "chimney", S);
    ch.position.set(x0 + S * 0.8, top + roofH * 0.25, z0 + S * 0.7);
    group.add(ch);
  }

  // Banners either side of the door.
  const d = doorOf(def);
  const banner = def.id === "library" || def.id === "archive" ? "banner-green" : "banner-red";
  const [nx, nz] = SIDE_NORMAL[def.door];
  for (const sgn of [-1, 1]) {
    const b = model("town", banner, S * 0.9);
    const lx = d.x - def.x - nx * 0.9 + (nz !== 0 ? sgn * S * 0.95 : 0);
    const lz = d.z - def.z - nz * 0.9 + (nx !== 0 ? sgn * S * 0.95 : 0);
    b.position.set(lx - nx * (S * 0.45 - 0.05), S * 0.15, lz - nz * (S * 0.45 - 0.05));
    b.rotation.y = SIDE_ROT[def.door];
    group.add(b);
  }

  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = m.material !== glowMat;
      m.receiveShadow = true;
    }
  });
  mergeStatic(group);
  return { group, door: d, glows, height: top + roofH };
}

/** Wooden sign with painted text, e.g. above paths. */
export function buildSign(text: string, opts: { width?: number; color?: string; sub?: string } = {}): THREE.Group {
  const g = new THREE.Group();
  const width = opts.width ?? 2.4;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = opts.color ?? "#8a5a34";
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 3;
  for (let y = 30; y < 160; y += 34) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#4a2e18";
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 500, 148);
  ctx.fillStyle = "#fbf0d8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 64;
  ctx.font = `700 ${size}px Fraunces, Georgia, serif`;
  while (ctx.measureText(text).width > 460 && size > 24) {
    size -= 4;
    ctx.font = `700 ${size}px Fraunces, Georgia, serif`;
  }
  ctx.fillText(text, 256, opts.sub ? 64 : 82);
  if (opts.sub) {
    ctx.font = `600 30px Nunito, sans-serif`;
    ctx.fillStyle = "#f0d8a8";
    ctx.fillText(opts.sub, 256, 122);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(width, width * 0.3125, 0.08),
    [
      new THREE.MeshStandardMaterial({ color: 0x5e3a20 }),
      new THREE.MeshStandardMaterial({ color: 0x5e3a20 }),
      new THREE.MeshStandardMaterial({ color: 0x5e3a20 }),
      new THREE.MeshStandardMaterial({ color: 0x5e3a20 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }),
    ],
  );
  board.position.y = 1.9;
  board.castShadow = true;
  g.add(board);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.9, flatShading: true });
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 0.12), postMat);
    post.position.set(sx * (width / 2 - 0.15), 1.15, -0.06);
    post.castShadow = true;
    g.add(post);
  }
  return g;
}
