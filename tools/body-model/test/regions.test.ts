import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MUSCLE_IDS } from "../../../packages/core/src/training/muscles.ts";

const enginePath = join(import.meta.dirname, "../blender/regions.py");
const trunkPath = join(import.meta.dirname, "../regions/male/trunk.json");
const sha256 = "a".repeat(64);
const anyFingerprint = "c".repeat(64);

type Shape = Record<string, unknown>;
type RegionEntry = {
  id: string;
  priority: number;
  facing?: string;
  shape: Shape;
  addFaces?: number[];
  removeFaces?: number[];
};
type GroupData = {
  sourceSha256: string;
  multiresLevel: number;
  faceCount: number;
  faceFingerprint: string;
  regions: RegionEntry[];
};
/** A face is its point in the body frame (side, height, depth) and its normal Y. */
type Face = [number, number, number, number];
type EngineResult = {
  ids: string[];
  report: {
    counts: Record<string, number>;
    unclaimed: number[];
    claimedTwice: [number, string[]][];
  };
  islands: [string, number[]][];
  muscleIds: string[];
};
type EngineRun = { ok: true; result: EngineResult } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEngineResult(value: unknown): value is EngineResult {
  return (
    isRecord(value) &&
    Array.isArray(value.ids) &&
    isRecord(value.report) &&
    Array.isArray(value.islands) &&
    Array.isArray(value.muscleIds)
  );
}

function isGroupData(value: unknown): value is GroupData {
  return (
    isRecord(value) &&
    typeof value.sourceSha256 === "string" &&
    typeof value.faceCount === "number" &&
    typeof value.faceFingerprint === "string" &&
    Array.isArray(value.regions)
  );
}

function parseJson(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  return parsed;
}

type EngineRequest = {
  groups?: Record<string, Partial<GroupData>>;
  faces?: Face[];
  worldFaces?: Face[];
  frame?: { floorZ: number; height: number; midlineX: number; centreY: number };
  bundleSha256?: string;
  neighbours?: number[][];
  verifyFaces?: boolean;
  fingerprintOf?: boolean;
};

/** The engine is pure Python, so the tests run it as the command line at the bottom of regions.py does. Without
 * python3 the tests fail, they do not skip, because skipping would hide the engine from CI. */
function runEngineOnText(input: string): { status: number | null; stdout: string; stderr: string } {
  const run = spawnSync("python3", ["-I", enginePath], { input, encoding: "utf8" });
  if (run.error || run.status === null) {
    throw new Error("python3 is required to test blender/regions.py");
  }
  return run;
}

function runEngineRaw(input: string): EngineRun {
  const run = runEngineOnText(input);
  const output = parseJson(run.stdout);
  if (run.status === 0 && isEngineResult(output)) {
    return { ok: true, result: output };
  }
  if (isRecord(output) && typeof output.error === "string") {
    return { ok: false, error: output.error };
  }
  throw new Error(`The engine printed something unexpected: ${run.stdout} ${run.stderr}`);
}

function runEngine(request: EngineRequest): EngineRun {
  return runEngineRaw(JSON.stringify({ bundleSha256: sha256, ...request }));
}

function fingerprintOf(faces: Face[]): string {
  const run = runEngineOnText(JSON.stringify({ fingerprintOf: true, faces }));
  const output = parseJson(run.stdout);
  if (isRecord(output) && typeof output.fingerprint === "string") {
    return output.fingerprint;
  }
  throw new Error(`No fingerprint: ${run.stdout} ${run.stderr}`);
}

function groupData(regions: RegionEntry[], overrides: Partial<GroupData> = {}): GroupData {
  return {
    sourceSha256: sha256,
    multiresLevel: 2,
    faceCount: 1,
    faceFingerprint: anyFingerprint,
    regions,
    ...overrides,
  };
}

function trunk(...regions: RegionEntry[]): Record<string, GroupData> {
  return { trunk: groupData(regions) };
}

function errorOf(run: EngineRun): string {
  if (run.ok) {
    throw new Error("The engine did not fail.");
  }
  return run.error;
}

function idsOf(run: EngineRun): string[] {
  if (!run.ok) {
    throw new Error(run.error);
  }
  return run.result.ids;
}

const frontFace = (side: number, height: number, depth = 0): Face => [side, height, depth, -1];
const backFace = (side: number, height: number): Face => [side, height, 0, 1];

