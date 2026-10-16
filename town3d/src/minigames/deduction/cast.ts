import type { ChibiOptions } from "../../actors/chibi";
import { LOC_AT, type LocId, type Statement } from "./logic";

// The (entirely fictional) regulars of the Crooked Lantern, and how they talk.

export interface Regular {
  short: string;
  name: string;
  role: string;
  look: ChibiOptions;
  openers: string[];
  closers: string[];
}

export const REGULARS: Regular[] = [
  {
    short: "Tobin",
    name: "Old Tobin",
    role: "Retired ferryman · grumbles about the weather",
    look: { skin: 0xe8b890, hair: "short", hairColor: 0x9a9a9a, beard: 0xc4c4c4, hat: "cap", hatColor: 0x34465a, top: 0x4a6a7a, scarf: 0xa04030, pants: 0x3a3a3a },
    openers: ["Hmph. Wind's turning, and so's my stomach. You want to know about last night?", "Fifty years on the river and I never saw a night like that one."],
    closers: ["That's all you'll get out of me. Now let me drink.", "Mark it down, then. My pint's going warm."],
  },
  {
    short: "Wren",
    name: "Wren the Bard",
    role: "Travelling bard · can't stop rhyming",
    look: { skin: 0xf2c9a0, hair: "long", hairColor: 0xc87a30, hat: "feather", hatColor: 0x2a6a4a, hatAccent: 0xe8d070, top: 0x3a7a5a, pants: 0x5a3a2a, prop: "lute" },
    openers: ["An audience! Lend an ear, a verse I'll share, of moonlit fangs and tangled hair—", "Sing, muse, of the night the moon rose red… ahem. The facts, then."],
    closers: ["And thus the bard has said their piece; may all your doubts in time decrease!", "Write it in your little book. I'll write it in a song."],
  },
  {
    short: "Calla",
    name: "Sister Calla",
    role: "Herbalist · smells faintly of mint",
    look: { skin: 0xc89870, hair: "bun", hairColor: 0x2a1a10, robe: 0x5a7a3a, top: 0x6a8a4a, prop: "lantern" },
    openers: ["Peace, traveller. Chamomile? No? Then I'll be brief.", "I keep my eyes open and my herbs closer. Here is what I saw."],
    closers: ["Trust the facts, not the faces.", "May your reasoning be as clear as spring water."],
  },
  {
    short: "Pip",
    name: "Pip Marlow",
    role: "Smith's apprentice · nervous, sooty",
    look: { skin: 0xf0c8a0, hair: "spiky", hairColor: 0xb03a20, top: 0xd8c8a8, apron: 0x6a4a2a, pants: 0x3a3a4a },
    openers: ["W-wasn't me! I mean… um. Here's what I know.", "I was sweeping the forge till late, honest! But I did notice something."],
    closers: ["Can I go now? The bellows won't pump themselves.", "P-please don't tell the smith I was here."],
  },
  {
    short: "Isolde",
    name: "Madame Isolde",
    role: "Fortune teller · speaks in riddles",
    look: { skin: 0xf0d0b8, hair: "long", hairColor: 0x1a1a2a, hat: "beret", hatColor: 0x6a2a7a, top: 0x8a3a6a, glasses: { frame: 0xd8b040, lens: 0xb070e0 }, prop: "scroll" },
    openers: ["The cards whispered to me tonight, darling. Listen closely.", "Cross my palm with silver… or simply listen."],
    closers: ["The rest is written in the stars. Or in your notebook.", "Choose wisely. The moon is watching."],
  },
];

export const BARKEEP = {
  name: "Marigold Hobb",
  role: "Barkeep of the Crooked Lantern",
  look: { skin: 0xf0c098, hair: "bun", hairColor: 0xd8a040, top: 0xa04a3a, apron: 0xf0e6d0, pants: 0x3a2a2a, prop: "tray" } as ChibiOptions,
};

const nm = (i: number) => REGULARS[i].short;

/** Plain first-person wording of a statement (what goes in the case notes). */
export function statementText(st: Statement, seats: LocId[]): string {
  switch (st.kind) {
    case "not":
      return `${nm(st.a)} is not the werewolf.`;
    case "is":
      return `${nm(st.a)} is the werewolf.`;
    case "either":
      return `Either ${nm(st.a)} or ${nm(st.b)} is the werewolf.`;
    case "together":
      return `${nm(st.a)} and I were together all night.`;
    case "lying":
      return `${nm(st.a)} is lying.`;
    case "trust":
      return `${nm(st.a)} is telling the truth.`;
    case "seatIs":
      return `The werewolf sits ${LOC_AT[st.loc]}.`;
    case "seatNot":
      return `The werewolf does not sit ${LOC_AT[st.loc]}.`;
    case "mySpot":
      return `Nobody ${LOC_AT[seats[st.speaker]]} — me included — is the werewolf.`;
  }
}

const TAILS: Record<Statement["kind"], string> = {
  not: "I'd stake my last coin on it.",
  is: "Mark my words.",
  either: "One of those two, no doubt about it.",
  together: "Never left each other's sight — so neither of us is your wolf.",
  lying: "Don't believe a word of it.",
  trust: "You can count on that.",
  seatIs: "I saw muddy paw prints under those seats.",
  seatNot: "I checked under every seat there myself.",
  mySpot: "We'd have noticed the fur.",
};

/** The statement as spoken in dialogue. */
export function spokenText(st: Statement, seats: LocId[]): string {
  return `“${statementText(st, seats)}” ${TAILS[st.kind]}`;
}

/** Short logical gloss shown by the reasoning assist. */
export function glossText(st: Statement): string {
  const s = nm(st.speaker);
  switch (st.kind) {
    case "together":
      return `Means: neither ${s} nor ${nm(st.a)} is the werewolf.`;
    case "lying":
      return `Only the werewolf lies, so this means: ${nm(st.a)} is the werewolf.`;
    case "trust":
      return `Only the werewolf lies, so this claims: ${nm(st.a)} is a villager.`;
    case "mySpot":
      return `Means: the werewolf does not sit where ${s} sits.`;
    default:
      return "";
  }
}
