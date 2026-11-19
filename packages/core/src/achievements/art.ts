import { ACHIEVEMENTS } from "./catalogue";

import type { AchievementId, AchievementTier } from "./catalogue";

/*
 * The art of the 130 badges (KEY-1098), ported from the renderVals of `BadgeArt.dc.html` and
 * `BadgeCatalogue.dc.html` in `docs/design/source-achievements/`. Each badge is a struck medal in a 64 by 64
 * view box: a tier frame, a dark enamel centre, a motif in the metal's colour and, on a series badge, a ribbon
 * with its threshold. Both apps draw what `badgeDrawing` returns, so a badge is the same shape on a phone and
 * on the web.
 */

export const BADGE_VIEW_BOX_SIZE = 64;

/** The tier tokens a badge reads, by their names in `@keylow/tokens`. They are the same in light and dark. */
export type TierColourToken =
  | "tier-enamel"
  | "tier-bronze-hi"
  | "tier-bronze-mid"
  | "tier-bronze-lo"
  | "tier-silver-hi"
  | "tier-silver-mid"
  | "tier-silver-lo"
  | "tier-gold-hi"
  | "tier-gold-mid"
  | "tier-gold-lo"
  | "tier-plat-a"
  | "tier-plat-b"
  | "tier-plat-c"
  | "tier-plat-d"
  | "tier-locked"
  | "tier-locked-glyph";

export type BadgeState = "earned" | "locked" | "hidden";

// The helper maths of the board, which the frame and the motifs share.
const c = (x: number, y: number, r: number) =>
  `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

type Point = readonly [number, number];

const ringPoint = (n: number, r: number, off: number, cx: number, cy: number, i: number): Point => {
  const a = (i / n) * Math.PI * 2 + off;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
};

const pts = (n: number, r: number, off: number, cx: number, cy: number): Point[] =>
  Array.from({ length: n }, (_, i) => ringPoint(n, r, off, cx, cy, i));

const poly = (points: readonly Point[]) =>
  `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L")}z`;

const star = (x: number, y: number, s: number) =>
  `M${x} ${y - s}L${x + s * 0.3} ${y - s * 0.3}L${x + s} ${y}L${x + s * 0.3} ${y + s * 0.3}L${x} ${y + s}L${x - s * 0.3} ${y + s * 0.3}L${x - s} ${y}L${x - s * 0.3} ${y - s * 0.3}z`;

const dotPaths = (points: readonly Point[]) =>
  points.map(([x, y]) => `M${x.toFixed(2)} ${y.toFixed(2)}h.01`);

