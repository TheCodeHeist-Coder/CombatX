/**
 * Animal crests — the artwork for every badge and tier.
 *
 * Same technique as the player avatars in components/avatar/sprites.ts: a
 * 12x12 grid of palette keys, written as 12 strings of 12 characters so the
 * art stays legible and editable in source. "." is transparent.
 *
 * WHY PIXEL GRIDS AND NOT ILLUSTRATED SVG PATHS
 * ---------------------------------------------
 * The avatars a player picks are already pixel art, so path-drawn badges would
 * read as imported clip-art sitting next to CombatX's own characters. Matching
 * the grid keeps one visual language across the whole product. It also means a
 * badge is data, not markup: redrawing one is editing twelve strings, and no
 * component changes.
 *
 * WHY ANIMALS
 * -----------
 * A creature carries meaning a letter cannot. A wolf reads as a hunter before
 * you have read the label, a tortoise reads as endurance, a phoenix reads as
 * rare. That is the whole job of a badge on a profile someone is skimming.
 *
 * Every animal is picked so the creature ITSELF explains the achievement:
 * the Giant Slayer is an ant (small thing felling something larger), the
 * Loyalist is a tortoise (still here after a year), Apex is a dragon.
 */

/** A 12x12 pixel crest. */
export interface Crest {
  /** Palette key -> CSS colour. */
  palette: Record<string, string>;
  /** 12 rows of 12 characters. "." is transparent. */
  rows: string[];
  /** The creature's name, for the accessible label. */
  animal: string;
}

/* Shared inks, so the set reads as one family rather than 26 loose icons. */
const K = "#12141a"; // outline
const W = "#ffffff"; // eye white / highlight