describe("shapes", () => {
  const faces = [frontFace(0.05, 0.7), frontFace(0.2, 0.7), frontFace(0.05, 0.9)];

  it("claims the faces inside a box and leaves the rest to body", () => {
    const run = runEngine({
      groups: trunk({
        id: "abs",
        priority: 100,
        shape: { type: "box", side: [0, 0.1], height: [0.6, 0.8] },
      }),
      faces,
    });

    expect(idsOf(run)).toEqual(["abs", "body", "body"]);
  });

  it("treats a box axis that is left out as unbounded", () => {
    const run = runEngine({
      groups: trunk({ id: "abs", priority: 100, shape: { type: "box", height: [0.6, 0.8] } }),
      faces,
    });

    expect(idsOf(run)).toEqual(["abs", "abs", "body"]);
  });

  it("claims the faces inside an ellipsoid", () => {
    const run = runEngine({
      groups: trunk({
        id: "abs",
        priority: 100,
        shape: { type: "ellipsoid", centre: [0.05, 0.7, 0], radii: [0.02, 0.05, 0.05] },
      }),
      faces,
    });

    expect(idsOf(run)).toEqual(["abs", "body", "body"]);
  });

  it("claims the faces on the normal side of a plane", () => {
    const run = runEngine({
      groups: trunk({
        id: "abs",
        priority: 100,
        shape: { type: "plane", point: [0, 0.8, 0], normal: [0, 1, 0] },
      }),
      faces,
    });

    expect(idsOf(run)).toEqual(["body", "body", "abs"]);
  });

  it("combines shapes with union, intersection and difference", () => {
    const low = { type: "box", height: [0.6, 0.75] };
    const near = { type: "box", side: [0, 0.1] };
    const claimed = (shape: Shape) =>
      idsOf(runEngine({ groups: trunk({ id: "abs", priority: 100, shape }), faces }));

    expect(claimed({ type: "union", of: [low, near] })).toEqual(["abs", "abs", "abs"]);
    expect(claimed({ type: "intersection", of: [low, near] })).toEqual(["abs", "body", "body"]);
    expect(claimed({ type: "difference", from: low, minus: near })).toEqual([
      "body",
      "abs",
      "body",
    ]);
  });

  it("uses the distance from the midline, so one rule covers both sides", () => {
    const run = runEngine({
      groups: trunk({
        id: "abs",
        priority: 100,
        shape: { type: "box", side: [0.04, 0.1] },
      }),
      faces: [frontFace(0.05, 0.7)],
    });

    expect(idsOf(run)).toEqual(["abs"]);
  });

  it("rejects an unknown shape with a message that names it", () => {
    const run = runEngine({
      groups: trunk({ id: "abs", priority: 100, shape: { type: "blob" } }),
      faces,
    });

    expect(errorOf(run)).toContain("unknown shape type 'blob'");
  });
});

describe("outline shapes", () => {
  // A diamond from (0, 0.6) up to (0, 0.8), 0.1 wide at height 0.7, drawn on the right and mirrored to the left.
  const diamond = {
    type: "outline",
    mirror: true,
    smooth: false,
    points: [
      [0, 0.8],
      [0.1, 0.7],
      [0, 0.6],
    ],
  };
  const claimed = (shape: Shape, faces: Face[]) =>
    idsOf(runEngine({ groups: trunk({ id: "abs", priority: 100, shape }), faces }));

  it("claims the faces inside the outline and leaves the rest to body", () => {
    expect(
      claimed(diamond, [frontFace(0.02, 0.7), frontFace(0.09, 0.7), frontFace(0.09, 0.78)]),
    ).toEqual(["abs", "abs", "body"]);
  });

  it("uses the distance from the midline, so a mirrored outline covers both sides", () => {
    expect(claimed(diamond, [frontFace(0.05, 0.7)])).toEqual(["abs"]);
  });

  it("bulges past the straight edges when the outline is smooth", () => {
    const outsideTheStraightEdge = [frontFace(0.06, 0.76)];
    const smooth = { ...diamond, smooth: true };

    expect(claimed(diamond, outsideTheStraightEdge)).toEqual(["body"]);
    expect(claimed(smooth, outsideTheStraightEdge)).toEqual(["abs"]);
  });

  it("claims a shape that does not touch the midline", () => {
    const wing = {
      type: "outline",
      points: [
        [0.05, 0.6],
        [0.1, 0.6],
        [0.1, 0.7],
        [0.05, 0.7],
      ],
    };

    expect(
      claimed(wing, [frontFace(0.075, 0.65), frontFace(0.02, 0.65), frontFace(0.2, 0.65)]),
    ).toEqual(["abs", "body", "body"]);
  });

  it("bounds the depth when asked to", () => {
    const front = { ...diamond, depth: [0, 1] };

    expect(claimed(front, [frontFace(0.02, 0.7, 0.05), frontFace(0.02, 0.7, -0.05)])).toEqual([
      "abs",
      "body",
    ]);
  });

  it("rejects a mirrored outline that does not start and end on the midline", () => {
    const run = runEngine({
      groups: trunk({
        id: "abs",
        priority: 100,
        shape: {
          type: "outline",
          mirror: true,
          points: [
            [0.1, 0.8],
            [0.1, 0.7],
            [0, 0.6],
          ],
        },
      }),
      faces: [frontFace(0, 0.7)],
    });

    expect(errorOf(run)).toContain("starts and ends on the midline");
  });
});

