import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS, BADGE_ART, BADGE_MOTIFS, badgeDrawing } from "../../src/achievements";

import type { BadgeShape } from "../../src/achievements";

const motifNames = Object.keys(BADGE_MOTIFS);
const arts = Object.values(BADGE_ART);

function usesOf(motif: string) {
  return arts.filter((art) => art.motif === motif).length;
}

function tierOf(id: string) {
  const tier = ACHIEVEMENTS.find((achievement) => achievement.id === id)?.tier;
  if (tier === undefined) {
    throw new Error(`No achievement has the id ${id}`);
  }
  return tier;
}

// Every shape the drawing holds, with the contents of its groups flattened in.
type Mark = Exclude<BadgeShape, { kind: "group" }>;

function flatten(shapes: readonly BadgeShape[]): Mark[] {
  return shapes.flatMap((shape) => (shape.kind === "group" ? flatten(shape.shapes) : [shape]));
}

// Typed from the ROWS of `docs/design/source-achievements/project/BadgeCatalogue.dc.html`: the badge's number
// in the catalogue, its motif and its ribbon label. It is a second copy on purpose, so a slip in `BADGE_ART`
// cannot pass by agreeing with itself.
const BOARD_ROWS: readonly (readonly [number, string, string | undefined])[] = [
  [1, "apple", undefined],
  [2, "flag", undefined],
  [3, "scale", "1"],
  [4, "barcode", "1"],
  [5, "book", "1"],
  [6, "heart", "1"],
  [7, "dumbbell", "1"],
  [8, "plan", "1"],
  [9, "chat", "1"],
  [10, "bell", undefined],
  [11, "donut", "1"],
  [12, "moonCheck", undefined],
  [13, "log", "10"],
  [14, "log", "50"],
  [15, "log", "100"],
  [16, "log", "250"],
  [17, "log", "500"],
  [18, "log", "1K"],
  [19, "log", "2.5K"],
  [20, "log", "5K"],
  [21, "cal", "30"],
  [22, "cal", "100"],
  [23, "cal", "365"],
  [24, "flame", "3"],
  [25, "flame", "7"],
  [26, "flame", "14"],
  [27, "flame", "21"],
  [28, "flame", "30"],
  [29, "flame", "60"],
  [30, "flame", "90"],
  [31, "flame", "180"],
  [32, "flame", "365"],
  [33, "flame", "500"],
  [34, "back", undefined],
  [35, "snowShield", undefined],
  [36, "swords", undefined],
  [37, "stock", undefined],
  [38, "protein", "1"],
  [39, "protein", "7"],
  [40, "protein", "30"],
  [41, "protein", "100"],
  [42, "target", "1"],
  [43, "target", "7"],
  [44, "target", "30"],
  [45, "target", "100"],
  [46, "plate", undefined],
  [47, "seven", undefined],
  [48, "wheat", undefined],
  [49, "sunrise", undefined],
  [50, "variety", "25"],
  [51, "variety", "50"],
  [52, "variety", "100"],
  [53, "variety", "250"],
  [54, "compass", undefined],
  [55, "loop", undefined],
  [56, "barcode", "10"],
  [57, "barcode", "50"],
  [58, "barcode", "100"],
  [59, "book", "5"],
  [60, "book", "10"],
  [61, "book", "25"],
  [62, "cloche", "10"],
  [63, "cloche", "50"],
  [64, "pot", undefined],
  [65, "plan", "7"],
  [66, "plan", "28"],
  [67, "clip", undefined],
  [68, "basket", undefined],
  [69, "cards", undefined],
  [70, "dumbbell", "5"],
  [71, "dumbbell", "10"],
  [72, "dumbbell", "25"],
  [73, "dumbbell", "50"],
  [74, "dumbbell", "100"],
  [75, "dumbbell", "250"],
  [76, "dumbbell", "500"],
  [77, "tally", "100"],
  [78, "tally", "1K"],
  [79, "tally", "10K"],
  [80, "kettle", "10t"],
  [81, "kettle", "100t"],
  [82, "kettle", "1000t"],
  [83, "bolt", undefined],
  [84, "chain", "2"],
  [85, "chain", "4"],
  [86, "chain", "8"],
  [87, "chain", "12"],
  [88, "chain", "26"],
  [89, "chain", "52"],
  [90, "bird", undefined],
  [91, "owl", undefined],
  [92, "trophy", "1"],
  [93, "trophy", "10"],
  [94, "trophy", "50"],
  [95, "trophy", "100"],
  [96, "body", undefined],
  [97, "leg", undefined],
  [98, "round", undefined],
  [99, "eye", undefined],
  [100, "scale", "10"],
  [101, "scale", "50"],
  [102, "scale", "100"],
  [103, "scale", "365"],
  [104, "trend", "4"],
  [105, "trend", "12"],
  [106, "trend", "52"],
  [107, "donut", "10"],
  [108, "alarm", undefined],
  [109, "donut", "50"],
  [110, "pen", undefined],
  [111, "check", "1"],
  [112, "check", "4"],
  [113, "check", "12"],
  [114, "cap", undefined],
  [115, "sliders", undefined],
  [116, "chat", "10"],
  [117, "hand", undefined],
  [118, "chef", undefined],
  [119, "download", undefined],
  [120, "bulb", undefined],
  [121, "heart", "25"],
  [122, "weekLens", undefined],
  [123, "fireworks", undefined],
  [124, "pudding", undefined],
  [125, "pumpkin", undefined],
  [126, "frog", undefined],
  [127, "moonCookie", undefined],
  [128, "cake", undefined],
  [129, "crown", "50"],
  [130, "crown", "100"],
];