export const CRESTS: Record<string, Crest> = {
  // --- Milestones ---------------------------------------------------------

  /** First Blood — a wolf cub. First hunt. */
  FIRST_BLOOD: {
    animal: "Wolf cub",
    palette: { a: "#8d99ae", b: "#5c6779", c: "#e05252", k: K, w: W },
    rows: [
      ".bb......bb.",
      ".bwab..bawb.",
      "bwaab..baawb",
      ".baaaaaaaab.",
      ".baaaaaaaab.",
      "baawaaaawaab",
      "baakaaaakaab",
      ".baaaaaaaab.",
      "..baawwaab..",
      "..bawkwab...",
      "...bacab....",
      "....bbb.....",
    ],
  },

  /** Contender — a fox. Ten wins: quick and clever. */
  TEN_WINS: {
    animal: "Fox",
    palette: { a: "#e8833a", b: "#c25a1c", c: "#fbe8d0", k: K, w: W },
    rows: [
      "b..........b",
      "bab......bab",
      "bcab....bacb",
      "bcaab..baacb",
      ".baaaaaaaab.",
      ".bakaaaakab.",
      "..baaaaaab..",
      "..bacccccb..",
      "...backcb...",
      "....bccb....",
      "....bccb....",
      ".....bb.....",
    ],
  },

  /** Duellist — a stag. Thirty wins: horns earned. */
  THIRTY_WINS: {
    animal: "Stag",
    palette: { a: "#a9714b", b: "#7c4f32", c: "#d9b98c", k: K, w: W },
    rows: [
      "c..c....c..c",
      ".c.c....c.c.",
      "..ccc..ccc..",
      "...c....c...",
      "...baaaab...",
      "..baaaaaab..",
      "..bakaakab..",
      "..baaaaaab..",
      "...baaaab...",
      "...bacab....",
      "....bab.....",
      "....bb......",
    ],
  },

  /** Gladiator — a lion. Sixty wins: the mane is the rank. */
  SIXTY_WINS: {
    animal: "Lion",
    palette: { a: "#e0a63c", b: "#a86a1c", c: "#f5d68a", k: K, w: W },
    rows: [
      "b.b.bbb.b.b.",
      "bbbbbbbbbbbb",
      "bbaaaaaaaabb",
      "babaaaaaabab",
      "bbakaaaakabb",
      "babaaaaaabab",
      "bbaaccccaabb",
      "babackcabab.",
      "bbaacccaabb.",
      "b.baaaaab.b.",
      ".b.bbbbb.b..",
      "..b.....b...",
    ],
  },

  /** Centurion — an eagle. A hundred wins. */
  HUNDRED_WINS: {
    animal: "Eagle",
    palette: { a: "#f0f2f5", b: "#6b7280", c: "#e8a33a", k: K, w: W },
    rows: [
      "....aaaa....",
      "...aaaaaa...",
      "...akaaka...",
      "...aaccaa...",
      "b...accc..b.",
      "bb..aaaa.bb.",
      "bbb.aaaa.bbb",
      "bbbbaaaabbbb",
      ".bbbaaaabbb.",
      "..b.aaaa.b..",
      "....cccc....",
      "....c..c....",
    ],
  },

  /** Veteran — a rhino. 250 ranked battles: armour plate. */
  VETERAN: {
    animal: "Rhino",
    palette: { a: "#8a929e", b: "#5d646f", c: "#e6e9ee", k: K, w: W },
    rows: [
      "..........b.",
      ".c.......bab",
      ".cc.bbbbbaab",
      "cbcbaaaaaaab",
      "cbbaaaaaaaab",
      "cbaaakaaaaab",
      "cbaaaaaaaaab",
      ".baaaaaaaaab",
      ".baaaaaaaaab",
      ".bbaaaaaaab.",
      ".bab...bab..",
      ".bb.....bb..",
    ],
  },

  /** Well Read — an owl. Won on 25 different problems. */
  POLYGLOT: {
    animal: "Owl",
    palette: { a: "#a67c52", b: "#6f4f34", c: "#f0e2c8", k: K, w: W },
    rows: [
      "..b......b..",
      ".bab....bab.",
      ".baaaaaaaab.",
      "baaaaaaaaaab",
      "bacccaacccab",
      "backcaackcab",
      "bacccaacccab",
      "baaaacaaaaab",
      "baaacccaaaab",
      ".baaaaaaaab.",
      "..bacacab...",
      "...bb.bb....",
    ],
  },

  // --- Difficulty ---------------------------------------------------------

  /** Easy Rider — a rabbit. Fast, plentiful, low stakes. */
  EASY_RIDER: {
    animal: "Rabbit",
    palette: { a: "#dfe3ea", b: "#a8b0bd", c: "#f2a8c0", k: K, w: W },
    rows: [
      "..ba....ab..",
      "..bca..acb..",
      "..bca..acb..",
      "..baa..aab..",
      "...baaaab...",
      "..baaaaaab..",
      "..bakaakab..",
      "..baaaaaab..",
      "..baacaaab..",
      "...bacab....",
      "...baaab....",
      "....bbb.....",
    ],
  },

  /** Middleweight — a boar. Ten medium wins: it pushes back. */
  MIDDLEWEIGHT: {
    animal: "Boar",
    palette: { a: "#7d6b5d", b: "#54473c", c: "#e6e9ee", k: K, w: W },
    rows: [
      "..bb....bb..",
      "..bab..bab..",
      ".baaaaaaaab.",
      "baaaaaaaaaab",
      "bakaaaaaakab",
      "baaaaaaaaaab",
      "baacccccccab",
      "cbacckkccabc",
      "cbaccccccabc",
      "ccbaaaaaabcc",
      ".cbb....bbc.",
      "..c......c..",
    ],
  },

  /** Heavyweight — a bison. Thirty medium wins. */
  HEAVYWEIGHT: {
    animal: "Bison",
    palette: { a: "#6b5844", b: "#453728", c: "#cdd3db", k: K, w: W },
    rows: [
      "cc........cc",
      "cbc......cbc",
      "cbbaaaaaabbc",
      ".baaaaaaaab.",
      "baaabaabaaab",
      "baaaaaaaaaab",
      "bakaaaaaakab",
      "baaaaaaaaaab",
      "baacccccccab",
      ".backkkkkcab",
      ".baccccccab.",
      "..bbbbbbbb..",
    ],
  },

  /** Hard Liner — a hawk. First hard win: the first real strike. */
  HARD_LINER: {
    animal: "Hawk",
    palette: { a: "#8a6a4a", b: "#5a4530", c: "#e8a33a", k: K, w: W },
    rows: [
      "....bbbb....",
      "...baaaab...",
      "..baaaaaab..",
      "..bakaakab..",
      "..baacaaab..",
      "...baccab...",
      "....bccb....",
      "...baaaab...",
      "..baaaaaab..",
      ".baaaaaaaab.",
      "..b.baab.b..",
      "....b..b....",
    ],
  },

  /** Crucible — a bear. Ten hard wins: it takes real weight. */
  CRUCIBLE: {
    animal: "Bear",
    palette: { a: "#6f5442", b: "#48342a", c: "#cfa98a", k: K, w: W },
    rows: [
      ".bbb....bbb.",
      "baaab..baaab",
      "baaab..baaab",
      ".baaaaaaaab.",
      "baaaaaaaaaab",
      "baakaaaakaab",
      "baaaaaaaaaab",
      "baacccccccab",
      "baaccckcccab",
      ".bacccccccb.",
      "..baaaaaab..",
      "...bbbbbb...",
    ],
  },

  /** Apex — a dragon. Thirty hard wins. The top of the food chain. */
  APEX: {
    animal: "Dragon",
    palette: { a: "#d8452a", b: "#8f2412", c: "#f5c542", k: K, w: W },
    rows: [
      "..c......c..",
      "..bc....cb..",
      "..bbc..cbb..",
      ".bbaaaaaabb.",
      ".baaaaaaaab.",
      "baakaaaakaab",
      "baaaaaaaaaab",
      "bacccccccab.",
      "b.cbbbbbc.b.",
      "...caaac....",
      "..cbaaabc...",
      ".c..bbb..c..",
    ],
  },

  /** All Rounder — a chameleon. Wins at every difficulty. */
  ALL_ROUNDER: {
    animal: "Chameleon",
    palette: { a: "#4caf72", b: "#2f7a4c", c: "#f5c542", k: K, w: W },
    rows: [
      ".......bbbb.",
      "......baaaab",
      "......bawkab",
      "..bbbbbaaaab",
      ".baaaaaaaab.",
      "baaaaaaaaab.",
      "baaaaaaaab..",
      ".baaaaaab...",
      "..b.baab....",
      ".bcb.b.b....",
      "bcbcb.......",
      ".bcb........",
    ],
  },

  // --- Streaks ------------------------------------------------------------

  /** Hat Trick — a magpie. Three in a row. */
  HAT_TRICK: {
    animal: "Magpie",
    palette: { a: "#2b2f38", b: "#161920", c: "#f0f2f5", k: K, w: W },
    rows: [
      "....bbbb....",
      "...baaaab...",
      "..baawaaab..",
      "..baakaaab..",
      "..baaaaccb..",
      "...baaccb...",
      "...bacccb...",
      "..bacccccb..",
      "..baccccab..",
      "..baaccaab..",
      "...baaaab...",
      "....b..b....",
    ],
  },

  /** Unbroken — a wolf. Ten in a row: the pack hunter. */
  UNBROKEN: {
    animal: "Wolf",
    palette: { a: "#6b7686", b: "#414a58", c: "#c9d2de", k: K, w: W },
    rows: [
      "bb........bb",
      "bcab......ba",
      "bcaab..baacb",
      ".baaaaaaaab.",
      "baaaaaaaaaab",
      "backaaaakcab",
      "baaaaaaaaaab",
      ".baacccccab.",
      "..bacccccab.",
      "..bacckccab.",
      "...bacccab..",
      "....bbbb....",
    ],
  },

  /** Immortal — a phoenix. Twenty-five in a row: it does not fall. */
  IMMORTAL: {
    animal: "Phoenix",
    palette: { a: "#f5a524", b: "#d8452a", c: "#ffe08a", k: K, w: W },
    rows: [
      "..c......c..",
      "..bc.cc.cb..",
      ".bbcccccbb..",
      ".baaacaaab..",
      "baakaaaakab.",
      "baaaacaaaab.",
      "bcaaacaaacb.",
      "bccaaccaccb.",
      ".bccccccbb..",
      "..bcaaacb...",
      "...bcacb....",
      "....bcb.....",
    ],
  },

  // --- Skill --------------------------------------------------------------

  /** Flawless — a swan. Ten perfect runs: not a feather out of place. */
  FLAWLESS: {
    animal: "Swan",
    palette: { a: "#ffffff", b: "#b6bec9", c: "#e8a33a", k: K, w: W },
    rows: [
      ".....baab...",
      "....baaaab..",
      "....bakaab..",
      "....baacab..",
      "....baaab...",
      "....baab....",
      "...baab.....",
      "..baaab.....",
      ".baaaaab....",
      "baaaaaaab...",
      ".baaaaaaab..",
      "..bbbbbbb...",
    ],
  },

  /** Giant Slayer — an ant. Small, and it fells things far larger. */
  GIANT_SLAYER: {
    animal: "Ant",
    palette: { a: "#d4483a", b: "#8f2a1c", c: "#e8b4a8", k: K, w: W },
    rows: [
      "..c......c..",
      "...c....c...",
      "....baab....",
      "...bawwab...",
      "c..baaaab..c",
      ".cc.baab.cc.",
      "....baab....",
      "c..baaaab..c",
      ".cc.baab.cc.",
      "...baaaaab..",
      "c.baaaaaab.c",
      ".c.bbbbbb.c.",
    ],
  },

  /** Ranked — a falcon. A placed rating: it has found its altitude. */
  RANKED: {
    animal: "Falcon",
    palette: { a: "#6b7686", b: "#414a58", c: "#e8e2d4", k: K, w: W },
    rows: [
      "....bbbb....",
      "...bacccb...",
      "..bacccccb..",
      "..bakcckab..",
      "..baccccab..",
      "...bacccb...",
      "....bccb....",
      "...baaaab...",
      "..baaaaaab..",
      "...baaaab...",
      "....b..b....",
      "............",
    ],
  },

  /** Gamma Class — a lynx. Good: sharp, and consistently ahead. */
  GAMMA_CLASS: {
    animal: "Lynx",
    palette: { a: "#9fb8d0", b: "#5e7690", c: "#f0f4f8", k: K, w: W },
    rows: [
      "c..........c",
      "bc........cb",
      "bbc......cbb",
      "cbbaaaaaabbc",
      "cbaaaaaaaabc",
      "cbakaaaakabc",
      "cbaaaaaaaabc",
      "cbbacccccabb",
      "c.bbackcabb.",
      "..cbaaaaabc.",
      "...cbaaabc..",
      "....cbbbc...",
    ],
  },

  /** Beta Class — a panther. Great: among the strongest here. */
  BETA_CLASS: {
    animal: "Panther",
    palette: { a: "#6b5ba8", b: "#3d3168", c: "#c9b8f0", k: K, w: W },
    rows: [
      "..bb........",
      ".bwab.......",
      ".baaabbbbbb.",
      "baaaaaaaaaab",
      "bakaaaaaaaab",
      "baaaaaaaaaab",
      ".baaaaaaaab.",
      ".bab.bb.bab.",
      ".bab.bb.bab.",
      ".bb..bb..bb.",
      "............",
      "............",
    ],
  },

  /** Alpha Class — a tiger. Elite: the top of the ladder. */
  ALPHA_CLASS: {
    animal: "Tiger",
    palette: { a: "#f2622e", b: "#8f2f10", c: "#ffe3c9", k: K, w: W },
    rows: [
      ".bb......bb.",
      "baab....baab",
      "baaabbbbaaab",
      "baaaaaaaaaab",
      "bab.b.b.b.ab",
      "bakaaaaaakab",
      "baaaaaaaaaab",
      "baacccccccab",
      "baacckkccaab",
      ".bacccccccb.",
      "..baaaaaab..",
      "...bbbbbb...",
    ],
  },

  // --- Pioneer ------------------------------------------------------------

  /** Pioneer — a mammoth. Ancient: one of the first here. */
  PIONEER: {
    animal: "Mammoth",
    palette: { a: "#8a6a9c", b: "#5a4268", c: "#f0e2c8", k: K, w: W },
    rows: [
      "...bbbbbb...",
      "..baaaaaab..",
      ".baaaaaaaab.",
      "baaaaaaaaaab",
      "baakaaaakaab",
      "baaaaaaaaaab",
      "bacaaaaaacab",
      "bcaabaaabacb",
      "c.baabaabab.",
      "c.bab.bab...",
      ".cbb...bb...",
      "..c.........",
    ],
  },

  /** Founding Combatant — a kraken. Early, and it actually fought. */
  FOUNDING_COMBATANT: {
    animal: "Kraken",
    palette: { a: "#2f8f8a", b: "#1a5c58", c: "#8ce0d8", k: K, w: W },
    rows: [
      "....bbbb....",
      "...baaaab...",
      "..baaaaaab..",
      "..bakaakab..",
      "..baaaaaab..",
      "..baaaaaab..",
      ".bbabaabab..",
      "bcbabaababcb",
      "bcb.b..b.bcb",
      "cb..b..b..bc",
      "c...c..c...c",
      "............",
    ],
  },

  /** Loyalist — a tortoise. Still here a year later. */
  LOYALIST: {
    animal: "Tortoise",
    palette: { a: "#4c8f5a", b: "#2f5c38", c: "#c9a45c", k: K, w: W },
    rows: [
      "............",
      "....bbbb....",
      "..bbccccbb..",
      ".bcccbbcccb.",
      "bccbccccbccb",
      "bcccccccccb.",
      "bccbccccbcb.",
      ".bbccccccbb.",
      "baab....baab",
      "bkab....bab.",
      ".bb......bb.",
      "............",
    ],
  },
};

