import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  BODY_ARTWORK,
  BODY_ARTWORK_SIDE_OF,
  BODY_GLOW_FILTER,
  BODY_MAP_RENDERERS,
  MUSCLE_IDS,
} from "../../src/training";

import type { BodyArtworkFigure, BodyArtworkSide } from "../../src/training";

const figures: BodyArtworkFigure[] = ["male", "female"];
const sides: BodyArtworkSide[] = ["front", "back"];

/* The ids each side holds, as the canvas "Ki-Lo training screens" boards list them. */
const frontIds = [
  "neck",
  "delt_front",
  "delt_side",
  "chest_upper",
  "chest_lower",
  "biceps",
  "forearms",
  "abs",
  "obliques",
  "quads",
  "adductors",
  "tibialis",
];
const backIds = [
  "traps_upper",
  "traps_mid",
  "delt_rear",
  "lats",
  "lower_back",
  "triceps",
  "glute_med",
  "glute_max",
  "hamstrings",
  "calves",
];

const sorted = (values: readonly string[]) => [...values].sort();

const argumentCountOfCommand: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, Z: 0 };

type ParsedPath = { subpathCount: number; closedSubpathCount: number };

/* A small SVG path parser for the absolute commands the artwork uses. It throws on anything else. */
function parseSvgPath(d: string): ParsedPath {
  if (!d.startsWith("M")) {
    throw new Error("A path must start with M");
  }
  let subpathCount = 0;
  let closedSubpathCount = 0;
  let command = "";
  let numbers: number[] = [];
  const finishCommand = () => {
    const argumentCount = argumentCountOfCommand[command];
    if (argumentCount === undefined) {
      return;
    }
    const matches = argumentCount === 0 ? numbers.length === 0 : numbers.length === argumentCount;
    if (!matches) {
      throw new Error(`${command} takes ${argumentCount} numbers, got ${numbers.length}`);
    }
    if (command === "M") {
      subpathCount += 1;
    }
    if (command === "Z") {
      closedSubpathCount += 1;
    }
    numbers = [];
  };
  for (const token of d.split(" ")) {
    if (Object.hasOwn(argumentCountOfCommand, token)) {
      finishCommand();
      command = token;
    } else if (/^-?\d+(\.\d+)?$/.test(token)) {
      numbers.push(Number(token));
    } else {
      throw new Error(`Unexpected token "${token}"`);
    }
  }
  finishCommand();
  return { subpathCount, closedSubpathCount };
}

/* Every string in the artwork, with where it lives, so a check can name the string that failed. */
const everyPath = figures.flatMap((figure) =>
  sides.flatMap((side) => {
    const { head, outline, muscles } = BODY_ARTWORK[figure][side];
    return [
      { where: `${figure} ${side} head`, d: head },
      { where: `${figure} ${side} outline`, d: outline },
      ...Object.entries(muscles).map(([muscleId, d]) => ({
        where: `${figure} ${side} ${muscleId}`,
        d,
      })),
    ];
  }),
);

describe("the muscle ids of the artwork", () => {
  describe.each(figures)("%s", (figure) => {
    it("should hold the front ids on the front and the back ids on the back", () => {
      expect(sorted(Object.keys(BODY_ARTWORK[figure].front.muscles))).toEqual(sorted(frontIds));
      expect(sorted(Object.keys(BODY_ARTWORK[figure].back.muscles))).toEqual(sorted(backIds));
    });

    it("should hold no id on both sides", () => {
      const frontKeys = Object.keys(BODY_ARTWORK[figure].front.muscles);
      const backKeys = Object.keys(BODY_ARTWORK[figure].back.muscles);
      expect(frontKeys.filter((muscleId) => backKeys.includes(muscleId))).toEqual([]);
    });

    it("should cover exactly the 22 ids of ADR 0005 across the two sides", () => {
      const union = [
        ...Object.keys(BODY_ARTWORK[figure].front.muscles),
        ...Object.keys(BODY_ARTWORK[figure].back.muscles),
      ];
      expect(sorted(union)).toEqual(sorted([...MUSCLE_IDS]));
    });

    it("should hold no key outside the muscle list", () => {
      const known: readonly string[] = MUSCLE_IDS;
      const strangers = sides
        .flatMap((side) => Object.keys(BODY_ARTWORK[figure][side].muscles))
        .filter((key) => !known.includes(key));
      expect(strangers).toEqual([]);
    });
  });

  it("should give the male and female figures the same ids on each side", () => {
    for (const side of sides) {
      expect(sorted(Object.keys(BODY_ARTWORK.female[side].muscles))).toEqual(
        sorted(Object.keys(BODY_ARTWORK.male[side].muscles)),
      );
    }
  });

  it.each(figures)(
    "should draw the %s muscles in the order the canvas paints them, later ones over earlier ones",
    (figure) => {
      expect(Object.keys(BODY_ARTWORK[figure].front.muscles)).toEqual([
        "neck",
        "delt_side",
        "delt_front",
        "chest_upper",
        "chest_lower",
        "biceps",
        "forearms",
        "abs",
        "obliques",
        "quads",
        "adductors",
        "tibialis",
      ]);
      expect(Object.keys(BODY_ARTWORK[figure].back.muscles)).toEqual(backIds);
    },
  );
});