describe("facing", () => {
  const faces: Face[] = [frontFace(0.02, 0.7), backFace(0.02, 0.7), [0.02, 0.7, 0, 0]];

  it.each([
    ["front", ["abs", "body", "body"]],
    ["back", ["body", "abs", "body"]],
    ["any", ["abs", "abs", "abs"]],
  ])("%s claims the faces that face that way", (facing, expected) => {
    const run = runEngine({
      groups: trunk({ id: "abs", priority: 100, facing, shape: { type: "box" } }),
      faces,
    });

    expect(idsOf(run)).toEqual(expected);
  });
});

describe("priority", () => {
  const everything = { type: "box" };
  const faces = [frontFace(0.02, 0.7)];

  it("gives an overlapping face to the higher priority and reports it as claimed twice", () => {
    const run = runEngine({
      groups: trunk(
        { id: "obliques", priority: 110, shape: everything },
        { id: "abs", priority: 130, shape: everything },
      ),
      faces,
    });

    expect(run).toMatchObject({
      ok: true,
      result: {
        ids: ["abs"],
        report: { claimedTwice: [[0, ["abs", "obliques"]]] },
      },
    });
  });

  it("fails when two overlapping regions share a priority, because the winner would be a guess", () => {
    const run = runEngine({
      groups: trunk(
        { id: "obliques", priority: 110, shape: everything },
        { id: "abs", priority: 110, shape: everything },
      ),
      faces,
    });

    expect(errorOf(run)).toContain("same priority");
  });

  it("lets a group in a higher band win over the trunk", () => {
    const run = runEngine({
      groups: {
        ...trunk({ id: "lats", priority: 199, shape: everything }),
        shoulders_arms: groupData([{ id: "delt_rear", priority: 200, shape: everything }]),
      },
      faces,
    });

    expect(idsOf(run)).toEqual(["delt_rear"]);
  });

  it("rejects a priority outside the group's band", () => {
    const run = runEngine({
      groups: trunk({ id: "abs", priority: 200, shape: everything }),
      faces,
    });

    expect(errorOf(run)).toContain("from 100 to 199 for the trunk group");
  });

  it("rejects an id that is not one of the 22", () => {
    const run = runEngine({
      groups: trunk({ id: "pecs", priority: 100, shape: everything }),
      faces,
    });

    expect(errorOf(run)).toContain("'pecs' is not one of the 22 muscle ids");
  });
});

describe("coverage report", () => {
  it("counts the faces per id and lists the unclaimed faces", () => {
    const run = runEngine({
      groups: trunk({ id: "abs", priority: 100, shape: { type: "box", side: [0, 0.1] } }),
      faces: [frontFace(0.05, 0.7), frontFace(0.2, 0.7), frontFace(0.3, 0.7)],
    });

    expect(run).toMatchObject({
      ok: true,
      result: { report: { counts: { abs: 1, body: 2, lats: 0 }, unclaimed: [1, 2] } },
    });
  });
});

describe("hand-tuned faces", () => {
  const faces = [frontFace(0.02, 0.7), frontFace(0.02, 0.7), frontFace(0.5, 0.7)];
  const left = { type: "box", side: [0, 0.1] };

  it("adds the faces listed in addFaces and removes the faces listed in removeFaces", () => {
    const run = runEngine({
      groups: trunk({ id: "abs", priority: 100, shape: left, addFaces: [2], removeFaces: [0] }),
      faces,
    });

    expect(idsOf(run)).toEqual(["body", "abs", "abs"]);
  });

  it("fails when a listed face is not on the body", () => {
    const run = runEngine({
      groups: trunk({ id: "abs", priority: 100, shape: left, addFaces: [99] }),
      faces,
    });

    expect(errorOf(run)).toContain("names face 99");
  });
});

