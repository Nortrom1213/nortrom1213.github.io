// Hand-placed anchor points for the town details (metres; +x east, +z south).
// Checked against layout.ts: paths, door corridors (3 m) and existing
// interactables (doors, NPC spots, notice board, portal, signs) keep clearance.

export interface Spot {
  x: number;
  z: number;
  /** Footprint radius of the solid prop. */
  r: number;
  yaw?: number;
}

export const S = {
  // Library (NW): door (-26, -13.2) facing south.
  libBench: { x: -30.2, z: -12.4, r: 1.0, yaw: 0 },
  libCart: { x: -33.0, z: -12.3, r: 0.8 },
  libBooks: { x: -28.8, z: -12.0, r: 0.45 },
  libOwl: { x: -21.0, z: -12.2, r: 0.6 },
  libGlobe: { x: -18.1, z: -17.6, r: 0.7 },
  libPlaque: { x: -22.4, z: -12.9, r: 0 },

  // Notebook Café (SW): door (-20.2, 19) facing east.
  cafeTables: [
    { x: -18.2, z: 24.2, r: 1.2 },
    { x: -15.0, z: 22.6, r: 1.2 },
    { x: -16.0, z: 25.4, r: 1.2 },
  ],
  cafeBoard: { x: -18.6, z: 21.9, r: 0.5 },
  gramophone: { x: -20.4, z: 25.6, r: 0.5 },
  cafeSacks: { x: -25.9, z: 23.75, r: 0.9 },
  cafePoles: [
    { x: -13.2, z: 21.4, r: 0.12 },
    { x: -12.6, z: 25.8, r: 0.12 },
    { x: -21.6, z: 27.8, r: 0.12 },
  ],

  // Games Hall (SE): door (25, 14.2) facing north.
  claw: { x: 29.6, z: 12.9, r: 0.75 },
  qblock: { x: 33.6, z: 12.0, r: 0.5 },

  // Tavern (W): door (-37.2, -1) facing east.
  barrels: { x: -37.0, z: -5.8, r: 1.2 },
  tavBench: { x: -37.1, z: 4.6, r: 1.0, yaw: Math.PI / 2 },
  guestbook: { x: -36.4, z: 7.6, r: 0.45 },
  hayCart: { x: -41.6, z: 9.2, r: 1.6 },

  // The Archive (N): door (0, -37.2) facing south.
  lions: [
    { x: -5.2, z: -33.2, r: 0.75 },
    { x: 5.2, z: -33.2, r: 0.75 },
  ],
  obelisks: [
    { x: -10.8, z: -37.0, r: 0.8 },
    { x: 10.8, z: -37.0, r: 0.8 },
  ],
  bell: { x: -12.6, z: -33.2, r: 1.0 },
  reviewerStone: { x: 12.6, z: -33.0, r: 0.6 },

  // PCG Tower (NE): door (36, -29.2) facing south.
  gpuSign: { x: 31.1, z: -29.4, r: 0 },
  blueprint: { x: 41.6, z: -27.6, r: 0.9 },

  // Plaza.
  poles: [
    { x: -9.205, z: 3.907, r: 0.15 },
    { x: -2.08, z: 9.78, r: 0.15 },
    { x: 7.07, z: 7.07, r: 0.15 },
    { x: 9.848, z: -1.736, r: 0.15 },
  ],
  beds: [
    { x: -3.86, z: 11.89, r: 1.2, yaw: -0.314 },
    { x: 4.99, z: 10.69, r: 1.2, yaw: 0.436 },
    { x: -11.28, z: 4.1, r: 1.2, yaw: -1.222 },
    { x: 4.69, z: -11.05, r: 1.2, yaw: 2.74 },
  ],
  seasons: { x: -7.2, z: 12.4, r: 0.3 },
  fortune: { x: 13.6, z: -4.4, r: 1.4 },
  mailbox: { x: -3.4, z: 15.5, r: 0.3 },

  // Notice board + portal.
  lostFound: { x: 22.8, z: -12.4, r: 0.5 },

  // Free-standing.
  well: { x: 15.2, z: 21.2, r: 1.1 },
  duckFeed: { x: 9, z: 29.6, r: 0 },
  windmillDoor: { x: -40, z: -32.6, r: 0 },
  milestone: { x: -32.2, z: -26.5, r: 0.35 },
} satisfies Record<string, Spot | Spot[]>;

/** Candidates (first clear one wins at runtime; trees are random-ish). */
export const TELESCOPE_CANDIDATES: [number, number][] = [
  [18, -50],
  [-16, -50],
  [24, -46],
  [46, -24],
];
export const LEAF_CANDIDATES: [number, number][] = [
  [-12, -14],
  [-10, -20],
  [12, -20],
];
