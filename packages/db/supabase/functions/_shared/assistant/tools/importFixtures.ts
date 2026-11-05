// The foods, search and services the recipe import tool's tests share. Nothing in production imports this.
import { saveRecipeRpc } from "./recipeFixtures.ts";
import { dietRows, foodRow, writeContext } from "./writeFixtures.ts";

import type {
  FoodPickLine,
  FoodPickOutcome,
  ParsedMeasure,
  RecipeImportServices,
  RecipeParseOutcome,
} from "../recipeParse.ts";
import type { RecipePageResult } from "../../recipePage.ts";
import type { ToolContext, ToolDefinition } from "../tool.ts";
import type { RpcHandler } from "./writeStub.ts";

const id = (n: number) => `00000000-0000-4000-8000-0000000a${String(n).padStart(4, "0")}`;

export const importFoodIds = {
  chicken: id(1),
  potatoes: id(2),
  oil: id(3),
  lemon: id(4),
  garlic: id(5),
  milk: id(6),
  lentils: id(7),
  onion: id(8),
  stock: id(9),
  flour: id(10),
};

// Per 100 g, chosen so the lemon chicken traybake without the milk is 564 kcal, P 42 g, C 35 g and F 29 g
// a serving, and 570 kcal, P 42 g, C 36 g and F 29 g with the milk (the boards' numbers).
const cofid = (overrides: Record<string, unknown>) =>
  foodRow({ source: "cofid", owner_id: null, ...overrides });

const importFoods = () => [
  cofid({
    id: importFoodIds.chicken,
    name: "Chicken, thigh, skinless, raw",
    kcal: 173,
    protein_g: 19.3,
    fat_g: 10.8,
    carbs_g: 0,
  }),
  cofid({
    id: importFoodIds.potatoes,
    name: "Potatoes, new, raw",
    kcal: 80,
    protein_g: 1.6,
    fat_g: 0.1,
    carbs_g: 18.2,
  }),
  cofid({
    id: importFoodIds.oil,
    name: "Olive oil",
    kcal: 899,
    protein_g: 0,
    fat_g: 99.9,
    carbs_g: 0,
    density_g_per_ml: 0.9,
  }),
  cofid({
    id: importFoodIds.lemon,
    name: "Lemon, whole",
    kcal: 19,
    protein_g: 0.8,
    fat_g: 0.3,
    carbs_g: 3.2,
  }),
  cofid({
    id: importFoodIds.garlic,
    name: "Garlic, raw",
    kcal: 98,
    protein_g: 7.9,
    fat_g: 0.3,
    carbs_g: 16.3,
  }),
  cofid({
    id: importFoodIds.milk,
    name: "Milk, semi-skimmed",
    kcal: 46,
    protein_g: 3.5,
    fat_g: 1.7,
    carbs_g: 4.7,
    density_g_per_ml: 1.03,
  }),
  cofid({
    id: importFoodIds.lentils,
    name: "Lentils, green, dried",
    kcal: 310,
    protein_g: 24,
    fat_g: 1.5,
    carbs_g: 48,
  }),
  cofid({
    id: importFoodIds.onion,
    name: "Onions, raw",
    kcal: 36,
    protein_g: 1.2,
    fat_g: 0.2,
    carbs_g: 7.9,
  }),
  cofid({
    id: importFoodIds.flour,
    name: "Flour, rye",
    kcal: 330,
    protein_g: 8,
    fat_g: 1.5,
    carbs_g: 70,
  }),
  cofid({
    id: importFoodIds.stock,
    name: "Stock, vegetable",
    basis: "per_100ml",
    kcal: 6,
    protein_g: 0.2,
    fat_g: 0.1,
    carbs_g: 1,
  }),
];

const portion = (n: number, foodId: string, label: string, grams: number, isDefault = true) => ({
  id: id(100 + n),
  food_id: foodId,
  owner_id: null,
  label,
  grams,
  ml: null,
  is_default: isDefault,
  position: 0,
  created_at: "2026-10-07T10:00:00+00:00",
});

const importPortions = () => [
  portion(1, importFoodIds.lemon, "1 medium", 100),
  portion(2, importFoodIds.garlic, "1 clove", 3),
  portion(3, importFoodIds.onion, "1 large", 150),
];

// Which foods a query finds, by the words as the tool sends them, lower case, and with what score. The scores
// are the kind the real search gives: about 2 for a food with every word of the query and under 1 for a trigram
// guess. The import does not read them, and the order is the search's.
export type SearchScript = Record<string, readonly { foodId: string; score: number }[]>;

export const traybakeSearch: SearchScript = {
  "chicken thighs": [{ foodId: importFoodIds.chicken, score: 1.967 }],
  "new potatoes": [{ foodId: importFoodIds.potatoes, score: 2.223 }],
  "olive oil": [{ foodId: importFoodIds.oil, score: 2.189 }],
  lemon: [{ foodId: importFoodIds.lemon, score: 2.133 }],
  garlic: [{ foodId: importFoodIds.garlic, score: 2.157 }],
  milk: [{ foodId: importFoodIds.milk, score: 2.1 }],
};