/** The 62 motifs by name: each a list of stroke paths on a 24 by 24 grid. */
export const BADGE_MOTIFS = {
  apple: [
    "M12 7c-2-1.5-7-1-7 5 0 5 3 9 5 9 1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-4 5-9 0-.9-.2-1.8-.5-2.5a2.2 2.2 0 0 1-2.6-2.6C14.8 6.5 13.4 6.4 12 7z",
    "M12 7c0-2 1-3.5 3-4",
  ],
  flag: ["M6 21V4", "M6 4h12l-3 4 3 4H6"],
  scale: [
    "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z",
    "M8 10a4 4 0 0 1 8 0",
    "M12 10l1.6-2.4",
  ],
  barcode: [
    "M5 6v12",
    "M8 6v12",
    "M10 6v12",
    "M13 6v12",
    "M16 6v12",
    "M19 6v12",
    "M3 4h3",
    "M18 4h3",
    "M3 20h3",
    "M18 20h3",
  ],
  book: [
    "M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4z",
    "M20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z",
    "M15 9h2.5",
    "M15 12h2.5",
  ],
  heart: ["M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"],
  dumbbell: ["M7 8v8", "M17 8v8", "M4 10v4", "M20 10v4", "M7 12h10"],
  plan: ["M4 4h16v16H4z", "M4 9.3h16", "M4 14.7h16", "M9.3 4v16", "M14.7 4v16"],
  chat: ["M4 5h16v11H10l-6 4z", "M8 9h8", "M8 12h5"],
  bell: ["M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z", "M10 20a2 2 0 0 0 4 0"],
  donut: [c(12, 12, 8), c(12, 12, 3.5), "M12 4v4.5", "M18.9 16l-3.9-2.3", "M5.1 16l3.9-2.3"],
  moonCheck: ["M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z", "M9 12l2 2 3.5-3.5"],
  log: ["M6 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z", "M9 3v18", "M12 8h3", "M12 12h3"],
  cal: [
    "M4 6h16v14H4z",
    "M4 10h16",
    "M8 3v5",
    "M16 3v5",
    "M8 14h.01",
    "M12 14h.01",
    "M16 14h.01",
    "M8 17h.01",
    "M12 17h.01",
  ],
  flame: ["M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z"],
  back: ["M9 14L4 9l5-5", "M4 9h11a5 5 0 0 1 0 10h-4"],
  snowShield: [
    "M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z",
    "M12 8v8",
    "M8.5 10l7 4",
    "M15.5 10l-7 4",
  ],
  swords: [
    "M4 4l11 11",
    "M20 4L9 15",
    "M14 17l3 3",
    "M10 17l-3 3",
    "M15.5 18.5l2-2",
    "M8.5 18.5l-2-2",
  ],
  stock: [
    "M4 11h16v9H4z",
    "M4 15.5h16",
    "M8 3v6",
    "M5.4 4.5l5.2 3",
    "M10.6 4.5l-5.2 3",
    "M16 3v6",
    "M13.4 4.5l5.2 3",
    "M18.6 4.5l-5.2 3",
  ],
  protein: [
    "M14 3.5a6.5 6.5 0 0 1 4.6 11.1c-1.7 1.7-4.1 2.2-6.2 1.5L9 19.5",
    "M9 19.5a1.8 1.8 0 1 1-2.6 2.3 1.8 1.8 0 1 1-2.3-2.6 1.8 1.8 0 1 1 2.6-2.3",
    "M6.7 16.9l3.4-3.4c-.7-2.1-.2-4.5 1.5-6.2A6.5 6.5 0 0 1 14 3.5",
  ],
  target: [c(12, 12, 9), c(12, 12, 5.5), c(12, 12, 2), "M12 12l7-7", "M17 5h2v2"],
  plate: [c(12, 12, 9), c(12, 12, 5), "M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4"],
  seven: [...dotPaths(pts(7, 8.5, 0, 12, 12)), star(12, 12, 3.6)],
  wheat: [
    "M12 21V8",
    "M12 8c-1.8-.9-3-2.8-3-5 1.8 0 3 1.4 3 3 0-1.6 1.2-3 3-3 0 2.2-1.2 4.1-3 5",
    "M12 12.5c-2-.4-3.6-1.4-4.5-3",
    "M12 12.5c2-.4 3.6-1.4 4.5-3",
    "M12 16.5c-2-.4-3.6-1.4-4.5-3",
    "M12 16.5c2-.4 3.6-1.4 4.5-3",
  ],
  sunrise: [
    "M3 18h18",
    "M7 18a5 5 0 0 1 10 0",
    "M12 6v3",
    "M5.6 9.6l2 2",
    "M18.4 9.6l-2 2",
    "M3 14h2",
    "M19 14h2",
  ],
  variety: ["M3 12h18a9 9 0 0 1-18 0z", c(8, 8.5, 2.5), c(13, 7, 2.5), "M16.5 9.5l3-5"],
  compass: [c(12, 12, 9), "M15.5 8.5l-2 5-5 2 2-5z"],
  loop: ["M17 2l3 3-3 3", "M20 5H9a5 5 0 0 0-5 5", "M7 22l-3-3 3-3", "M4 19h11a5 5 0 0 0 5-5"],
  cloche: ["M3 18h18", "M5 18a7 7 0 0 1 14 0", "M12 11V9.5", c(12, 8.5, 1)],
  pot: [
    "M4 10h16v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z",
    "M2 10h20",
    "M9 7c0-1.2 1-1.6 1-2.8",
    "M14 7c0-1.2 1-1.6 1-2.8",
  ],
  clip: ["M8 3h8v3H8z", "M6 4.5H5V21h14V4.5h-1", "M8 10h8", "M8 14h8", "M8 18h5"],
  basket: ["M3 10h18l-2 10H5z", "M7 10l4-6", "M17 10l-4-6", "M9 14v3", "M12 14v3", "M15 14v3"],
  cards: ["M8 4h12v12H8z", "M5 8v12h12", "M11 8h6", "M11 12h4"],
  tally: ["M6 5v14", "M10 5v14", "M14 5v14", "M18 5v14", "M3.5 16.5L20.5 7.5"],
  kettle: [
    "M8.5 9a3.5 3.5 0 0 1 7 0",
    "M6.5 10h11l1.5 9a1.5 1.5 0 0 1-1.5 1.8H6.5A1.5 1.5 0 0 1 5 19z",
    "M10 15h4",
  ],
  bolt: ["M13 2L4 14h7l-1 8 9-12h-7z"],
  chain: [
    "M9.5 14.5l-2.5 2.5a3.2 3.2 0 0 1-4.5-4.5l3.5-3.5a3.2 3.2 0 0 1 4.5 0",
    "M14.5 9.5l2.5-2.5a3.2 3.2 0 0 1 4.5 4.5l-3.5 3.5a3.2 3.2 0 0 1-4.5 0",
    "M9 15l6-6",
  ],
  bird: [
    "M3 14c3 0 5-2 6-5 1 3 4 5 8 5l4-2-3 4c-2 3-6 4-10 3-2-.5-4-2-5-5z",
    "M15 10.5h.01",
    c(19.5, 5, 1.8),
  ],
  owl: [
    "M6 8L4.5 4l4 2a8 8 0 0 1 7 0l4-2L18 8c1.3 1.7 2 3.8 2 6 0 4-3.6 7-8 7s-8-3-8-7c0-2.2.7-4.3 2-6z",
    c(9, 12.5, 2),
    c(15, 12.5, 2),
    "M11.5 16l.5 1 .5-1",
  ],
  trophy: [
    "M8 4h8v5a4 4 0 0 1-8 0z",
    "M8 6H5a3 3 0 0 0 3 4",
    "M16 6h3a3 3 0 0 1-3 4",
    "M12 13v4",
    "M8.5 20h7",
    "M9.5 17h5v3h-5z",
  ],
  body: [c(12, 4.5, 2), "M5 9h14", "M12 9v6", "M12 15l-3.5 6", "M12 15l3.5 6"],
  leg: ["M9 3c0 4 1 6.5 3 8.5l3.5 3V20h4", "M12 11.5l-3.5 3.5V21H5"],
  round: [...dotPaths(pts(6, 8.5, 0, 12, 12)), c(12, 12, 3.5)],
  eye: ["M2.5 12S6.5 5 12 5s9.5 7 9.5 7-4 7-9.5 7S2.5 12 2.5 12z", "M10.5 9.5v5l4-2.5z"],
  trend: ["M3 17l5-5 4 3 8-8", "M15 7h5v5"],
  alarm: [c(12, 13, 7), "M12 9.5v3.5l2.5 2", "M4 6l3-2.5", "M20 6l-3-2.5"],
  pen: ["M3 18c3-4 5-4 6-2s3 2 5-2", "M14 9l5-5 2 2-5 5-3 1z", "M3 21h18"],
  check: ["M8 3h8v3H8z", "M6 4.5H5V21h14V4.5h-1", "M8.5 14l2.5 2.5 4.5-5"],
  cap: ["M2 9l10-5 10 5-10 5z", "M6 11v5c3 2 9 2 12 0v-5", "M22 9v5"],
  sliders: [
    "M4 6h9",
    "M17 6h3",
    "M4 12h3",
    "M11 12h9",
    "M4 18h11",
    "M19 18h1",
    c(15, 6, 2),
    c(9, 12, 2),
    c(17, 18, 2),
  ],
  hand: [
    "M8 13V7a1.5 1.5 0 0 1 3 0v4",
    "M11 10.5V5a1.5 1.5 0 0 1 3 0v6",
    "M14 10.5V7a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.8l-2-3.7a1.5 1.5 0 0 1 2.5-1.6L8 13",
    "M19.5 2.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z",
  ],
  chef: ["M7 14a4 4 0 0 1-1-7.8 5 5 0 0 1 9.5-1.4A4 4 0 1 1 17 14", "M7 14h10v6H7z", "M7 17h10"],
  download: ["M12 3v11", "M8 10l4 4 4-4", "M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"],
  bulb: [
    "M9 18h6",
    "M10 21h4",
    "M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z",
  ],
  weekLens: ["M3 4h12v5H3z", "M6 4v5", "M9 4v5", "M12 4v5", c(14.5, 15, 4), "M17.5 18l3.5 3.5"],
  fireworks: [
    "M12 12V3",
    "M12 12l6.4-6.4",
    "M12 12h9",
    "M12 12l6.4 6.4",
    "M12 12v9",
    "M12 12l-6.4 6.4",
    "M12 12H3",
    "M12 12L5.6 5.6",
  ],
  pudding: [
    "M4 14a8 6.5 0 0 1 16 0z",
    "M4 14c0 3.3 3.6 6 8 6s8-2.7 8-6",
    "M5.5 12c2 1 3-1 5 0s3-1 5 0 2.5-1 3 0",
    "M12 4v3",
    "M10 5l2 2 2-2",
  ],
  pumpkin: [
    "M12 7c-5 0-8 3-8 7s3 7 8 7 8-3 8-7-3-7-8-7z",
    "M12 7c-2 0-3 3-3 7s1 7 3 7 3-3 3-7-1-7-3-7z",
    "M12 7V4l2-1",
  ],
  frog: [
    "M5 14c0-4 3-7 7-7s7 3 7 7c0 3-3 5-7 5s-7-2-7-5z",
    c(8, 7, 2),
    c(16, 7, 2),
    "M9 15c1.5 1 4.5 1 6 0",
    "M4 20.5l3-2",
    "M20 20.5l-3-2",
  ],
  moonCookie: [
    "M10 3a7 7 0 1 0 7 10 5.5 5.5 0 0 1-7-10z",
    c(17.5, 17.5, 4),
    "M16.5 16.5h.01",
    "M18.5 18.5h.01",
  ],
  cake: [
    "M4 14h16v7H4z",
    "M4 17c2 1 4-1 6 0s4-1 6 0 3-1 4 0",
    "M12 14V10",
    "M12 5c1.2 1 1.2 2.4 0 3.4-1.2-1-1.2-2.4 0-3.4z",
  ],
  crown: ["M4 17L3 7l5 4 4-6 4 6 5-4-1 10z", "M4 20.5h16"],
} satisfies Record<string, readonly string[]>;

