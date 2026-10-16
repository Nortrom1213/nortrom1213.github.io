import type { ChibiOptions } from "./chibi";

// Looks a visitor can pick for themselves. Kaijie now appears as an NPC.

export interface VisitorPreset {
  id: string;
  name: string;
  opts: ChibiOptions;
}

export const VISITORS: VisitorPreset[] = [
  { id: "traveller", name: "Traveller", opts: { hair: "short", hairColor: 0x6a4428, top: 0x4f8a5a, pants: 0x3a3a48, shoes: 0x5a3a24, scarf: 0xe0a040, skin: 0xf2c9a0 } },
  { id: "scholar", name: "Scholar", opts: { hair: "bun", hairColor: 0x2a1c14, top: 0x8a3a4a, pants: 0x2d2f3a, shoes: 0x3a2a20, glasses: { frame: 0x3a2a1a, lens: 0xd8ecff, lensOpacity: 0.25 }, skin: 0xe8b890 } },
  { id: "adventurer", name: "Adventurer", opts: { hair: "spiky", hairColor: 0xd0702a, top: 0x3b6aa8, pants: 0x5a4030, shoes: 0x3a2a20, hat: "cap", hatColor: 0xc0503a, skin: 0xf6d2b0 } },
  { id: "nightowl", name: "Night Owl", opts: { hair: "long", hairColor: 0x3a2a5a, top: 0x2a3050, hoodie: true, pants: 0x22222a, shoes: 0xe8e4dc, hat: "beret", hatColor: 0x7a3a8a, skin: 0xd8a888 } },
  { id: "gardener", name: "Gardener", opts: { hair: "short", hairColor: 0xb89060, top: 0xe8d8b0, apron: 0x4f7a4a, pants: 0x4a5a3a, shoes: 0x5a3a24, hat: "feather", hatColor: 0xc8a050, hatAccent: 0x7ab060, skin: 0xf0c8a0 } },
  { id: "coder", name: "Coder", opts: { hair: "short", hairColor: 0x1b1b20, top: 0x2f7d74, hoodie: true, pants: 0x2b2e3a, shoes: 0xf0f0f0, glasses: { frame: 0x22222a, lens: 0xa8d8ff, lensOpacity: 0.35 }, skin: 0xc8946a } },
];

export const HAIR_COLORS = [0x1b1b20, 0x4a2e1a, 0x8a5a2a, 0xd0a050, 0xd0702a, 0xe8e4dc, 0x3a2a5a, 0x2f6a8a];
export const TOP_COLORS = [0x4f8a5a, 0x3b6aa8, 0x8a3a4a, 0x2a3050, 0xe8d8b0, 0x2f7d74, 0xc0503a, 0x1d1d22];
