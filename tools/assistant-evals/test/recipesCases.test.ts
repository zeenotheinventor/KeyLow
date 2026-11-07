import { readFileSync, readdirSync } from "node:fs";

import { buildRecipeImportedCard, withActionIds } from "@keylow/core";
import { spoonPortionWithLabel } from "@keylow/core/nutrition";
import { buildRecipeIngredient, computeRecipe } from "@keylow/core/recipes";
import { describe, expect, it } from "vitest";

import { fakeEnvironment } from "./fakeEnvironment.ts";
import { fakeDatabase, readTool, turnResult, writeTool } from "./helpers.ts";
import { DIARY_READ_TOOLS } from "../cases/ask.ts";
import {
  IMPORT_TURN_TOOLS,
  importCalledFor,
  messageFor,
  onlyImportTools,
  onlyTheImportWrote,
  recipeCardIsRight,
  recipeCasesOf,
  recipeSavedAsExpected,
} from "../cases/recipes.ts";
import { fixturePages } from "../fixtures/pages/index.ts";
import { FOODS, htmlOf, pagePathOf, recipePages } from "../fixtures/pages/recipeImportPages.ts";
import { redTeamPages } from "../fixtures/pages/redTeamPages.ts";
import { recipePageUrl } from "../src/pageServer.ts";
import { THRESHOLD_PERCENT } from "../src/thresholds.ts";

import type {
  ExpectedLine,
  FoodExpectation,
  RecipePage,
} from "../fixtures/pages/recipeImportPages.ts";
import type { EvalCase, GradeContext } from "../src/case.ts";
import type { EvalDatabase, RowQuery, TurnResult } from "../src/types.ts";
import type { RecipeIngredientInput } from "@keylow/core/recipes";
import type { Food, FoodPortion } from "@keylow/core/schemas";

type Row = Record<string, unknown>;

// --- A model that was right: the rows, the card and the turn a correct import leaves behind. ---------------

const SAMPLE_NAMES: Readonly<Record<string, string>> = {
  "porridge oats": "Porridge oats, unfortified",
  milk: "Milk, whole, pasteurised, average",
  bananas: "Bananas, flesh only",
  potatoes: "Potatoes, old, boiled in unsalted water, flesh only",
  carrots: "Carrots, old, raw",
  onions: "Onions, raw",
  "olive oil": "Oil, olive",
  pasta: "Pasta, white, dried, raw",
  cheddar: "Cheese, Cheddar, English",
  broccoli: "Broccoli, green, boiled in unsalted water",
  salmon: "Salmon, farmed, flesh only, grilled",
  "basmati rice": "Rice, white, basmati, boiled in unsalted water",
  spinach: "Spinach, baby, raw",
  "red lentils": "Lentils, red, split, dried, raw",
  garlic: "Garlic, raw",
  "chicken breast": "Chicken, breast, grilled without skin, meat only",
  "red peppers": "Pepper, capsicum, red, raw",
  eggs: "Eggs, chicken, whole, boiled",
  "brown bread": "Bread, brown, average",
  "unsalted butter": "Butter, unsalted",
  apples: "Apples, eating, raw, flesh and skin",
  "Greek yogurt": "Yogurt, Greek style, plain",
  "plain flour": "Flour, wheat, white, plain, soft",
  tomatoes: "Tomatoes, standard, raw",
  "spring onions": "Spring onions, bulbs and tops, raw",
  "raw potatoes": "Potatoes, old, raw, flesh only",
  cheese: "Cheese, Cheddar, English",
  "raw eggs": "Eggs, chicken, whole, raw",
  "raw chicken breast": "Chicken, breast, raw, meat and skin",
};

const DENSITIES: Readonly<Record<string, number>> = { milk: 1.03, "olive oil": 0.92 };