export type BadgeMotifName = keyof typeof BADGE_MOTIFS;

export type BadgeArt = Readonly<{
  motif: BadgeMotifName;
  /** The threshold on the ribbon. Data, because the board labels some single target badges and not others. */
  ribbonLabel?: string;
}>;

/** The motif and ribbon label of each badge, by catalogue id. A one-off has no ribbon. */
export const BADGE_ART: Readonly<Record<AchievementId, BadgeArt>> = {
  "first-bite": { motif: "apple" },
  "set-the-course": { motif: "flag" },
  "on-the-scales": { motif: "scale", ribbonLabel: "1" },
  "beep-beep": { motif: "barcode", ribbonLabel: "1" },
  "home-cook": { motif: "book", ribbonLabel: "1" },
  "soft-spot": { motif: "heart", ribbonLabel: "1" },
  "first-rep": { motif: "dumbbell", ribbonLabel: "1" },
  planner: { motif: "plan", ribbonLabel: "1" },
  "hello-ki-lo": { motif: "chat", ribbonLabel: "1" },
  "nudge-me": { motif: "bell" },
  "measured-up": { motif: "donut", ribbonLabel: "1" },
  "closing-time": { motif: "moonCheck" },
  jotter: { motif: "log", ribbonLabel: "10" },
  notebook: { motif: "log", ribbonLabel: "50" },
  centurion: { motif: "log", ribbonLabel: "100" },
  "quarter-master": { motif: "log", ribbonLabel: "250" },
  diarist: { motif: "log", ribbonLabel: "500" },
  "grand-log": { motif: "log", ribbonLabel: "1K" },
  archivist: { motif: "log", ribbonLabel: "2.5K" },
  encyclopaedia: { motif: "log", ribbonLabel: "5K" },
  "a-month-of-meals": { motif: "cal", ribbonLabel: "30" },
  "hundred-days": { motif: "cal", ribbonLabel: "100" },
  "year-in-the-book": { motif: "cal", ribbonLabel: "365" },
  "hat-trick": { motif: "flame", ribbonLabel: "3" },
  "full-week": { motif: "flame", ribbonLabel: "7" },
  fortnight: { motif: "flame", ribbonLabel: "14" },
  "habit-forming": { motif: "flame", ribbonLabel: "21" },
  "month-strong": { motif: "flame", ribbonLabel: "30" },
  "two-months": { motif: "flame", ribbonLabel: "60" },
  "quarter-year": { motif: "flame", ribbonLabel: "90" },
  "half-year": { motif: "flame", ribbonLabel: "180" },
  "full-circle": { motif: "flame", ribbonLabel: "365" },
  unstoppable: { motif: "flame", ribbonLabel: "500" },
  "back-on-track": { motif: "back" },
  "saved-by-the-snow": { motif: "snowShield" },
  "weekend-warrior": { motif: "swords" },
  stockpile: { motif: "stock" },
  "protein-pioneer": { motif: "protein", ribbonLabel: "1" },
  "protein-week": { motif: "protein", ribbonLabel: "7" },
  "protein-month": { motif: "protein", ribbonLabel: "30" },
  "protein-pro": { motif: "protein", ribbonLabel: "100" },
  bullseye: { motif: "target", ribbonLabel: "1" },
  "steady-hand": { motif: "target", ribbonLabel: "7" },
  "dialled-in": { motif: "target", ribbonLabel: "30" },
  precision: { motif: "target", ribbonLabel: "100" },
  "balanced-plate": { motif: "plate" },
  "perfect-week": { motif: "seven" },
  "fibre-fan": { motif: "wheat" },
  "morning-logger": { motif: "sunrise" },
  taster: { motif: "variety", ribbonLabel: "25" },
  "varied-diet": { motif: "variety", ribbonLabel: "50" },
  adventurous: { motif: "variety", ribbonLabel: "100" },
  omnivore: { motif: "variety", ribbonLabel: "250" },
  explorer: { motif: "compass" },
  "creature-of-habit": { motif: "loop" },
  scanner: { motif: "barcode", ribbonLabel: "10" },
  "barcode-collector": { motif: "barcode", ribbonLabel: "50" },
  "checkout-champion": { motif: "barcode", ribbonLabel: "100" },
  "recipe-box": { motif: "book", ribbonLabel: "5" },
  cookbook: { motif: "book", ribbonLabel: "10" },
  "head-chef": { motif: "book", ribbonLabel: "25" },
  regular: { motif: "cloche", ribbonLabel: "10" },
  "house-special": { motif: "cloche", ribbonLabel: "50" },
  "batch-cook": { motif: "pot" },
  "week-ahead": { motif: "plan", ribbonLabel: "7" },
  "master-planner": { motif: "plan", ribbonLabel: "28" },
  "list-maker": { motif: "clip" },
  "basket-case": { motif: "basket" },
  "routine-builder": { motif: "cards" },
  "warmed-up": { motif: "dumbbell", ribbonLabel: "5" },
  "ten-down": { motif: "dumbbell", ribbonLabel: "10" },
  "regular-at-the-rack": { motif: "dumbbell", ribbonLabel: "25" },
  "fifty-sessions": { motif: "dumbbell", ribbonLabel: "50" },
  "hundred-club": { motif: "dumbbell", ribbonLabel: "100" },
  "iron-habit": { motif: "dumbbell", ribbonLabel: "250" },
  lifer: { motif: "dumbbell", ribbonLabel: "500" },
  "set-counter": { motif: "tally", ribbonLabel: "100" },
  "thousand-sets": { motif: "tally", ribbonLabel: "1K" },
  "ten-thousand": { motif: "tally", ribbonLabel: "10K" },
  "ten-tonnes": { motif: "kettle", ribbonLabel: "10t" },
  "hundred-tonnes": { motif: "kettle", ribbonLabel: "100t" },
  megalifter: { motif: "kettle", ribbonLabel: "1000t" },
  "big-session": { motif: "bolt" },
  "two-good-weeks": { motif: "chain", ribbonLabel: "2" },
  "four-weeks-solid": { motif: "chain", ribbonLabel: "4" },
  "eight-weeks": { motif: "chain", ribbonLabel: "8" },
  "quarter-of-graft": { motif: "chain", ribbonLabel: "12" },
  "half-a-year-of-iron": { motif: "chain", ribbonLabel: "26" },
  "year-of-iron": { motif: "chain", ribbonLabel: "52" },
  "early-bird": { motif: "bird" },
  "night-owl": { motif: "owl" },
  "personal-best": { motif: "trophy", ribbonLabel: "1" },
  "on-a-roll": { motif: "trophy", ribbonLabel: "10" },
  "record-breaker": { motif: "trophy", ribbonLabel: "50" },
  "hall-of-fame": { motif: "trophy", ribbonLabel: "100" },
  "full-body": { motif: "body" },
  "leg-day-legend": { motif: "leg" },
  "well-rounded": { motif: "round" },
  "form-check": { motif: "eye" },
  "weekly-weigh": { motif: "scale", ribbonLabel: "10" },
  "data-driven": { motif: "scale", ribbonLabel: "50" },
  "trend-setter": { motif: "scale", ribbonLabel: "100" },
  "every-single-day": { motif: "scale", ribbonLabel: "365" },
  "four-weeks-weighed": { motif: "trend", ribbonLabel: "4" },
  "quarter-weighed": { motif: "trend", ribbonLabel: "12" },
  "year-weighed": { motif: "trend", ribbonLabel: "52" },
  "body-reader": { motif: "donut", ribbonLabel: "10" },
  "morning-routine": { motif: "alarm" },
  "composition-collector": { motif: "donut", ribbonLabel: "50" },
  "signed-up": { motif: "pen" },
  "checking-in": { motif: "check", ribbonLabel: "1" },
  "monthly-review": { motif: "check", ribbonLabel: "4" },
  "quarterly-review": { motif: "check", ribbonLabel: "12" },
  graduate: { motif: "cap" },
  "course-correct": { motif: "sliders" },
  chatterbox: { motif: "chat", ribbonLabel: "10" },
  "hands-free": { motif: "hand" },
  "sous-chef": { motif: "chef" },
  "your-data": { motif: "download" },
  "ideas-person": { motif: "bulb" },
  "favourites-fan": { motif: "heart", ribbonLabel: "25" },
  "weekly-review": { motif: "weekLens" },
  "new-year-new-log": { motif: "fireworks" },
  "festive-feast": { motif: "pudding" },
  "spooky-snacks": { motif: "pumpkin" },
  "leap-of-faith": { motif: "frog" },
  "midnight-snack": { motif: "moonCookie" },
  anniversary: { motif: "cake" },
  collector: { motif: "crown", ribbonLabel: "50" },
  completionist: { motif: "crown", ribbonLabel: "100" },
};

