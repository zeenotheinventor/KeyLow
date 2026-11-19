// A canvas set is one canvas whose boards are exported into docs/design. Each set keeps its source
// verbatim in its own folder, so two canvases that both have a Main.dc.html never mix.

export type BoardName = {
  slug: string;
  state: string;
};

export type CanvasSet = {
  // The folder under docs/design that holds the canvas source (project/canvas.json and the boards).
  sourceFolder: string;
  // Set when file names do not say which screen and state a board is. Only the boards listed are
  // exported, the rest of the canvas is kept as source only.
  boardNames?: Readonly<Record<string, BoardName>>;
  // Replaces the README sentence about the frames of a mobile or web board.
  layoutNote?: string;
  // True when the boards use the Ki-Lo tokens, so each page links the token stylesheets.
  linksTokens: boolean;
  // False when the canvas has no block of proposals beyond packages/tokens, so a page links no
  // proposals stylesheet. Defaults to true.
  linksProposals?: boolean;
  // The /_blob/ URLs of the canvas's token stylesheets that the export serves from
  // packages/tokens/css/kilo-tokens.css instead of from a committed canvas copy.
  tokenBlobs?: readonly string[];
};

export const m2CanvasSet: CanvasSet = { sourceFolder: "source", linksTokens: true };

// The widget boards use raw hex and no token stylesheet.
export const widgetsCanvasSet: CanvasSet = {
  sourceFolder: "source-widgets",
  boardNames: {
    "Main.dc.html": { slug: "widgets", state: "dashboard" },
    "QuickLog.dc.html": { slug: "widgets", state: "quick-log" },
    "LockScreen.dc.html": { slug: "widgets", state: "lock-screen" },
    "States.dc.html": { slug: "widgets", state: "states" },
  },
  layoutNote: "One board with its frames side by side, each in the theme it shows.",
  linksTokens: false,
};

// The achievements boards use the Ki-Lo tokens, and the badge tier colours they proposed are in
// packages/tokens now (KEY-1080), so both of their canvas stylesheets (the tokens, then the tier
// proposals) are served from it and a page links that one stylesheet.
export const achievementsCanvasSet: CanvasSet = {
  sourceFolder: "source-achievements",
  boardNames: {
    "Main.dc.html": { slug: "achievements", state: "screen" },
    "BadgeDetail.dc.html": { slug: "achievements", state: "badge-detail" },
    "Celebrations.dc.html": { slug: "achievements", state: "celebrations" },
    "Streaks.dc.html": { slug: "achievements", state: "streaks" },
    "DayComplete.dc.html": { slug: "achievements", state: "day-complete" },
    "Reminders.dc.html": { slug: "achievements", state: "reminders-switches" },
    "WebPage.dc.html": { slug: "achievements", state: "web-page" },
    "BadgeArt.dc.html": { slug: "achievements", state: "badge-art" },
    "BadgeCatalogue.dc.html": { slug: "achievements", state: "badge-catalogue" },
  },
  layoutNote: "One board with its frames side by side, each in the theme it shows.",
  linksTokens: true,
  linksProposals: false,
  tokenBlobs: [
    "/_blob/2fe51da7acf9d6abcc3277b8f18ab330",
    "/_blob/4dca4da7a7878d551adca2cea33f5974",
  ],
};

export const canvasSets: readonly CanvasSet[] = [
  m2CanvasSet,
  widgetsCanvasSet,
  achievementsCanvasSet,
];