// The sha256 of `JSON.stringify(BADGE_MOTIFS)`, taken from the `G` table of the same board source, not from
// `art.ts`. Regenerate it only after the board's motifs change: hash `JSON.stringify(G)` evaluated from the board.
const BOARD_MOTIFS_DIGEST = "fcb9a984f59ce8746855afec2dacf4ad647f46d392a5ba0d54c2abf06b7ef6fb";

describe("the badge art against the board", () => {
  it("should give each badge the motif and ribbon label the board's row has", () => {
    const fromCatalogue = ACHIEVEMENTS.map(({ id, number }) => [
      number,
      BADGE_ART[id].motif,
      BADGE_ART[id].ribbonLabel,
    ]);

    expect(fromCatalogue).toEqual(BOARD_ROWS.map((row) => [...row]));
  });

  it("should draw every motif path as the board does", () => {
    const digest = createHash("sha256").update(JSON.stringify(BADGE_MOTIFS)).digest("hex");

    expect(digest).toBe(BOARD_MOTIFS_DIGEST);
  });
});

describe("the badge art", () => {
  it("should have art for each of the 130 badges and for no other", () => {
    expect(Object.keys(BADGE_ART).sort()).toEqual(ACHIEVEMENTS.map(({ id }) => id).sort());
    expect(Object.keys(BADGE_ART)).toHaveLength(130);
  });

  it("should have 62 motifs, each used by at least one badge", () => {
    expect(motifNames).toHaveLength(62);
    expect(motifNames.filter((motif) => usesOf(motif) === 0)).toEqual([]);
  });

  it("should only name motifs that exist", () => {
    expect(arts.filter((art) => !motifNames.includes(art.motif))).toEqual([]);
  });

  it("should share 22 series motifs between 90 badges and give 40 one-offs a motif each", () => {
    const seriesMotifs = motifNames.filter((motif) => usesOf(motif) >= 2);
    const oneOffMotifs = motifNames.filter((motif) => usesOf(motif) === 1);

    expect(seriesMotifs).toHaveLength(22);
    expect(seriesMotifs.reduce((total, motif) => total + usesOf(motif), 0)).toBe(90);
    expect(oneOffMotifs).toHaveLength(40);
  });

  it("should give every series badge a ribbon label and no one-off one", () => {
    const withRibbon = arts.filter((art) => art.ribbonLabel !== undefined);
    const inSeries = arts.filter((art) => usesOf(art.motif) >= 2);

    expect(withRibbon).toHaveLength(90);
    expect(withRibbon).toEqual(inSeries);
  });

  it("should label some single target badges and not others, as the board does", () => {
    expect(BADGE_ART["on-the-scales"].ribbonLabel).toBe("1");
    expect(BADGE_ART["first-bite"].ribbonLabel).toBeUndefined();
  });

  it("should never draw two badges the same: motif, tier and ribbon label are unique", () => {
    const looks = ACHIEVEMENTS.map(
      ({ id, tier }) => `${BADGE_ART[id].motif}|${tier}|${BADGE_ART[id].ribbonLabel ?? ""}`,
    );

    expect(new Set(looks).size).toBe(130);
  });

  it("should draw every motif as stroke paths on the 24 by 24 grid", () => {
    for (const paths of Object.values(BADGE_MOTIFS)) {
      expect(paths.length).toBeGreaterThan(0);
      expect(paths.every((path) => path.startsWith("M"))).toBe(true);
    }
  });
});