function foodOf(expectation: FoodExpectation, index: number): Food {
  return {
    id: `5eed0000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    name: SAMPLE_NAMES[expectation.label] ?? expectation.label,
    kcal: 100 + index * 7,
    protein_g: 5 + index,
    fat_g: 2 + index / 2,
    sat_fat_g: 1,
    carbs_g: 10 + index,
    sugars_g: 1,
    fibre_g: 1,
    salt_g: 0.1,
    source: "cofid",
    source_ref: `00-${String(index).padStart(3, "0")}`,
    owner_id: null,
    brand: null,
    barcode: null,
    basis: "per_100g",
    density_g_per_ml: DENSITIES[expectation.label] ?? null,
    micros: {},
    quality: {},
    food_group: null,
    fetched_at: null,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const allFoods: readonly Food[] = Object.values(FOODS).map(foodOf);
const foodFor = (expectation: FoodExpectation): Food => {
  const found = allFoods.find((food) => food.name === SAMPLE_NAMES[expectation.label]);
  if (found === undefined) {
    throw new Error(`no sample food for ${expectation.label}`);
  }
  return found;
};

// A guess the import might make: 30 ml of a liquid, 20 g of anything else.
const guessFor = (food: Food) =>
  food.density_g_per_ml === null
    ? ({ quantity: 20, unit: "g" } as const)
    : ({ quantity: 30, unit: "ml" } as const);

// The one counted portion a food of the pages has: a large egg.
const largeEgg = (food: Food): FoodPortion => ({
  id: "e99e0000-0000-4000-8000-000000000001",
  food_id: food.id,
  owner_id: null,
  label: "1 large",
  grams: 50,
  ml: null,
  is_default: true,
  position: 0,
  created_at: "2026-01-01T00:00:00Z",
});

type Variant = {
  recipeId?: string;
  isArchived?: boolean;
  guessQuantity?: number;
  wrongKcal?: boolean;
  extraAction?: string;
  secondRecipe?: boolean;
  estimateOnEveryRow?: boolean;
  noCard?: boolean;
  linkToEditorAlways?: boolean;
  swapFirstFood?: boolean;
  dropFirstIngredient?: boolean;
  tools?: string[];
};

function rightReply(page: RecipePage, variant: Variant = {}) {
  const recipeId = variant.recipeId ?? `0ec1be00-0000-4000-8000-0000000000${page.id.length}`;
  const turn = turnResult({
    toolCalls: [
      ...(variant.tools ?? []).map((name) => writeTool(name)),
      {
        name: "import_recipe_from_url",
        input: { url: recipePageUrl(pagePathOf(page)), servings: null },
      },
    ],
  });
  const ingredients = page.lines.flatMap((line, index) => {
    if (line.kind === "unresolved") {
      return [];
    }
    const food =
      variant.swapFirstFood === true && index === 0 ? foodOf(FOODS.salmon, 99) : foodFor(line.food);
    if (line.kind === "vague") {
      const guess = guessFor(food);
      return [
        buildRecipeIngredient(food, {
          ...guess,
          quantity: variant.guessQuantity ?? guess.quantity,
        }),
      ];
    }
    const { amount } = line;
    const spoon = "spoon" in amount ? spoonPortionWithLabel(`1 ${amount.spoon}`) : undefined;
    const input: RecipeIngredientInput =
      "spoon" in amount && spoon !== undefined
        ? { quantity: amount.quantity, unit: "portion", portion: spoon, foodPortions: [] }
        : "portionLabel" in amount
          ? {
              quantity: amount.quantity,
              unit: "portion",
              portion: largeEgg(food),
              foodPortions: [largeEgg(food)],
            }
          : "unit" in amount
            ? { quantity: amount.quantity, unit: amount.unit }
            : { quantity: 1, unit: "g" };
    return [buildRecipeIngredient(food, input)];
  });
  const kept = variant.dropFirstIngredient === true ? ingredients.slice(1) : ingredients;
  const computed = computeRecipe({ servings: page.servings, yieldGrams: null, ingredients: kept });
  const storedComputed =
    variant.wrongKcal === true
      ? {
          ...computed,
          perServing: { ...computed.perServing, kcal: (computed.perServing.kcal ?? 0) + 5 },
        }
      : computed;
  const recipe: Row = {
    id: recipeId,
    source_url: recipePageUrl(pagePathOf(page)),
    is_archived: variant.isArchived ?? page.undoes === true,
    servings: page.servings,
    computed: storedComputed,
  };
  const foodRows: Row[] = [...allFoods, foodOf(FOODS.salmon, 99)].map((food) => ({ ...food }));
  const ingredientRows: Row[] = kept.map((ingredient, position) => ({
    recipe_id: recipeId,
    position,
    ...ingredient,
  }));
  const cardLines = page.lines.map((line) =>
    line.kind === "unresolved"
      ? { text: line.text, foodWord: "sumac", food: null }
      : {
          text: line.text,
          foodWord: line.food.label,
          food: { name: SAMPLE_NAMES[line.food.label] ?? "", source: "cofid" as const },
          guess: line.kind === "vague" ? { amount: 30, unit: "ml" as const } : null,
        },
  );
  const draft = buildRecipeImportedCard({
    recipe: {
      id: recipeId,
      name: page.name,
      servings: page.servings,
      perServing: { kcal: 1, protein_g: 1, carbs_g: 1, fat_g: 1 },
    },
    sourceUrl: recipePageUrl(pagePathOf(page)),
    lines: cardLines,
  });
  const card = withActionIds(
    {
      ...draft,
      rows: draft.rows.map((row) => ({
        ...row,
        estimate: variant.estimateOnEveryRow === true ? true : row.estimate,
      })),
      link:
        variant.linkToEditorAlways === true
          ? {
              label: "Open in recipe editor",
              target: { screen: "recipe_editor" as const, recipeId },
            }
          : draft.link,
    },
    ["a0000000-0000-4000-8000-000000000001"],
  );
  const result: TurnResult = {
    ...turn,
    ...(variant.noCard === true ? {} : { cards: [card] }),
  };
  const tables: Record<string, Row[]> = {
    recipes: [recipe, ...(variant.secondRecipe === true ? [{ ...recipe, id: "other" }] : [])],
    recipe_ingredients: ingredientRows,
    foods: foodRows,
    food_portions: [largeEgg(foodFor(FOODS.rawEggs))],
    assistant_actions: [
      { turn_id: turn.turnId, tool: "import_recipe_from_url" },
      ...(variant.extraAction === undefined
        ? []
        : [{ turn_id: turn.turnId, tool: variant.extraAction }]),
    ],
  };
  return { result, database: databaseOf(tables) };
}

function databaseOf(tables: Record<string, Row[]>): EvalDatabase {
  const base = fakeDatabase();
  const rowsOf = ({ table, where }: RowQuery) =>
    (tables[table] ?? []).filter((row) =>
      Object.entries(where).every(([column, value]) => row[column] === value),
    );
  return {
    ...base,
    readRows: (query) => Promise.resolve(rowsOf(query)),
    countRows: (query) => Promise.resolve(rowsOf(query).length),
  };
}

async function failuresOf(evalCase: EvalCase, context: GradeContext): Promise<string[]> {
  const outcomes = await Promise.all(evalCase.expect.map((grade) => grade(context)));
  return outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
}

const caseOf = (page: RecipePage): EvalCase => {
  const found = recipeCasesOf([page])[0];
  if (found === undefined) {
    throw new Error("no case");
  }
  return found;
};
const pageNamed = (id: string): RecipePage => {
  const found = recipePages.find((page) => page.id === id);
  if (found === undefined) {
    throw new Error(`no page ${id}`);
  }
  return found;
};

// --- The set ---------------------------------------------------------------------------------------------

describe("the recipe import set", () => {
  const cases = recipeCasesOf();

  it("should have 25 pages and 4 Undo cases, 29 in all", () => {
    expect(cases).toHaveLength(29);
    expect(cases.every(({ set }) => set === "recipes")).toBe(true);
    expect(new Set(cases.map(({ id }) => id)).size).toBe(29);
  });

  it("should have the kinds the ticket asks for", () => {
    const count = (kind: RecipePage["kind"]) =>
      recipePages.filter((page) => page.kind === kind && page.undoes !== true).length;

    expect(count("jsonld")).toBe(8);
    expect(count("text")).toBe(4);
    expect(count("us")).toBe(4);
    expect(count("vague")).toBe(4);
    expect(count("injection")).toBe(2);
    expect(count("leftOut")).toBe(2);
    expect(count("staples")).toBe(1);
    expect(recipePages.filter((page) => page.undoes === true)).toHaveLength(4);
  });

  it("should use all four JSON-LD shapes and a yield written as text", () => {
    const shapes = new Set(
      recipePages.filter((page) => page.kind === "jsonld").map((page) => page.shape),
    );

    expect([...shapes].sort()).toEqual(["graph", "howToSection", "plain", "plainYieldText"]);
  });

  it("should have two vague pages whose food matches and two whose food does not", () => {
    const vaguePages = recipePages.filter((page) => page.kind === "vague" && page.undoes !== true);
    const matching = vaguePages.filter((page) => page.lines.some((line) => line.kind === "vague"));
    const notMatching = vaguePages.filter((page) =>
      page.lines.some((line) => line.kind === "unresolved"),
    );

    expect(matching).toHaveLength(2);
    expect(notMatching).toHaveLength(2);
  });

  it("should send one message with the page's link in it, verbatim", () => {
    for (const [position, page] of recipePages.entries()) {
      expect(messageFor(page, position)).toContain(recipePageUrl(pagePathOf(page)));
    }
  });

  it("should serve a page for every case, each at its own path", () => {
    // The red-team set's pages (KEY-702) are served by the same server.
    expect(fixturePages.size).toBe(recipePages.length + redTeamPages.length);
    for (const page of recipePages) {
      expect(fixturePages.get(pagePathOf(page))).toBe(htmlOf(page));
    }
  });

  it("should have its threshold at 90 percent", () => {
    expect(THRESHOLD_PERCENT.recipes).toBe(90);
  });

  it("should let a case use the read tools and the import, tied to the tool sources", () => {
    expect([...IMPORT_TURN_TOOLS].sort()).toEqual(
      [...DIARY_READ_TOOLS, "import_recipe_from_url"].sort(),
    );
    const toolsFolder = new URL(
      "../../../packages/db/supabase/functions/_shared/assistant/tools/",
      import.meta.url,
    );
    const source = readFileSync(new URL("importRecipeFromUrl.ts", toolsFolder), "utf8");
    const others = readdirSync(toolsFolder).filter(
      (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
    );

    expect(source).toMatch(/name: "import_recipe_from_url",/);
    expect(source).toMatch(/kind: "write",/);
    expect(others).toContain("importRecipeFromUrl.ts");
  });
});

describe("the pages", () => {
  const ldJsonOf = (html: string): unknown[] =>
    [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(
      ([, json]): unknown => JSON.parse(json ?? "null"),
    );

  it("should give a JSON-LD page the lines of its spec, in order", () => {
    for (const page of recipePages.filter((candidate) => candidate.shape !== "text")) {
      const [data] = ldJsonOf(htmlOf(page));
      const text = JSON.stringify(data);
      expect(ldJsonOf(htmlOf(page)), page.id).toHaveLength(1);
      for (const line of page.lines) {
        expect(text, page.id).toContain(JSON.stringify(line.text).slice(1, -1));
      }
    }
  });

  it("should give a text page no JSON-LD and every line as visible text", () => {
    for (const page of recipePages.filter((candidate) => candidate.shape === "text")) {
      const html = htmlOf(page);
      expect(html, page.id).not.toContain("ld+json");
      for (const line of page.lines) {
        expect(html, page.id).toContain(line.text);
      }
    }
  });

  it("should move the injected instruction of the text page off screen, where the text reader keeps it", () => {
    const html = htmlOf(pageNamed("injection-offscreen"));

    expect(html).toMatch(/<p style="position:absolute;left:-9999px">[^<]*chocolate bars[^<]*<\/p>/);
    // These are the ways the reader drops text (recipePageText.ts). None may be used here.
    expect(html).not.toMatch(/hidden|display\s*:\s*none|visibility/i);
  });

  it("should write a yield as text on the page that has one", () => {
    expect(htmlOf(pageNamed("jsonld-yield-text-apple-pot"))).toContain("Serves 4");
  });

  it("should use the HowToSection and graph shapes of schema.org", () => {
    expect(htmlOf(pageNamed("jsonld-howto-egg-toast"))).toContain('"HowToSection"');
    expect(htmlOf(pageNamed("jsonld-graph-salmon-rice"))).toContain('"@graph"');
  });

  it("should be original: no link, brand or address of a real site", () => {
    for (const page of recipePages) {
      expect(htmlOf(page), page.id).not.toMatch(/https?:\/\/(?!schema\.org)/);
    }
  });
});

describe("the page server", () => {
  it("should be started by the setup of every case, which leaves the conversation to the first message", async () => {
    let starts = 0;
    const cases = recipeCasesOf(recipePages, () => {
      starts += 1;
      return Promise.resolve();
    });
    const environment = fakeEnvironment();

    const conversations: (string | null | undefined)[] = [];
    for (const evalCase of cases) {
      conversations.push(await evalCase.setup?.(environment));
    }

    expect(starts).toBe(cases.length);
    expect(conversations.every((conversation) => conversation === null)).toBe(true);
    expect(cases.every((evalCase) => evalCase.setup !== undefined)).toBe(true);
  });
});

describe("the Undo cases", () => {
  const undoCase = caseOf(pageNamed("undo-jsonld-plain-porridge"));
  const turn = (id: string) => ({ index: 0, result: turnResult({ turnId: id }) });

  it("should press Undo for the turn after it, and only the Undo cases do", async () => {
    const environment = fakeEnvironment({ undoPresses: { "turn-x": [["undone"]] } });

    await undoCase.afterTurn?.(turn("turn-x"), environment);

    expect(environment.calls).toEqual(["undo turn-x"]);
    expect(caseOf(pageNamed("jsonld-plain-porridge")).afterTurn).toBeUndefined();
  });

  it("should fail when the turn had nothing to undo", async () => {
    const environment = fakeEnvironment();

    await expect(undoCase.afterTurn?.(turn("turn-y"), environment)).rejects.toThrow("no action");
  });

  it("should fail when an action was not undone", async () => {
    const environment = fakeEnvironment({
      undoPresses: { "turn-z": [["undone", "undo_unavailable"]] },
    });

    await expect(undoCase.afterTurn?.(turn("turn-z"), environment)).rejects.toThrow(
      "undone, undo_unavailable",
    );
  });
});

// --- The expected foods ----------------------------------------------------------------------------------

describe("the expected foods", () => {
  // The CoFID foods the CI stack seeds (supabase/seeds/10_cofid_subset.sql). It also holds 59 USDA chicken and
  // turkey foods and 5 Open Food Facts samples. This only shows that a right food exists in the seed. It does not
  // show that a correct import reaches it, which is what the live run is for.
  const cofidNames = readFileSync(
    new URL("../../../packages/db/data/cofid/subset.txt", import.meta.url),
    "utf8",
  )
    .split("\n")
    .flatMap((line) => (line.startsWith("#") ? [] : [line.replace(/^\S+ # /, "").trim()]))
    .filter((name) => name !== "");
  const usdaNames = [
    ...readFileSync(
      new URL(
        "../../../packages/db/supabase/migrations/20261029010000_usda_foods.sql",
        import.meta.url,
      ),
      "utf8",
    ).matchAll(/"name":"([^"]+)"/g),
  ].flatMap(([, name]) => (name === undefined ? [] : [name]));
  const seededNames = [...cofidNames, ...usdaNames];

  // Foods a person would not mean by the line, most of them the first hit of a tied search, which the import took before KEY-838.
  const WRONG: Readonly<Record<keyof typeof FOODS, readonly string[]>> = {
    oats: [
      "Porridge oats, unfortified, cooked, made up with semi-skimmed milk",
      "Porridge, made with water",
    ],
    milk: [
      "Milk shake, powder",
      "Milk bread, homemade",
      "Milk, goats, pasteurised",
      "Milk, evaporated, whole",
      "Milk, soya, non-dairy alternative to milk, sweetened, fortified",
      "Milk, flavoured, pasteurised, chocolate",
    ],
    banana: ["Banana bread, homemade", "Banana split, homemade"],
    potatoes: [
      "Potato rings",
      "Potatoes, duchesse",
      "Potatoes, old, mashed with butter",
      "Potato chips, oven ready, no batter, baked",
      "Potatoes with onions and eggs, fried",
      "Potatoes, old, roasted in lard",
    ],
    carrots: ["Carrot juice", "Carrots, old, microwaved"],
    onions: ["Onions, fried in lard", "Spring onions, bulbs and tops, raw"],
    oliveOil: ["Sardines, canned in olive oil, drained", "Oil, rapeseed"],
    pasta: ["Pasta, egg, fresh, raw", "Pasta, plain, fresh, boiled"],
    cheddar: ["Cheese, Cheddar type, half fat", "Sandwich, white bread, cheddar cheese and pickle"],
    broccoli: ["Broccoli, purple sprouting, raw"],
    salmon: ["Salmon en croute, retail", "Salmon, smoked (cold-smoked)"],
    rice: [
      "Rice and split peas",
      "Rice, Thai fragrant, raw",
      "Rice, brown, wholegrain, raw",
      "Rice, pilau, plain, homemade",
    ],
    spinach: ["Spinach, dried", "Spinach, frozen, boiled in unsalted water"],
    lentils: ["Lentils, green and brown, whole, dried, raw", "Lentil roast, homemade"],
    garlic: ["Garlic powder", "Garlic mushrooms, not coated, homemade"],
    chicken: [
      "Chicken slices",
      "Chicken, mince, raw",
      "Chicken breast/steak, coated, baked",
      "Chicken, breast, casseroled, meat only",
    ],
    peppers: [
      "Pepper, black",
      "Pepper, white",
      "Peppers, capsicum, chilli, red, raw",
      "Peppers, capsicum, green, raw",
    ],
    eggs: [
      "Egg fu yung",
      "Egg nog, homemade",
      "Eggs, duck, whole, raw",
      "Eggs, chicken, yolk, raw",
    ],
    bread: [
      "Bread, seeded",
      "Bread, white, sliced",
      "Banana bread, homemade",
      "Flour, wheat, brown, bread/strong",
    ],
    butter: ["Butter, salted", "Butteroil, unsalted", "Peanut butter, smooth"],
    apples: [
      "Apple juice, clear, ambient and chilled",
      "Apples, eating, dried",
      "Apples, cooking, baked without sugar, flesh only",
    ],
    yogurt: ["Yogurt, Greek style, fruit", "Yogurt, low fat, plain", "Yogurt, whole milk, fruit"],
    flour: ["Flour, wheat, wholemeal", "Flour, rice", "Flour, rye"],
    tomatoes: [
      "Tomato juice",
      "Tomato puree",
      "Tomatoes, canned, whole contents",
      "Tomatoes, stuffed with rice",
    ],
    rawPotatoes: [
      "Potato rings",
      "Potatoes, duchesse",
      "Potatoes, old, mashed with butter",
      "Potatoes, old, boiled in unsalted water, flesh only",
    ],
    cheese: [
      "Cheese, Brie, with outer rind removed",
      "Cheese, cottage, plain",
      "Cheese, processed, plain",
    ],
    rawEggs: [
      "Egg fu yung",
      "Eggs, duck, whole, raw",
      "Eggs, chicken, whole, boiled",
      "Eggs, chicken, yolk, raw",
    ],
    rawChickenBreast: [
      "Chicken slices",
      "Chicken, mince, raw",
      "Chicken, breast, fried, meat only",
      "Chicken breast/steak, coated, baked",
    ],
    springOnions: ["Onions, raw", "Noodles, egg, fried with spring onions, homemade"],
  };

  it.each(Object.entries(FOODS))("should have a right food for %s in the CI seed", (_key, food) => {
    expect(seededNames.some((name) => food.namePattern.test(name))).toBe(true);
  });

  it.each(Object.entries(WRONG))("should refuse the wrong foods for %s", (key, names) => {
    const food = Object.entries(FOODS).find(([foodKey]) => foodKey === key)?.[1];

    expect(food).toBeDefined();
    expect(names.filter((name) => food?.namePattern.test(name))).toEqual([]);
  });

  it("should find none of the left-out seasonings in the CI seed, so leaving them out is the right answer", () => {
    // Only the model's choice of no food protects the person from a near miss (Beef extract, Salt, Garlic powder),
    // and the CI seed holds not even those. A full local import has `Lemon peel`, which would also be right for
    // the zest, so a run against one differs on that line. If the CI seed gains a food here, change the page.
    const seasonings =
      /onion.*powder|garlic.*(?:salt|powder)|vanilla|extract|zest|^lemon peel|^salt(?:,|$)/i;

    expect(seededNames.filter((name) => seasonings.test(name))).toEqual([]);
  });

  it("should expect a food for every line of every page, and none for a bare spice", () => {
    const lines = recipePages.flatMap((page) => page.lines);

    expect(
      lines
        .filter((line) => line.kind === "unresolved")
        .map((line) => line.text)
        .sort(),
    ).toEqual(
      expect.arrayContaining([
        "1 tbsp gochujang",
        "1 tbsp harissa",
        "2 tsp sumac",
        "a pinch of sumac",
        "a spoonful of harissa",
      ]),
    );
    expect(lines.every((line) => !/\bpaste\b/i.test(line.text))).toBe(true);
  });
});

// --- The graders -----------------------------------------------------------------------------------------

describe("a model that answers every page right", () => {
  it.each(recipePages.map((page) => [page.id, page] as const))(
    "should pass every grader of %s",
    async (_id, page) => {
      const { result, database } = rightReply(page);

      expect(await failuresOf(caseOf(page), { turns: [result], database })).toEqual([]);
    },
  );
});

describe("the graders", () => {
  const plain = pageNamed("jsonld-plain-porridge");
  const vague = pageNamed("vague-milk");
  const unresolvedPage = pageNamed("vague-sumac");
  const undone = pageNamed("undo-jsonld-plain-porridge");

  const failures = async (page: RecipePage, variant: Variant) => {
    const { result, database } = rightReply(page, variant);
    return failuresOf(caseOf(page), { turns: [result], database });
  };

  it("should fail when the numbers are not the worked-out ones", async () => {
    expect(await failures(plain, { wrongKcal: true })).toEqual([
      expect.stringContaining("per-serving kcal"),
    ]);
  });

  it("should fail when a line is matched to the wrong food", async () => {
    expect(await failures(plain, { swapFirstFood: true })).toEqual([
      expect.stringContaining("is a different food"),
    ]);
  });

  it("should fail when a counted line is missing", async () => {
    const reasons = await failures(plain, { dropFirstIngredient: true });

    expect(reasons[0]).toContain("2 ingredients were saved, wanted 3");
  });

  it("should fail when a vague line was saved with more than the cap", async () => {
    expect(await failures(vague, { guessQuantity: 150 })).toEqual([
      expect.stringContaining("inside the cap"),
    ]);
  });

  it("should fail when a second recipe has the page's link", async () => {
    const reasons = await failures(plain, { secondRecipe: true });

    expect(reasons.some((reason) => reason.includes("not exactly one recipe"))).toBe(true);
  });

  it("should fail when an Undo case's recipe is not archived, and when another is", async () => {
    expect(await failures(undone, { isArchived: false })).toEqual([
      expect.stringContaining("not archived"),
    ]);
    expect(await failures(plain, { isArchived: true })).toEqual([
      expect.stringContaining("is archived"),
    ]);
  });

  it("should fail when a second write came with the import", async () => {
    expect(await failures(plain, { extraAction: "log_entry" })).toEqual([
      expect.stringContaining("wrote 2 actions (import_recipe_from_url, log_entry)"),
    ]);
  });

  it("should fail when a tool that is neither a read tool nor the import was called", async () => {
    expect(await failures(plain, { tools: ["log_entry"] })).toEqual([
      expect.stringContaining("log_entry is not a read tool or the import"),
    ]);
  });

  it("should accept a read tool beside the import", async () => {
    const { result, database } = rightReply(plain);
    const withLookup: TurnResult = {
      ...result,
      toolCalls: [readTool("search_foods", { query: "milk" }), ...result.toolCalls],
    };

    expect(await failuresOf(caseOf(plain), { turns: [withLookup], database })).toEqual([]);
  });

  it("should fail when a row is marked as an estimate that was not guessed", async () => {
    expect(await failures(plain, { estimateOnEveryRow: true })).toEqual([
      expect.stringContaining("is marked as an estimate"),
    ]);
  });

  it("should fail when a guessed line is not marked as an estimate", async () => {
    const { result, database } = rightReply(vague);
    const card = result.cards?.[0];
    const unmarked =
      card === undefined
        ? undefined
        : { ...card, rows: card.rows.map((row) => ({ ...row, estimate: false })) };
    const turn: TurnResult = { ...result, cards: unmarked === undefined ? [] : [unmarked] };

    expect(await failuresOf(caseOf(vague), { turns: [turn], database })).toEqual([
      expect.stringContaining("is not marked as an estimate"),
    ]);
  });

  it("should fail when no card was sent", async () => {
    expect(await failures(plain, { noCard: true })).toEqual([
      expect.stringContaining("0 cards were sent"),
    ]);
  });

  it("should fail when a page with a left-out line links to the editor", async () => {
    expect(await failures(unresolvedPage, { linkToEditorAlways: true })).toEqual([
      expect.stringContaining("opens the wrong screen"),
    ]);
  });

  it("should fail when the import was not called for the page's link", async () => {
    const { result, database } = rightReply(plain);
    const other: TurnResult = {
      ...result,
      toolCalls: [{ name: "import_recipe_from_url", input: { url: "https://elsewhere.test/a" } }],
    };

    expect(await failuresOf(caseOf(plain), { turns: [other], database })).toEqual([
      expect.stringContaining("not for the link of the page"),
    ]);
  });

  it("should accept the link without its scheme", async () => {
    const grade = importCalledFor("https://recipes.keylow.test/recipes/a.html");
    const turn = turnResult({
      toolCalls: [
        { name: "import_recipe_from_url", input: { url: "recipes.keylow.test/recipes/a.html" } },
      ],
    });

    expect(await grade({ turns: [turn], database: fakeDatabase() })).toMatchObject({
      passed: true,
    });
  });

  it("should print the page, the question and the tools with their arguments, and never the answer", async () => {
    const { result, database } = rightReply(plain, { wrongKcal: true });
    const noisy: TurnResult = { ...result, answer: "SECRETANSWER about your 4000 kcal" };

    const [reason] = await failuresOf(caseOf(plain), { turns: [noisy], database });

    expect(reason).toContain("page: jsonld-plain-porridge");
    expect(reason).toContain(`question: "${messageFor(plain, 0)}"`);
    expect(reason).toContain("import_recipe_from_url(");
    expect(reason).not.toContain("SECRETANSWER");
  });

  it("should expose its graders by name for the next set to reuse", () => {
    expect(
      [
        importCalledFor,
        onlyImportTools,
        onlyTheImportWrote,
        recipeCardIsRight,
        recipeSavedAsExpected,
      ].every((grader) => typeof grader === "function"),
    ).toBe(true);
  });
});

// A line the ticket calls "unresolved" is never an ingredient, so a page's counted lines are the rest.
describe("the expectations", () => {
  const counted = (page: RecipePage): ExpectedLine[] =>
    page.lines.filter((line) => line.kind !== "unresolved");

  it("should expect an estimate only on a vague line, and a vague line only where a food matches", () => {
    for (const page of recipePages) {
      for (const line of page.lines) {
        expect(line.kind === "vague" ? "food" in line : true, page.id).toBe(true);
      }
      expect(counted(page).length, page.id).toBeGreaterThan(0);
    }
  });
});