export type BadgeGradientName =
  "bronze" | "silver" | "gold" | "goldRim" | "platinum" | "platinumRim";

type GradientStop = Readonly<{ offset: number; token: TierColourToken }>;

/** A linear gradient across the shape it fills, with the corners the board gives it as fractions of the shape. */
export type BadgeGradient = Readonly<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: readonly GradientStop[];
}>;

/** The six metal gradients of the board. Each badge draws them under ids of its own, so several share a screen. */
export const BADGE_GRADIENTS: Readonly<Record<BadgeGradientName, BadgeGradient>> = {
  bronze: {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
    stops: [
      { offset: 0, token: "tier-bronze-hi" },
      { offset: 0.5, token: "tier-bronze-mid" },
      { offset: 1, token: "tier-bronze-lo" },
    ],
  },
  silver: {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
    stops: [
      { offset: 0, token: "tier-silver-hi" },
      { offset: 0.45, token: "tier-silver-mid" },
      { offset: 1, token: "tier-silver-lo" },
    ],
  },
  gold: {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
    stops: [
      { offset: 0, token: "tier-gold-hi" },
      { offset: 0.5, token: "tier-gold-mid" },
      { offset: 1, token: "tier-gold-lo" },
    ],
  },
  goldRim: {
    x1: 0,
    y1: 1,
    x2: 1,
    y2: 0,
    stops: [
      { offset: 0, token: "tier-gold-lo" },
      { offset: 0.55, token: "tier-gold-hi" },
      { offset: 1, token: "tier-gold-mid" },
    ],
  },
  platinum: {
    x1: 0,
    y1: 0,
    x2: 1,
    y2: 1,
    stops: [
      { offset: 0, token: "tier-plat-b" },
      { offset: 0.35, token: "tier-plat-c" },
      { offset: 0.65, token: "tier-plat-d" },
      { offset: 1, token: "tier-plat-a" },
    ],
  },
  platinumRim: {
    x1: 1,
    y1: 0,
    x2: 0,
    y2: 1,
    stops: [
      { offset: 0, token: "tier-plat-a" },
      { offset: 0.5, token: "tier-plat-b" },
      { offset: 1, token: "tier-plat-c" },
    ],
  },
};