describe("source hash", () => {
  const abs = { id: "abs", priority: 100, shape: { type: "box" } };
  const groups = trunk(abs);

  it("fails with a message naming both hashes when the bundle is not the one the regions were cut against", () => {
    const run = runEngine({ groups, faces: [frontFace(0, 0.5)], bundleSha256: "b".repeat(64) });

    expect(errorOf(run)).toContain(
      `sha256 is ${"b".repeat(64)} but trunk.json was cut against ${sha256}`,
    );
  });

  it("rejects a data file with no sha256", () => {
    const run = runEngine({
      groups: { trunk: groupData([abs], { sourceSha256: "" }) },
      faces: [frontFace(0, 0.5)],
    });

    expect(errorOf(run)).toContain("sourceSha256 must be");
  });
});

describe("multires level", () => {
  const abs = { id: "abs", priority: 100, shape: { type: "box" } };

  it("rejects a file that does not name the level the face numbers belong to", () => {
    const run = runEngine({
      groups: {
        trunk: {
          sourceSha256: sha256,
          faceCount: 1,
          faceFingerprint: anyFingerprint,
          regions: [abs],
        },
      },
      faces: [frontFace(0, 0.5)],
    });

    expect(errorOf(run)).toContain("multiresLevel must be a whole number from 0");
  });

  it("fails when two files name different levels", () => {
    const run = runEngine({
      groups: {
        trunk: groupData([abs]),
        legs: groupData([{ id: "quads", priority: 300, shape: { type: "box" } }], {
          multiresLevel: 3,
        }),
      },
      faces: [frontFace(0, 0.5)],
    });

    expect(errorOf(run)).toContain("different Multires levels");
  });
});

describe("islands", () => {
  it("lists the connected pieces of each id", () => {
    const neighbours = [[1], [0], [], [4], [3]];
    const run = runEngine({
      groups: trunk({ id: "abs", priority: 100, shape: { type: "box", side: [0, 0.1] } }),
      faces: [
        frontFace(0.05, 0.7),
        frontFace(0.05, 0.7),
        frontFace(0.05, 0.7),
        frontFace(0.3, 0.7),
        frontFace(0.3, 0.7),
      ],
      neighbours,
    });

    expect(run).toMatchObject({
      ok: true,
      result: {
        islands: [
          ["abs", [0, 1]],
          ["abs", [2]],
          ["body", [3, 4]],
        ],
      },
    });
  });
});

describe("symmetry", () => {
  const frame = { floorZ: -0.005, height: 1.69, midlineX: -2.264, centreY: -0.03 };
  const box = { type: "box", side: [0.04, 0.06], height: [0.5, 0.9] };
  const worldFace = (x: number): Face => [x, 0, 1, -1];

  it("gives a face on the body's left and its mirror image on the right the same id", () => {
    const run = runEngine({
      groups: trunk({ id: "abs", priority: 100, shape: box }),
      frame,
      worldFaces: [worldFace(frame.midlineX + 0.0845), worldFace(frame.midlineX - 0.0845)],
    });

    expect(idsOf(run)).toEqual(["abs", "abs"]);
  });

  it("leaves a face outside the box unclaimed on both sides", () => {
    const run = runEngine({
      groups: trunk({ id: "abs", priority: 100, shape: box }),
      frame,
      worldFaces: [worldFace(frame.midlineX + 0.5), worldFace(frame.midlineX - 0.5)],
    });

    expect(idsOf(run)).toEqual(["body", "body"]);
  });

  describe("of a smooth mirrored outline at the midline", () => {
    const apexOutline = {
      type: "outline",
      mirror: true,
      points: [
        [0, 0.8],
        [0.1, 0.7],
        [0, 0.6],
      ],
    };

    it("rounds the seam: the midline is inside and the shoulder of the peak beside it is not", () => {
      const run = runEngine({
        groups: trunk({ id: "abs", priority: 100, shape: apexOutline }),
        faces: [
          frontFace(0, 0.79),
          frontFace(0.03, 0.79),
          frontFace(0.001, 0.61),
          frontFace(0, 0.7),
        ],
      });

      expect(idsOf(run)).toEqual(["abs", "body", "abs", "abs"]);
    });
  });
});