describe("the side that holds each muscle", () => {
  it("should name the front for the 12 front ids", () => {
    for (const muscleId of frontIds) {
      expect(BODY_ARTWORK_SIDE_OF).toHaveProperty(muscleId, "front");
    }
  });

  it("should name the back for the 10 back ids", () => {
    for (const muscleId of backIds) {
      expect(BODY_ARTWORK_SIDE_OF).toHaveProperty(muscleId, "back");
    }
  });

  it("should hold one entry per muscle id and no other", () => {
    expect(sorted(Object.keys(BODY_ARTWORK_SIDE_OF))).toEqual(sorted([...MUSCLE_IDS]));
  });
});

describe("the view box and the shared shapes", () => {
  it.each(figures.flatMap((figure) => sides.map((side) => ({ figure, side }))))(
    "should use the 0 0 200 440 view box for the $figure $side figure",
    ({ figure, side }) => {
      expect(BODY_ARTWORK[figure][side].viewBox).toBe("0 0 200 440");
    },
  );

  it("should keep the same head and the same outline on both sides of a figure", () => {
    for (const figure of figures) {
      expect(BODY_ARTWORK[figure].back.head).toBe(BODY_ARTWORK[figure].front.head);
      expect(BODY_ARTWORK[figure].back.outline).toBe(BODY_ARTWORK[figure].front.outline);
    }
  });

  it("should draw the female outline differently from the male one", () => {
    expect(BODY_ARTWORK.female.front.outline).not.toBe(BODY_ARTWORK.male.front.outline);
  });
});

describe("the path syntax of the artwork", () => {
  it.each(everyPath)("should parse $where as closed absolute path data", ({ d }) => {
    const { subpathCount, closedSubpathCount } = parseSvgPath(d);
    expect(subpathCount).toBeGreaterThan(0);
    expect(closedSubpathCount).toBe(subpathCount);
  });

  it("should reject a path that does not start with M", () => {
    expect(() => parseSvgPath("L 1 2 Z")).toThrow("start with M");
  });

  it("should reject a path with the wrong number of numbers for a command", () => {
    expect(() => parseSvgPath("M 1 Z")).toThrow("M takes 2 numbers");
  });

  it("should reject a token that is neither a command nor a number", () => {
    expect(() => parseSvgPath('M 1 2 Z fill="red"')).toThrow("Unexpected token");
  });
});