/**
 * Tier crests, keyed by tier key.
 *
 * Deliberately the SAME animals as the class badges where one exists, so a
 * player's Alpha tier and their Alpha Class badge are visibly the same
 * creature rather than two unrelated pictures of "being good".
 */
export const TIER_CRESTS: Record<string, Crest> = {
  IOTA: {
    animal: "Mouse",
    palette: { a: "#9aa3b0", b: "#666e7d", c: "#f2a8c0", k: K, w: W },
    rows: [
      "bbb......bbb",
      "bcab....bacb",
      "bcaab..baacb",
      "bcaaaaaaaacb",
      ".baaaaaaaab.",
      ".bakaaaakab.",
      "..baaaaaab..",
      "..bacacab...",
      "...baaab..bb",
      "...baaaabb.b",
      "....bbbb...b",
      "..........bb",
    ],
  },
  EPSILON: {
    animal: "Badger",
    palette: { a: "#8a929e", b: "#4a5058", c: "#f0f2f5", k: K, w: W },
    rows: [
      "..b......b..",
      ".bab....bab.",
      ".bacaaacab..",
      "bcacaaacacb.",
      "bcacaaacacb.",
      "bcakaaakacb.",
      "bcacaaacacb.",
      "bcaacaacaab.",
      ".baacccaab..",
      "..baaaaab...",
      "...baaab....",
      "....bbb.....",
    ],
  },
  DELTA: {
    animal: "Boar",
    palette: { a: "#4db6ac", b: "#2a7d74", c: "#d4f0ec", k: K, w: W },
    rows: [
      "..bb....bb..",
      "..bab..bab..",
      ".baaaaaaaab.",
      "baaaaaaaaaab",
      "bakaaaaaakab",
      "baaaaaaaaaab",
      "baacccccccab",
      "cbacckkccabc",
      "cbaccccccabc",
      "ccbaaaaaabcc",
      ".cbb....bbc.",
      "..c......c..",
    ],
  },
  GAMMA: {
    animal: "Lynx",
    palette: { a: "#42a5f5", b: "#1d6fb0", c: "#d0e8ff", k: K, w: W },
    rows: [
      "c..........c",
      "bc........cb",
      "bbc......cbb",
      "cbbaaaaaabbc",
      "cbaaaaaaaabc",
      "cbakaaaakabc",
      "cbaaaaaaaabc",
      "cbbacccccabb",
      "c.bbackcabb.",
      "..cbaaaaabc.",
      "...cbaaabc..",
      "....cbbbc...",
    ],
  },
  BETA: {
    animal: "Panther",
    palette: { a: "#7e57c2", b: "#4a3080", c: "#d8c8f5", k: K, w: W },
    rows: [
      "..bb........",
      ".bwab.......",
      ".baaabbbbbb.",
      "baaaaaaaaaab",
      "bakaaaaaaaab",
      "baaaaaaaaaab",
      ".baaaaaaaab.",
      ".bab.bb.bab.",
      ".bab.bb.bab.",
      ".bb..bb..bb.",
      "............",
      "............",
    ],
  },
  ALPHA: {
    animal: "Tiger",
    palette: { a: "#f2622e", b: "#8f2f10", c: "#ffe3c9", k: K, w: W },
    rows: [
      ".bb......bb.",
      "baab....baab",
      "baaabbbbaaab",
      "baaaaaaaaaab",
      "bab.b.b.b.ab",
      "bakaaaaaakab",
      "baaaaaaaaaab",
      "baacccccccab",
      "baacckkccaab",
      ".bacccccccb.",
      "..baaaaaab..",
      "...bbbbbb...",
    ],
  },
};

/** The crest for a badge key, or null when none is drawn. */
export function crestFor(badgeKey: string): Crest | null {
  return CRESTS[badgeKey] ?? null;
}

/** The crest for a tier key, or null. */
export function tierCrestFor(tierKey: string): Crest | null {
  return TIER_CRESTS[tierKey] ?? null;
}