export type BadgePaint =
  Readonly<{ token: TierColourToken }> | Readonly<{ gradient: BadgeGradientName }>;

/** One mark of a badge. Stroke and fill are left off when the mark has none. */
export type BadgeShape =
  | Readonly<{
      kind: "circle";
      radius: number;
      fill?: BadgePaint;
      stroke?: TierColourToken;
      strokeWidth?: number;
    }>
  | Readonly<{
      kind: "path";
      d: string;
      fill?: BadgePaint;
      stroke?: TierColourToken;
      strokeWidth?: number;
      /** Round line ends and corners. */
      rounded?: boolean;
      opacity?: number;
    }>
  | Readonly<{
      kind: "text";
      text: string;
      x: number;
      y: number;
      fontSize: number;
      fill: TierColourToken;
    }>
  | Readonly<{
      kind: "group";
      translateX: number;
      translateY: number;
      shapes: readonly BadgeShape[];
    }>;

export type BadgeDrawing = Readonly<{
  /** The marks to draw in order, in the 64 by 64 view box. */
  shapes: readonly BadgeShape[];
  /** The gradients the marks use, so a drawing defines only those. */
  gradients: readonly BadgeGradientName[];
}>;

type TierFrame = Readonly<{
  /** The sunburst of a gold badge or the octagon of a platinum one, behind the rim. */
  back?: Readonly<{ d: string; gradient: BadgeGradientName }>;
  facets?: string;
  rim: Readonly<{ radius: number; gradient: BadgeGradientName }>;
  beads?: string;
  enamelRadius: number;
  edge: TierColourToken;
  shine?: string;
  sparks?: string;
  motif: TierColourToken;
  ribbon: TierColourToken;
}>;

