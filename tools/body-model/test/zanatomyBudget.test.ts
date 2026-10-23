import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const blenderFolder = join(import.meta.dirname, "../blender");

/** zanatomy_budget.py is pure Python, so the tests run it with python3 as the Blender step would. */
function idTargets(
  budget: object,
  sourceTriangles: Record<string, number>,
): Record<string, number> {
  const code = [
    `import sys, json; sys.path.insert(0, ${JSON.stringify(blenderFolder)})`,
    "import zanatomy_budget as budget",
    `print(json.dumps(budget.id_targets(json.loads(${JSON.stringify(JSON.stringify(budget))}), json.loads(${JSON.stringify(JSON.stringify(sourceTriangles))}))))`,
  ].join("\n");
  const result = spawnSync("python3", ["-I", "-c", code], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  const parsed: unknown = JSON.parse(result.stdout);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Unexpected output from zanatomy_budget.py");
  }
  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
}

const budget = { idsTriangles: 1000, minimumIdTriangles: 100 };

describe("id_targets", () => {
  it("should cut the heaviest source hardest", () => {
    const targets = idTargets(budget, { big: 90_000, small: 10_000 });

    expect((targets.big ?? 0) / 90_000).toBeLessThan((targets.small ?? 0) / 10_000);
  });

  it("should share the ids budget between the ids", () => {
    const targets = idTargets(budget, { big: 90_000, small: 10_000 });

    expect((targets.big ?? 0) + (targets.small ?? 0)).toBe(1000);
  });

  it("should never go under the minimum", () => {
    const targets = idTargets(budget, { big: 1_000_000, tiny: 1_000 });

    expect(targets.tiny).toBe(100);
  });

  it("should give an id its own floor when the budget names one", () => {
    const targets = idTargets(
      { ...budget, idFloors: { big: 900 } },
      { big: 90_000, small: 10_000 },
    );

    expect(targets.big).toBe(900);
  });

  it("should never ask for more triangles than the source has", () => {
    const targets = idTargets(
      { idsTriangles: 1000, minimumIdTriangles: 100 },
      { big: 90_000, few: 50 },
    );

    expect(targets.few).toBe(50);
  });
});

type Counts = Record<string, number>;

function budgetProblems(counts: Counts, outsidePercent: number): string[] {
  const budget = {
    maximumTriangles: 1000,
    minimumIdTriangles: 100,
    maximumPercentOutsideSkin: 0.1,
    minimumSkinTriangles: 100,
    maximumSkinTriangles: 150,
    maximumHeadAndEyesTriangles: 200,
  };
  const code = [
    `import sys, json; sys.path.insert(0, ${JSON.stringify(blenderFolder)})`,
    "import zanatomy_budget as budget",
    `print(json.dumps(budget.budget_problems(json.loads(${JSON.stringify(JSON.stringify(budget))}), ["a", "b"], json.loads(${JSON.stringify(JSON.stringify(counts))}), {"a": 5000, "b": 50}, ${outsidePercent})))`,
  ].join("\n");
  const result = spawnSync("python3", ["-I", "-c", code], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  const parsed: unknown = JSON.parse(result.stdout);
  if (!Array.isArray(parsed)) {
    throw new Error("Unexpected output from zanatomy_budget.py");
  }
  return parsed.map(String);
}

const fine = { a: 300, b: 50, other: 100, skin: 120, core: 50, head: 100, eyes: 50 };

describe("budget_problems", () => {
  it("should report nothing for a body that fits", () => {
    expect(budgetProblems(fine, 0.0)).toEqual([]);
  });

  it("should report a total over the limit", () => {
    expect(budgetProblems({ ...fine, other: 900 }, 0.0).join(" ")).toContain("over 1,000");
  });

  it("should report an id under its minimum unless its source has fewer", () => {
    const problems = budgetProblems({ ...fine, a: 90 }, 0.0);

    expect(problems.join(" ")).toContain("a has only 90");
    expect(problems.join(" ")).not.toContain("b has only");
  });

  it("should report a skin outside its range", () => {
    expect(budgetProblems({ ...fine, skin: 99 }, 0.0).join(" ")).toContain("skin");
    expect(budgetProblems({ ...fine, skin: 151 }, 0.0).join(" ")).toContain("skin");
  });

  it("should report a head and eyes total over the limit", () => {
    expect(budgetProblems({ ...fine, head: 160, eyes: 50 }, 0.0).join(" ")).toContain(
      "head and eyes",
    );
  });

  it("should report too many muscle vertices outside the skin", () => {
    expect(budgetProblems(fine, 0.5).join(" ")).toContain("outside the skin");
  });
});