describe("badgeDrawing", () => {
  it("should draw a bronze badge as a plain ring on the enamel", () => {
    const shapes = flatten(badgeDrawing("hat-trick", "earned").shapes);
    const circles = shapes.filter((shape) => shape.kind === "circle");

    expect(circles.map((circle) => circle.radius)).toEqual([28, 22, 22]);
    expect(shapes.filter((shape) => shape.kind === "path" && shape.rounded)).toHaveLength(1);
  });

  it("should add a ring of 16 beads to a silver badge", () => {
    const shapes = flatten(badgeDrawing("fortnight", "earned").shapes);
    const beads = shapes.find((shape) => shape.kind === "path" && shape.strokeWidth === 2.4);

    expect(beads?.kind === "path" && beads.d.split("h.01")).toHaveLength(17);
  });

  it("should put a gold badge on a 32 point sunburst with a shine arc", () => {
    const shapes = flatten(badgeDrawing("month-strong", "earned").shapes);
    const burst = shapes.find(
      (shape) => shape.kind === "path" && shape.d.startsWith("M32.00 0.80"),
    );

    expect(burst?.kind === "path" && burst.d.split("L")).toHaveLength(32);
    expect(
      shapes.some((shape) => shape.kind === "path" && shape.d === "M15 25a18 18 0 0 1 12-12"),
    ).toBe(true);
  });

  it("should make a platinum badge a faceted octagon with five sparkles", () => {
    const shapes = flatten(badgeDrawing("full-circle", "earned").shapes);
    const sparkles = shapes.find(
      (shape) => shape.kind === "path" && shape.d.split("z").length === 6,
    );
    const octagon = shapes.find(
      (shape) => shape.kind === "path" && shape.d.split("L").length === 8 && shape.d.endsWith("z"),
    );

    expect(sparkles).toBeDefined();
    expect(octagon).toBeDefined();
  });

  it("should lift the motif to make room for a ribbon, and centre it without one", () => {
    const offsetOf = (id: "hat-trick" | "back-on-track") => {
      const group = badgeDrawing(id, "earned").shapes.find((shape) => shape.kind === "group");
      return group?.kind === "group" ? group.translateY : undefined;
    };

    expect(offsetOf("hat-trick")).toBe(16.5);
    expect(offsetOf("back-on-track")).toBe(20);
  });

  it("should write the threshold on the ribbon of a series badge", () => {
    const texts = flatten(badgeDrawing("fortnight", "earned").shapes).filter(
      (shape) => shape.kind === "text",
    );

    expect(texts.map((text) => text.text)).toEqual(["14"]);
  });

  it("should draw no ribbon on a one-off", () => {
    const texts = flatten(badgeDrawing("back-on-track", "earned").shapes).filter(
      (shape) => shape.kind === "text",
    );

    expect(texts).toEqual([]);
  });

  it("should keep the frame, motif and ribbon of a locked badge but in the locked greys", () => {
    const earned = flatten(badgeDrawing("month-strong", "earned").shapes);
    const locked = flatten(badgeDrawing("month-strong", "locked").shapes);
    const tokens = locked.flatMap((shape) => {
      if (shape.kind === "text") {
        return [shape.fill];
      }
      const paint = shape.fill === undefined || "gradient" in shape.fill ? [] : [shape.fill.token];
      return shape.stroke === undefined ? paint : [...paint, shape.stroke];
    });

    expect(locked.some((shape) => shape.kind === "path" && shape.d.startsWith("M12 3c1 4"))).toBe(
      true,
    );
    expect(new Set(tokens)).toEqual(new Set(["tier-locked", "tier-locked-glyph", "tier-enamel"]));
    expect(locked.length).toBeLessThan(earned.length);
    expect(badgeDrawing("month-strong", "locked").gradients).toEqual([]);
  });

  it("should draw a hidden badge as a plain grey ring with three question marks, whatever its tier", () => {
    const platinum = flatten(badgeDrawing("full-circle", "hidden").shapes);
    const bronze = flatten(badgeDrawing("hat-trick", "hidden").shapes);

    expect(platinum).toEqual(bronze);
    expect(platinum.filter((shape) => shape.kind === "text").map((text) => text.text)).toEqual([
      "???",
    ]);
    expect(
      badgeDrawing("full-circle", "hidden").shapes.some((shape) => shape.kind === "group"),
    ).toBe(false);
  });

  it("should list the gradients an earned badge needs so each can be defined once", () => {
    expect(badgeDrawing("hat-trick", "earned").gradients).toEqual(["bronze"]);
    expect(badgeDrawing("month-strong", "earned").gradients).toEqual(["gold", "goldRim"]);
    expect(badgeDrawing("full-circle", "earned").gradients).toEqual(["platinum", "platinumRim"]);
    expect(tierOf("full-circle")).toBe("platinum");
  });
});