// `search_foods` as the database answers it: the foods the script lists for the query, in that order.
export function searchFoodsRpc(
  script: SearchScript,
  queries: string[],
  limits: number[] = [],
): RpcHandler {
  return (args, tables) => {
    const query = String(args["q"]).toLowerCase();
    queries.push(query);
    limits.push(Number(args["lim"]));
    const rows = (script[query] ?? []).flatMap(({ foodId, score }) => {
      const food = (tables["foods"] ?? []).find((row) => row["id"] === foodId);
      return food === undefined
        ? []
        : [
            {
              id: food["id"],
              source: food["source"],
              name: food["name"],
              brand: null,
              basis: food["basis"],
              kcal: food["kcal"],
              protein_g: food["protein_g"],
              fat_g: food["fat_g"],
              carbs_g: food["carbs_g"],
              fibre_g: null,
              quality: {},
              default_portion_id: null,
              default_portion_label: null,
              default_portion_grams: null,
              default_portion_ml: null,
              score,
            },
          ];
    });
    return { data: rows, error: null };
  };
}

export type TextLine = ParsedMeasure & { text: string };

export const line = (overrides: Partial<TextLine> & { text: string }): TextLine => ({
  quantity: null,
  unit: null,
  food_name: null,
  guess_grams: null,
  guess_unit: null,
  ...overrides,
});

// The lines of the lemon chicken traybake as Haiku reads them, with the last one either vague line.
export const traybakeLines = (last: TextLine): TextLine[] => [
  line({
    text: "800 g chicken thighs, skinless",
    quantity: 800,
    unit: "g",
    food_name: "chicken thighs",
  }),
  line({ text: "750 g new potatoes", quantity: 750, unit: "g", food_name: "new potatoes" }),
  line({ text: "2 tbsp olive oil", quantity: 2, unit: "tbsp", food_name: "olive oil" }),
  line({ text: "1 lemon", quantity: 1, food_name: "lemon" }),
  line({ text: "4 garlic cloves", quantity: 4, food_name: "garlic" }),
  last,
];

export const splashOfMilk = line({
  text: "A splash of milk",
  food_name: "milk",
  guess_grams: 50,
  guess_unit: "ml",
});

export const splashOfWhiteWine = line({
  text: "A splash of white wine",
  food_name: "white wine",
  guess_grams: 50,
  guess_unit: "ml",
});

export type ImportCalls = {
  fetched: string[];
  parsed: { kind: string; payload: unknown }[];
  /** What each pick call was asked, and the time it was given. */
  picked: { lines: readonly FoodPickLine[]; timeoutMilliseconds: number }[];
};

/** The positions that choose the first candidate of every line, as the pick stub answers by default. */
export const firstCandidates = (lines: readonly FoodPickLine[]): FoodPickOutcome => ({
  ok: true,
  picks: lines.map(() => 0),
});

// The outside steps, answered from a script, and a record of what was asked of them. Unless a test says
// otherwise, the pick chooses the first candidate of every line, so a test that is not about the choice sees the
// foods its search script lists.
export function importServices(options: {
  page?: RecipePageResult | (() => Promise<RecipePageResult>);
  parse?: RecipeParseOutcome | (() => Promise<RecipeParseOutcome>);
  pick?:
    | FoodPickOutcome
    | ((lines: readonly FoodPickLine[]) => FoodPickOutcome | Promise<FoodPickOutcome>);
}): { services: RecipeImportServices; calls: ImportCalls } {
  const calls: ImportCalls = { fetched: [], parsed: [], picked: [] };
  const answer = <T>(value: T | (() => Promise<T>)): Promise<T> =>
    typeof value === "function" ? (value as () => Promise<T>)() : Promise.resolve(value);
  return {
    calls,
    services: {
      fetchPage(url) {
        calls.fetched.push(url);
        return answer(options.page ?? { ok: false, code: "http_error" });
      },
      parse(input) {
        calls.parsed.push({
          kind: input.kind,
          payload: input.kind === "lines" ? input.lines : input.text,
        });
        return answer(options.parse ?? { ok: false, code: "failed" });
      },
      pickFoods(lines, { timeoutMilliseconds }) {
        calls.picked.push({ lines, timeoutMilliseconds });
        const pick = options.pick ?? firstCandidates;
        return Promise.resolve(typeof pick === "function" ? pick(lines) : pick);
      },
    },
  };
}

export function importContext(
  tools: readonly ToolDefinition[],
  options: {
    services?: RecipeImportServices;
    userMessageText?: string | null;
    search?: SearchScript;
    rows?: Record<string, Record<string, unknown>[]>;
  } = {},
) {
  const queries: string[] = [];
  const searchLimits: number[] = [];
  const diet = dietRows();
  const made = writeContext(tools, {
    rows: {
      foods: [...diet.foods, ...importFoods()],
      food_portions: [...diet.food_portions, ...importPortions()],
      ...options.rows,
    },
    rpc: {
      save_recipe: saveRecipeRpc,
      search_foods: searchFoodsRpc(options.search ?? traybakeSearch, queries, searchLimits),
    },
  });
  const ctx: ToolContext = {
    ...made.ctx,
    turn: {
      ...made.ctx.turn,
      userMessageText:
        "userMessageText" in options ? (options.userMessageText ?? null) : traybakeMessage,
    },
    ...(options.services === undefined ? {} : { recipeImport: options.services }),
  };
  return { ...made, ctx, queries, searchLimits };
}

export const traybakeUrl = "https://example.com/lemon-traybake";
export const traybakeMessage = `Add this recipe: ${traybakeUrl}`;
