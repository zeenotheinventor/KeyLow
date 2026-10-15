// Reads the canvas index (canvas.json) and turns it into the list of exported boards.

export type CanvasBoard = {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
};

export type CanvasNote = {
  x: number;
  y: number;
  text: string;
  kind: string | undefined;
};

export type Canvas = {
  order: string[];
  boards: Record<string, CanvasBoard>;
  notes: Record<string, CanvasNote>;
};

export type BoardLayout = "mobile" | "web";

export type Board = {
  // The folder under docs/design that holds the canvas source this board comes from.
  sourceFolder: string;
  fileName: string;
  slug: string;
  state: string;
  layout: BoardLayout;
  width: number;
  height: number;
  x: number;
  y: number;
  canvasTitle: string;
};

export type Section = {
  slug: string;
  heading: string;
  notes: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(source: Record<string, unknown>, key: string, context: string): number {
  const value = source[key];
  if (typeof value !== "number") {
    throw new Error(`canvas.json: ${context} needs a numeric "${key}"`);
  }
  return value;
}

function parseBoard(name: string, value: unknown): CanvasBoard {
  if (!isRecord(value)) {
    throw new Error(`canvas.json: board ${name} is not an object`);
  }
  const title = value["title"];
  return {
    x: readNumber(value, "x", name),
    y: readNumber(value, "y", name),
    w: readNumber(value, "w", name),
    h: readNumber(value, "h", name),
    title: typeof title === "string" ? title : name,
  };
}

function parseNote(name: string, value: unknown): CanvasNote {
  if (!isRecord(value) || typeof value["text"] !== "string") {
    throw new Error(`canvas.json: note ${name} needs text`);
  }
  const kind = value["kind"];
  return {
    x: readNumber(value, "x", name),
    y: readNumber(value, "y", name),
    text: value["text"],
    kind: typeof kind === "string" ? kind : undefined,
  };
}

export function parseCanvas(json: unknown): Canvas {
  if (!isRecord(json) || !isRecord(json["boards"])) {
    throw new Error("canvas.json: no boards index");
  }
  const order = json["order"];
  if (!Array.isArray(order) || !order.every((entry) => typeof entry === "string")) {
    throw new Error("canvas.json: order must be a list of file names");
  }
  const boards: Record<string, CanvasBoard> = {};
  for (const [name, value] of Object.entries(json["boards"])) {
    boards[name] = parseBoard(name, value);
  }
  for (const name of order) {
    if (!(name in boards)) {
      throw new Error(`canvas.json: ${name} is in order but has no board entry`);
    }
  }
  const notes: Record<string, CanvasNote> = {};
  if (isRecord(json["notes"])) {
    for (const [name, value] of Object.entries(json["notes"])) {
      notes[name] = parseNote(name, value);
    }
  }
  return { order, boards, notes };
}

const mainBoardFile = "Main.dc.html";
const componentFilePattern = /^[A-Z][A-Za-z]*\.dc\.html$/;
const boardFilePattern = /^(?<slug>[a-z][a-z-]*)\.(?<state>[a-z0-9][a-z0-9-]*)\.dc\.html$/;
// The Main board has no screen in its file name. Its canvas title names it, as "food-search · idle".
const mainTitlePattern = /^(?<slug>[a-z][a-z-]*) · (?<state>[a-z0-9][a-z0-9-]*)$/;
const mobileBoardWidth = 820;

export function listBoards(canvas: Canvas, sourceFolder: string): Board[] {
  const boards: Board[] = [];
  for (const fileName of canvas.order) {
    const entry = canvas.boards[fileName];
    if (entry === undefined) {
      continue;
    }
    const isMain = fileName === mainBoardFile;
    if (!isMain && componentFilePattern.test(fileName)) {
      continue;
    }
    const named = (isMain ? mainTitlePattern.exec(entry.title) : boardFilePattern.exec(fileName))
      ?.groups;
    const slug = named?.["slug"];
    const state = named?.["state"];
    if (slug === undefined || state === undefined) {
      throw new Error(`canvas.json: cannot read a screen and state from ${fileName}`);
    }
    boards.push({
      sourceFolder,
      fileName,
      slug,
      state,
      layout: entry.w === mobileBoardWidth ? "mobile" : "web",
      width: entry.w,
      height: entry.h,
      x: entry.x,
      y: entry.y,
      canvasTitle: entry.title,
    });
  }
  return boards;
}

export function listScreens(boards: readonly Board[]): string[] {
  return [...new Set(boards.map((board) => board.slug))];
}

// A screen's heading is the canvas title note that sits above its boards. Every other note
// belongs to the screen whose title is the nearest one above it.
export function sectionsOf(canvas: Canvas, boards: readonly Board[]): Map<string, Section> {
  const titles = Object.values(canvas.notes)
    .filter((note) => note.kind === "title1")
    .sort((first, second) => first.y - second.y);
  const sections = new Map<string, Section>();
  const nextTitleY = (index: number): number => titles[index + 1]?.y ?? Number.POSITIVE_INFINITY;
  titles.forEach((title, index) => {
    const slug = boards.find((board) => board.y >= title.y && board.y < nextTitleY(index))?.slug;
    if (slug === undefined) {
      return;
    }
    const notes = Object.values(canvas.notes)
      .filter((note) => note.kind !== "title1" && note.y >= title.y && note.y < nextTitleY(index))
      .sort((first, second) => first.y - second.y || first.x - second.x)
      .map((note) => note.text);
    sections.set(slug, { slug, heading: title.text, notes });
  });
  return sections;
}