const burstPoints = Array.from({ length: 32 }, (_, i): Point => {
  const a = (i / 32) * Math.PI * 2;
  const r = i % 2 === 1 ? 27.6 : 31.2;
  return [32 + r * Math.sin(a), 32 - r * Math.cos(a)];
});
// The octagon's eight corners, each with the point on the inner ring that its facet line runs to.
const octagonCorners = Array.from({ length: 8 }, (_, i) => ({
  outer: ringPoint(8, 31.5, Math.PI / 8, 32, 32, i),
  inner: ringPoint(8, 25.5, Math.PI / 8, 32, 32, i),
}));

/** The frame of each tier: a plain ring, a beaded rim, a sunburst with a shine, a faceted octagon with sparkles. */
const FRAMES: Readonly<Record<AchievementTier, TierFrame>> = {
  bronze: {
    rim: { radius: 28, gradient: "bronze" },
    enamelRadius: 22,
    edge: "tier-bronze-lo",
    motif: "tier-bronze-hi",
    ribbon: "tier-bronze-mid",
  },
  silver: {
    rim: { radius: 29.5, gradient: "silver" },
    beads: dotPaths(pts(16, 25.3, 0, 32, 32)).join(""),
    enamelRadius: 21.5,
    edge: "tier-silver-lo",
    motif: "tier-silver-hi",
    ribbon: "tier-silver-mid",
  },
  gold: {
    back: { d: poly(burstPoints), gradient: "gold" },
    rim: { radius: 26.5, gradient: "goldRim" },
    enamelRadius: 21,
    edge: "tier-gold-lo",
    shine: "M15 25a18 18 0 0 1 12-12",
    motif: "tier-gold-hi",
    ribbon: "tier-gold-mid",
  },
  platinum: {
    back: { d: poly(octagonCorners.map(({ outer }) => outer)), gradient: "platinum" },
    facets: octagonCorners
      .map(
        ({ outer, inner }) =>
          `M${outer[0].toFixed(2)} ${outer[1].toFixed(2)}L${inner[0].toFixed(2)} ${inner[1].toFixed(2)}`,
      )
      .join(""),
    rim: { radius: 25.5, gradient: "platinumRim" },
    enamelRadius: 20.5,
    edge: "tier-plat-c",
    sparks: [
      star(32, 3.6, 3.4),
      star(23.5, 5.4, 2),
      star(40.5, 5.4, 2),
      star(6, 9, 2.4),
      star(58, 55, 2.2),
    ].join(""),
    motif: "tier-plat-a",
    ribbon: "tier-plat-a",
  },
};