describe("the artwork carries no colour", () => {
  const colourMarkers = [
    /#/,
    /rgb/i,
    /hsl/i,
    /var\(/,
    /url\(/,
    /fill/i,
    /stroke/i,
    /style/i,
    /opacity/i,
  ];

  it.each(everyPath)("should keep $where free of colour, style and fill", ({ d }) => {
    for (const marker of colourMarkers) {
      expect(d).not.toMatch(marker);
    }
  });

  it("should hold only the view box, the head, the outline and the muscles on each side", () => {
    for (const figure of figures) {
      for (const side of sides) {
        expect(sorted(Object.keys(BODY_ARTWORK[figure][side]))).toEqual([
          "head",
          "muscles",
          "outline",
          "viewBox",
        ]);
      }
    }
  });

  it("should hold only the figures male and female", () => {
    expect(sorted(Object.keys(BODY_ARTWORK))).toEqual(["female", "male"]);
    expect(sorted(Object.keys(BODY_ARTWORK.male))).toEqual(["back", "front"]);
  });
});

describe("pinned path strings", () => {
  it("should keep the head as the canvas draws it", () => {
    expect(BODY_ARTWORK.male.front.head).toBe(
      "M 100 8 C 112 8 119 18 119 31 C 119 45 111 56 100 56 C 89 56 81 45 81 31 C 81 18 88 8 100 8 Z",
    );
  });

  it("should keep the male front neck as the canvas draws it", () => {
    expect(BODY_ARTWORK.male.front.muscles.neck).toBe(
      "M 91 55 C 91 61 93 67 96 73 L 99 73 C 98 66 97 60 96 54 Z M 109 55 C 109 61 107 67 104 73 L 101 73 C 102 66 103 60 104 54 Z",
    );
  });

  it("should keep the male front abs as the canvas draws them", () => {
    expect(BODY_ARTWORK.male.front.muscles.abs).toBe(
      "M 91 125 L 94.5 125 Q 98.5 125 98.5 129 L 98.5 136 Q 98.5 140 94.5 140 L 91 140 Q 87 140 87 136 L 87 129 Q 87 125 91 125 Z M 105.5 125 L 109 125 Q 113 125 113 129 L 113 136 Q 113 140 109 140 L 105.5 140 Q 101.5 140 101.5 136 L 101.5 129 Q 101.5 125 105.5 125 Z M 91 143 L 94.5 143 Q 98.5 143 98.5 147 L 98.5 154 Q 98.5 158 94.5 158 L 91 158 Q 87 158 87 154 L 87 147 Q 87 143 91 143 Z M 105.5 143 L 109 143 Q 113 143 113 147 L 113 154 Q 113 158 109 158 L 105.5 158 Q 101.5 158 101.5 154 L 101.5 147 Q 101.5 143 105.5 143 Z M 91 161 L 94.5 161 Q 98.5 161 98.5 165 L 98.5 172 Q 98.5 176 94.5 176 L 91 176 Q 87 176 87 172 L 87 165 Q 87 161 91 161 Z M 105.5 161 L 109 161 Q 113 161 113 165 L 113 172 Q 113 176 109 176 L 105.5 176 Q 101.5 176 101.5 172 L 101.5 165 Q 101.5 161 105.5 161 Z M 87 182 L 98.5 182 L 98.5 212 Q 92 206 88 196 Q 87 190 87 186 Z M 113 182 L 101.5 182 L 101.5 212 Q 108 206 112 196 Q 113 190 113 186 Z",
    );
  });

  it("should keep the male back lower back as the canvas draws it", () => {
    expect(BODY_ARTWORK.male.back.muscles.lower_back).toBe(
      "M 98 142 C 94 156 92 170 92 184 C 92 194 94 202 98 208 L 99 208 L 99 142 Z M 102 142 C 106 156 108 170 108 184 C 108 194 106 202 102 208 L 101 208 L 101 142 Z",
    );
  });

  it("should keep the female front deltoid as the canvas draws it", () => {
    expect(BODY_ARTWORK.female.front.muscles.delt_front).toBe(
      "M 69.6 77 C 63.9 81 61.1 88 60.1 96 C 59.1 104 58 111 55 119 C 63 117 68.7 110 72.5 102 C 75.3 95 76.2 87 76.2 79 Z M 130.4 77 C 136.1 81 138.9 88 139.9 96 C 140.8 104 142 111 145 119 C 137 117 131.3 110 127.5 102 C 124.7 95 123.8 87 123.8 79 Z",
    );
  });

  it("should keep the female back calves as the canvas draws them", () => {
    expect(BODY_ARTWORK.female.back.muscles.calves).toBe(
      "M 74.1 330 C 71.4 342 71.9 356 75 368 C 77 376 80 380 83 378 C 84 364 83.8 348 81.5 334 C 79.3 330 76.2 329 74.1 330 Z M 85.6 334 C 84.8 348 85 362 86 376 C 89 380 92 376 93 368 C 94 356 92.9 342 89.7 334 C 88.6 331 86.6 331 85.6 334 Z M 125.9 330 C 128.6 342 128.1 356 125 368 C 123 376 120 380 117 378 C 116 364 116.2 348 118.5 334 C 120.7 330 123.8 329 125.9 330 Z M 114.4 334 C 115.2 348 115 362 114 376 C 111 380 108 376 107 368 C 106 356 107.1 342 110.3 334 C 111.4 331 113.4 331 114.4 334 Z",
    );
  });

  it("should keep the first move of each outline as the canvas draws it", () => {
    expect(BODY_ARTWORK.male.front.outline).toMatch(
      /^M 100 50 L 91 50 C 91 56 90 60 89 64 C 82 69 72 71 63 74 /,
    );
    expect(BODY_ARTWORK.female.front.outline).toMatch(
      /^M 100 50 L 91 50 C 91 56 90 60 89 64 C 82\.5 69 73 71 64\.8 74 /,
    );
  });
});

describe("the whole artwork", () => {
  it("should hold every string exactly as the canvas draws it", () => {
    const everyString = figures.flatMap((figure) =>
      sides.flatMap((side) => {
        const { viewBox, head, outline, muscles } = BODY_ARTWORK[figure][side];
        return [viewBox, head, outline, ...Object.values(muscles)];
      }),
    );
    expect(everyString).toHaveLength(56);
    /* SHA-256 of the strings joined by newlines, in the order the canvas component holds them. */
    expect(createHash("sha256").update(everyString.join("\n")).digest("hex")).toBe(
      "3bfe228c77308715f61f525798b5a7d9d8a64b8a8602cb6455fc61c9611a3cb9",
    );
  });
});

describe("the glow filter", () => {
  it("should hold the parameters of the canvas klglow filter", () => {
    expect(BODY_GLOW_FILTER).toEqual({
      x: "-60%",
      y: "-60%",
      width: "220%",
      height: "220%",
      standardDeviation: 3.2,
      mergeLayers: ["blur", "blur", "source"],
    });
  });
});

describe("the body map renderers", () => {
  it("should list 2D first, then 3D, so 2D reads as the default", () => {
    expect(BODY_MAP_RENDERERS).toEqual(["2d", "3d"]);
  });
});