describe("the colour of each part of a badge", () => {
  const partsOf = (state: "earned" | "locked") => {
    const shapes = flatten(badgeDrawing("fortnight", state).shapes);
    const circles = shapes.filter((shape) => shape.kind === "circle");
    const motif = shapes.find((shape) => shape.kind === "path" && shape.strokeWidth === 1.75);
    const ribbon = shapes.find((shape) => shape.kind === "path" && shape.d.startsWith("M13 45"));
    const label = shapes.find((shape) => shape.kind === "text");
    return {
      rim: circles[0]?.fill,
      enamel: circles[1]?.fill,
      edge: circles[2]?.stroke,
      motif: motif?.kind === "path" ? motif.stroke : undefined,
      ribbon: ribbon?.kind === "path" ? ribbon.fill : undefined,
      label: label?.kind === "text" ? label.fill : undefined,
    };
  };

  it("should colour an earned silver badge from the silver tokens, the label on the enamel", () => {
    expect(partsOf("earned")).toEqual({
      rim: { gradient: "silver" },
      enamel: { token: "tier-enamel" },
      edge: "tier-silver-lo",
      motif: "tier-silver-hi",
      ribbon: { token: "tier-silver-mid" },
      label: "tier-enamel",
    });
  });

  it("should colour a locked badge part by part: grey metal, glyph grey edge, motif and label", () => {
    expect(partsOf("locked")).toEqual({
      rim: { token: "tier-locked" },
      enamel: { token: "tier-enamel" },
      edge: "tier-locked-glyph",
      motif: "tier-locked-glyph",
      ribbon: { token: "tier-locked" },
      label: "tier-locked-glyph",
    });
  });
});