const MOTIF_STROKE_WIDTH = 1.75;
const MOTIF_OFFSET_X = 20;
// With a ribbon the motif sits higher, to leave room for it.
const MOTIF_OFFSET_Y_WITH_RIBBON = 16.5;
const MOTIF_OFFSET_Y_WITHOUT_RIBBON = 20;
const RIBBON_PATH = "M13 45h38l-3.2 5.5 3.2 5.5H13l3.2-5.5z";

const token = (name: TierColourToken): BadgePaint => ({ token: name });

function frameShapes(frame: TierFrame, isEarned: boolean): BadgeShape[] {
  const metal = (gradient: BadgeGradientName): BadgePaint =>
    isEarned ? { gradient } : token("tier-locked");
  const shapes: BadgeShape[] = [];

  if (frame.back !== undefined) {
    shapes.push({ kind: "path", d: frame.back.d, fill: metal(frame.back.gradient) });
  }
  // A locked or hidden badge keeps its shape in one grey, so the decorations are left off.
  if (isEarned && frame.facets !== undefined) {
    shapes.push({
      kind: "path",
      d: frame.facets,
      stroke: "tier-plat-b",
      strokeWidth: 0.8,
      opacity: 0.75,
    });
  }
  shapes.push({ kind: "circle", radius: frame.rim.radius, fill: metal(frame.rim.gradient) });
  if (isEarned && frame.beads !== undefined) {
    shapes.push({
      kind: "path",
      d: frame.beads,
      stroke: "tier-silver-hi",
      strokeWidth: 2.4,
      rounded: true,
    });
  }
  shapes.push(
    { kind: "circle", radius: frame.enamelRadius, fill: token("tier-enamel") },
    {
      kind: "circle",
      radius: frame.enamelRadius,
      stroke: isEarned ? frame.edge : "tier-locked-glyph",
      strokeWidth: 1.2,
    },
  );
  if (isEarned && frame.shine !== undefined) {
    shapes.push({
      kind: "path",
      d: frame.shine,
      stroke: "tier-gold-hi",
      strokeWidth: 1.6,
      rounded: true,
    });
  }
  if (isEarned && frame.sparks !== undefined) {
    shapes.push({ kind: "path", d: frame.sparks, fill: token("tier-plat-b") });
  }
  return shapes;
}

