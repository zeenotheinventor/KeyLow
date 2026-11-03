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

export const canvasSets: readonly CanvasSet[] = [m2CanvasSet, widgetsCanvasSet];