describe("rejected shapes", () => {
  const claim = (shape: Shape) =>
    runEngine({ groups: trunk({ id: "abs", priority: 100, shape }), faces: [frontFace(0, 0.5)] });

  it("refuses an outline that crosses itself", () => {
    const bowtie = {
      type: "outline",
      smooth: false,
      points: [
        [0, 0],
        [0.1, 0.1],
        [0.1, 0],
        [0, 0.1],
      ],
    };

    expect(errorOf(claim(bowtie))).toContain("crosses itself");
  });

  it("refuses a box whose minimum is above its maximum", () => {
    expect(errorOf(claim({ type: "box", side: [0.1, 0.05] }))).toContain(
      "minimum above the maximum",
    );
  });

  it("refuses a NaN coordinate", () => {
    const text = `{"bundleSha256": "${sha256}", "faces": [[0, 0.5, 0, -1]], "groups": {"trunk": ${JSON.stringify(
      groupData([{ id: "abs", priority: 100, shape: { type: "box" } }]),
    ).replace('{"type":"box"}', '{"type":"box","side":[NaN,0.1]}')}}}`;

    expect(errorOf(runEngineRaw(text))).toContain("two finite numbers");
  });

  it("refuses an outline point that is not a finite number", () => {
    const outline = {
      type: "outline",
      points: [
        [0, 0],
        [0.1, null],
        [0.1, 0.1],
      ],
    };

    expect(errorOf(claim(outline))).toContain("finite numbers");
  });
});

describe("face contract", () => {
  const faces = [frontFace(0.02, 0.7), frontFace(0.03, 0.6)];
  const abs = { id: "abs", priority: 100, shape: { type: "box" } };
  const verify = (overrides: Partial<GroupData>, bodyFaces: Face[] = faces) =>
    runEngine({
      groups: { trunk: groupData([abs], { faceCount: bodyFaces.length, ...overrides }) },
      faces: bodyFaces,
      verifyFaces: true,
    });

  it("accepts the faces the file was cut on", () => {
    expect(verify({ faceFingerprint: fingerprintOf(faces) }).ok).toBe(true);
  });

  it("fails when the body has a different number of faces, naming both", () => {
    const error = errorOf(verify({ faceCount: 5, faceFingerprint: fingerprintOf(faces) }));

    expect(error).toContain("cut on 5 faces but the body has 2");
  });

  it("fails when the faces are in a different order", () => {
    const reordered: Face[] = [frontFace(0.03, 0.6), frontFace(0.02, 0.7)];

    expect(errorOf(verify({ faceFingerprint: fingerprintOf(reordered) }))).toContain(
      "different order",
    );
  });

  it("looks at every thousandth face, not at the ones between", () => {
    const many = Array.from({ length: 1001 }, (_, index) => frontFace(0.01, 0.5 + index * 1e-4));
    const betweenChanged = many.map((face, index): Face =>
      index === 5 ? frontFace(0.1, 0.1) : face,
    );
    const sampledChanged = many.map((face, index): Face =>
      index === 1000 ? frontFace(0.1, 0.1) : face,
    );

    expect(fingerprintOf(betweenChanged)).toBe(fingerprintOf(many));
    expect(fingerprintOf(sampledChanged)).not.toBe(fingerprintOf(many));
  });

  it("rejects a data file with no face count", () => {
    const run = runEngine({
      groups: { trunk: { ...groupData([abs]), faceCount: 0 } },
      faces,
    });

    expect(errorOf(run)).toContain("faceCount must be");
  });
});

describe("the committed trunk data", () => {
  const parsedTrunk = parseJson(readFileSync(trunkPath, "utf8"));
  if (!isGroupData(parsedTrunk)) {
    throw new Error("trunk.json is not a region file.");
  }
  const trunkData = parsedTrunk;

  it("holds the seven trunk ids", () => {
    expect(trunkData.regions.map((region) => region.id).sort()).toEqual(
      ["abs", "chest_lower", "chest_upper", "lats", "lower_back", "obliques", "traps_mid"].sort(),
    );
  });

  it("names the level and face count of the body it was cut on", () => {
    expect(trunkData).toMatchObject({ multiresLevel: 3, faceCount: 677_440 });
  });

  it("loads, and shares its 22 ids with the app's muscle list", () => {
    const run = runEngine({
      groups: { trunk: trunkData },
      faces: [frontFace(0.02, 0.7)],
      bundleSha256: trunkData.sourceSha256,
    });

    expect(run).toMatchObject({ ok: true, result: { muscleIds: [...MUSCLE_IDS] } });
  });
});