function motifShape(
  paths: readonly string[],
  stroke: TierColourToken,
  hasRibbon: boolean,
): BadgeShape {
  return {
    kind: "group",
    translateX: MOTIF_OFFSET_X,
    translateY: hasRibbon ? MOTIF_OFFSET_Y_WITH_RIBBON : MOTIF_OFFSET_Y_WITHOUT_RIBBON,
    shapes: paths.map((d) => ({
      kind: "path",
      d,
      stroke,
      strokeWidth: MOTIF_STROKE_WIDTH,
      rounded: true,
    })),
  };
}

function ribbonShapes(
  label: string,
  fill: TierColourToken,
  textFill: TierColourToken,
): BadgeShape[] {
  return [
    { kind: "path", d: RIBBON_PATH, fill: token(fill) },
    { kind: "text", text: label, x: 32, y: 53.2, fontSize: 7.5, fill: textFill },
  ];
}

function gradientsOf(shapes: readonly BadgeShape[]): BadgeGradientName[] {
  const names = shapes.flatMap((shape) =>
    (shape.kind === "path" || shape.kind === "circle") &&
    shape.fill !== undefined &&
    "gradient" in shape.fill
      ? [shape.fill.gradient]
      : [],
  );
  return [...new Set(names)];
}

const tierByBadge = new Map(ACHIEVEMENTS.map(({ id, tier }) => [id, tier]));

/** The tier of a badge, from the catalogue. */
export function achievementTierOf(id: AchievementId): AchievementTier {
  const tier = tierByBadge.get(id);
  if (tier === undefined) {
    throw new Error(`The catalogue has no badge ${id}`);
  }
  return tier;
}

/**
 * What to draw for a badge in a state. Earned is full colour. Locked is the same frame, motif and ribbon in
 * the locked greys, so the person can see what is coming. Hidden is a grey plain ring with "???", whatever the
 * badge's tier, so the tier is not given away.
 */
export function badgeDrawing(id: AchievementId, state: BadgeState): BadgeDrawing {
  if (state === "hidden") {
    return {
      shapes: [
        ...frameShapes(FRAMES.bronze, false),
        { kind: "text", text: "???", x: 32, y: 38, fontSize: 18, fill: "tier-locked-glyph" },
      ],
      gradients: [],
    };
  }

  const frame = FRAMES[achievementTierOf(id)];
  const isEarned = state === "earned";
  const art = BADGE_ART[id];
  const hasRibbon = art.ribbonLabel !== undefined;
  const shapes = [
    ...frameShapes(frame, isEarned),
    motifShape(BADGE_MOTIFS[art.motif], isEarned ? frame.motif : "tier-locked-glyph", hasRibbon),
    ...(art.ribbonLabel === undefined
      ? []
      : ribbonShapes(
          art.ribbonLabel,
          isEarned ? frame.ribbon : "tier-locked",
          isEarned ? "tier-enamel" : "tier-locked-glyph",
        )),
  ];
  return { shapes, gradients: gradientsOf(shapes) };
}
