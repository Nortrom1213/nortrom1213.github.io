// Shared town layout (metres; +x east, +z south). Used by the town builder,
// the minimap and mini-games that live outdoors.

export const TILE = 2.6;
export const PLAY_RADIUS = 58;
export const HILLS_START = 62;

export type Side = "n" | "s" | "e" | "w";

export interface BuildingDef {
  id: string;
  label: string;
  x: number;
  z: number;
  w: number; // tiles along x (odd on the door side so the door is centred)
  d: number; // tiles along z
  floors: number;
  door: Side;
  roof: "gable" | "high" | "point";
  roofColor: number;
  style: "stone" | "wood" | "mixed";
  windows: "shutters" | "glass" | "round";
  /** Ridge runs along this axis. */
  ridge?: "x" | "z";
  icon: string;
}

export const BUILDINGS: BuildingDef[] = [
  { id: "library", label: "Library", x: -26, z: -18, w: 5, d: 3, floors: 2, door: "s", roof: "gable", roofColor: 0x4f9a6a, style: "mixed", windows: "glass", icon: "📚" },
  { id: "cafe", label: "Notebook Café", x: -25, z: 19, w: 3, d: 3, floors: 1, door: "e", roof: "gable", roofColor: 0xd0604a, style: "wood", windows: "shutters", ridge: "z", icon: "☕" },
  { id: "hall", label: "Games Hall", x: 25, z: 19, w: 5, d: 3, floors: 2, door: "n", roof: "gable", roofColor: 0x8270c0, style: "mixed", windows: "round", icon: "🎮" },
  { id: "tavern", label: "The Tavern", x: -42, z: -1, w: 3, d: 5, floors: 2, door: "e", roof: "gable", roofColor: 0xc8783a, style: "wood", windows: "shutters", ridge: "z", icon: "🍺" },
  { id: "archive", label: "The Archive", x: 0, z: -42, w: 7, d: 3, floors: 2, door: "s", roof: "high", roofColor: 0x4a72b0, style: "stone", windows: "glass", icon: "🏛️" },
  { id: "tower", label: "PCG Tower", x: 36, z: -34, w: 3, d: 3, floors: 4, door: "s", roof: "point", roofColor: 0xa04a80, style: "stone", windows: "round", icon: "🗼" },
];

export const POI = {
  plaza: { x: 0, z: 0, r: 8.5 },
  notice: { x: 19, z: -15 },
  portal: { x: 36, z: 1 },
  welcome: { x: 0, z: 7 },
  pond: { x: 6, z: 37, rx: 10, rz: 6.5 },
  meadow: { x: -6, z: 36, r: 12 },
  fireflySign: { x: -2, z: 27 },
  windmill: { x: -40, z: -36 },
  spawn: { x: 0, z: 12 },
};

/** Door world position and outward yaw for a building. */
export function doorOf(b: BuildingDef) {
  const W = b.w * TILE;
  const D = b.d * TILE;
  const off = 0.9;
  switch (b.door) {
    case "s":
      return { x: b.x, z: b.z + D / 2 + off, yaw: 0 };
    case "n":
      return { x: b.x, z: b.z - D / 2 - off, yaw: Math.PI };
    case "e":
      return { x: b.x + W / 2 + off, z: b.z, yaw: Math.PI / 2 };
    case "w":
      return { x: b.x - W / 2 - off, z: b.z, yaw: -Math.PI / 2 };
  }
}

/** Dirt paths as polylines (x, z) with width. */
let pathCache: { pts: [number, number][]; w: number }[] | null = null;

export function pathNetwork(): { pts: [number, number][]; w: number }[] {
  if (pathCache) return pathCache;
  const paths: { pts: [number, number][]; w: number }[] = [];
  for (const b of BUILDINGS) {
    const d = doorOf(b);
    const ex = d.x + Math.sin(d.yaw) * 2.5;
    const ez = d.z + Math.cos(d.yaw) * 2.5;
    const mid: [number, number] = [ex * 0.55, ez * 0.55];
    paths.push({ pts: [[0, 0], mid, [ex, ez], [d.x, d.z]], w: b.id === "archive" ? 4.2 : 3.2 });
  }
  paths.push({ pts: [[0, 0], [10, -8], [POI.notice.x, POI.notice.z + 2.5]], w: 2.6 });
  paths.push({ pts: [[0, 0], [18, 1], [POI.portal.x - 3.5, POI.portal.z]], w: 3 });
  paths.push({ pts: [[0, 0], [0, 14], [-2, 24], [POI.fireflySign.x, POI.fireflySign.z + 1]], w: 2.6 });
  paths.push({ pts: [[-26, -12], [-34, -24], [POI.windmill.x + 3, POI.windmill.z + 3]], w: 2.2 });
  pathCache = paths;
  return paths;
}
