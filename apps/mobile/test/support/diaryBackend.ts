import { TERMS_VERSION } from "@keylow/core/copy";
import { buildLogEntry, buildQuickEntry, buildRecipeLogEntry } from "@keylow/core/diary";
import { computeRecipe } from "@keylow/core/recipes";
import { buildChickenAndRiceRecipe, buildFood } from "@keylow/core/testing";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import type { Database } from "@keylow/api-client";
import type { LoggableRecipe } from "@keylow/core/diary";
import type { RecipeComputed } from "@keylow/core/recipes";

type Row = Record<string, unknown>;

type Targets = {
  target_kcal: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
};

/** What the database holds and how it answers, which a test changes between renders. */
export const diaryBackend: {
  timezone: string;
  terms: { terms_accepted_at: string | null; terms_version: string | null };
  targets: Targets;
  /** The `programs` rows as the targets read sees them: `id` and `ended_on`. Empty by default, so the user has no program. */
  programs: Row[];
  /** The `targets` rows as the targets read sees them. Empty by default. They count only while a program is active. */
  engineTargets: Row[];
  entries: Row[];
  /** The `recipes` rows as the library reads them: `id`, `name`, `servings`, `yield_grams`, `is_archived` and `computed`. */
  recipes: Row[];
  dayLogs: Row[];
  /** The `day_totals` rows, which the week's read returns for the days it asks for. Empty by default. */
  dayTotals: Row[];
  /** Fails the reads of this table with a database error. */
  failingTables: Set<string>;
  /** Never answers the reads of this table, as a slow connection does. */
  hungTables: Set<string>;
  /** Fails the writes (insert, update) to this table with a database error, and leaves its reads alone. */
  failingWriteTables: Set<string>;
  /** Never answers the writes to this table, as a slow connection does. Its reads are answered. */
  hungWriteTables: Set<string>;
  /** Never answers the first read of the entries of each of these days (`YYYY-MM-DD`), as a slow connection does. Later reads are answered. */
  hungEntryReadsOnce: Set<string>;
  /** Holds each update of the entries until a test lets it go, by calling the function it was queued as in `heldUpdates`. */
  holdUpdates: boolean;
  heldUpdates: (() => void)[];
  /** Fails the inserts into the entries from this one on, counting from 1, as a copy that stops part way does. */
  failingInsertsFrom: number | null;
  /** Fails the next this many updates of the entries. */
  failingUpdates: number;
  /** Fails the read of the targets alone, so the terms acceptance still loads. */
  targetsReadFails: boolean;
  /** Fails the reads of a whole week (`day_totals` over a range of days) alone, so the day's own reads still answer. */
  weekReadsFail: boolean;
  /** Never answers the reads of a whole week alone, as a slow connection does. */
  weekReadsHang: boolean;
  /** Never answers the reads of the weeks that start on these Mondays (`YYYY-MM-DD`), and answers the other weeks. */
  hungWeekStarts: Set<string>;
  /** Fails the read of the profile's time zone alone, so the terms acceptance still loads. */
  timeZoneReadFails: boolean;
  /** The bodies of the updates made to the profile. */
  saves: unknown[];
  /** Every request made, as the table, its query string and its method. */
  requests: { table: string; search: string; method: string }[];
  /** The bodies of the writes to the diary tables, in the order they arrived, with the table and the method. */
  writes: { table: string; method: string; search: string; body: unknown }[];
} = {
  timezone: "Europe/London",
  terms: { terms_accepted_at: "2026-10-15T09:30:00+00:00", terms_version: TERMS_VERSION },
  targets: { target_kcal: 2200, target_protein_g: 160, target_carbs_g: 220, target_fat_g: 70 },
  programs: [],
  engineTargets: [],
  entries: [],
  recipes: [],
  dayLogs: [],
  dayTotals: [],
  failingTables: new Set(),
  hungTables: new Set(),
  failingWriteTables: new Set(),
  hungWriteTables: new Set(),
  hungEntryReadsOnce: new Set(),
  holdUpdates: false,
  heldUpdates: [],
  failingInsertsFrom: null,
  failingUpdates: 0,
  targetsReadFails: false,
  timeZoneReadFails: false,
  weekReadsFail: false,
  weekReadsHang: false,
  hungWeekStarts: new Set(),
  saves: [],
  requests: [],
  writes: [],
};

export function resetDiaryBackend(): void {
  diaryBackend.timezone = "Europe/London";
  diaryBackend.terms = {
    terms_accepted_at: "2026-10-15T09:30:00+00:00",
    terms_version: TERMS_VERSION,
  };
  diaryBackend.targets = {
    target_kcal: 2200,
    target_protein_g: 160,
    target_carbs_g: 220,
    target_fat_g: 70,
  };
  diaryBackend.programs = [];
  diaryBackend.engineTargets = [];
  diaryBackend.entries = [];
  diaryBackend.recipes = [];
  diaryBackend.dayLogs = [];
  diaryBackend.dayTotals = [];
  diaryBackend.failingTables.clear();
  diaryBackend.hungTables.clear();
  diaryBackend.failingWriteTables.clear();
  diaryBackend.hungWriteTables.clear();
  diaryBackend.hungEntryReadsOnce.clear();
  diaryBackend.holdUpdates = false;
  diaryBackend.heldUpdates = [];
  diaryBackend.failingInsertsFrom = null;
  diaryBackend.failingUpdates = 0;
  diaryBackend.saves = [];
  diaryBackend.targetsReadFails = false;
  diaryBackend.timeZoneReadFails = false;
  diaryBackend.weekReadsFail = false;
  diaryBackend.weekReadsHang = false;
  diaryBackend.hungWeekStarts.clear();
  diaryBackend.requests = [];
  diaryBackend.writes = [];
}

/**
 * An active program with a current targets row: 2,140 kcal a week, and by day, Monday first, 2,200, 2,150,
 * 2,100, 2,000, 2,250, 1,900 and 2,100. A Thursday, the day the clock stands on in most suites, is 2,000.
 */
export function showLiveTargets(): void {
  const programId = "44444444-4444-4444-8444-444444444444";
  diaryBackend.programs = [{ id: programId, ended_on: null }];
  diaryBackend.engineTargets = [
    {
      program_id: programId,
      calories_kcal: 2140,
      protein_g: 126,
      fat_g: 73,
      carbs_g: 245,
      dow_calories_kcal: [2200, 2150, 2100, 2000, 2250, 1900, 2100],
      effective_to: null,
    },
  ];
}

export const noTargets: Targets = {
  target_kcal: null,
  target_protein_g: null,
  target_carbs_g: null,
  target_fat_g: null,
};

const FOOD_ID = "22222222-2222-4222-8222-222222222222";
let entryCount = 0;

type EntryOptions = {
  /** The day, `YYYY-MM-DD`. */
  date: string;
  /** The UTC instant, `HH:mm`. London is one hour ahead of UTC on these days. */
  utcTime: string;
  name: string;
  /** What the board writes after the time: "50 g", or "1 medium (100 g)" for a portion. */
  quantity: number;
  unit: "g" | "ml" | "portion";
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

function databaseColumns(): Row {
  entryCount += 1;
  const serial = String(entryCount).padStart(12, "0");

  return {
    id: `00000000-0000-4000-8000-${serial}`,
    created_at: `2026-10-15T08:00:${String(entryCount % 60).padStart(2, "0")}+00:00`,
  };
}

/** A food entry as the database returns it, with the board's own numbers for its nutrients. */
export function foodEntry(options: EntryOptions): Row {
  const portion = {
    id: "33333333-3333-4333-8333-333333333333",
    label: "1 medium",
    grams: 100,
    ml: null,
  };
  const entry = buildLogEntry({
    food: buildFood({ id: FOOD_ID, name: options.name }),
    quantity: options.quantity,
    unit: options.unit,
    localDate: options.date,
    loggedAt: `${options.date}T${options.utcTime}:00+00:00`,
    ...(options.unit === "portion" ? { portion } : {}),
  });

  return {
    ...entry,
    ...databaseColumns(),
    kcal: options.kcal,
    nutrients: {
      kcal: options.kcal,
      protein_g: options.protein,
      fat_g: options.fat,
      carbs_g: options.carbs,
      fibre_g: null,
    },
  };
}

export function quickEntry(options: {
  date: string;
  utcTime: string;
  label: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}): Row {
  const entry = buildQuickEntry({
    localDate: options.date,
    loggedAt: `${options.date}T${options.utcTime}:00+00:00`,
    kcal: options.kcal,
    protein_g: options.protein,
    fat_g: options.fat,
    carbs_g: options.carbs,
    label: options.label,
  });

  return { ...entry, ...databaseColumns(), kcal: options.kcal };
}

/**
 * The golden recipe's nutrients as the boards write them: 1,496.8 kcal, 126.5 g protein, 170.2 g carbohydrate
 * and 32.5 g fat, which a serving of four takes to 374 kcal, 32 g, 43 g and 8.1 g. The builder's own ingredients
 * come to the same energy and protein and less carbohydrate and fat.
 */
export const boardRecipeTotal: RecipeComputed["total"] = {
  kcal: 1496.8,
  protein_g: 126.5,
  carbs_g: 170.2,
  fat_g: 32.5,
  fibre_g: null,
};

/** The id of the golden recipe, which its entries and its row in the recipe table share. */
export const goldenRecipeId = "44444444-4444-4444-8444-444444444444";

/**
 * The golden recipe (500 g chicken, 200 g rice and 20 g oil, in four servings with a measured 1,100 g) as an
 * entry freezes it: "Chicken and rice", with the boards' totals when `total` is given.
 */
export function goldenLoggableRecipe(
  total?: RecipeComputed["total"],
): LoggableRecipe & { computed: RecipeComputed } {
  const golden = buildChickenAndRiceRecipe({ yieldGrams: 1100 });

  return {
    id: goldenRecipeId,
    name: "Chicken and rice",
    servings: golden.servings,
    yield_grams: golden.yieldGrams,
    computed: {
      ...computeRecipe({
        servings: golden.servings,
        yieldGrams: golden.yieldGrams,
        ingredients: golden.ingredients,
      }),
      ...(total === undefined ? {} : { total }),
    },
  };
}

/**
 * A serving of the golden recipe as the database returns it: "Chicken and rice", 275 g and 374.2 kcal for one serving.
 */
export function recipeEntry(options: {
  date: string;
  utcTime: string;
  quantity?: number;
  unit?: "serving" | "g";
  /** The whole recipe's nutrients, when a test needs the boards' (see `boardRecipeTotal`) over the ingredients'. */
  total?: RecipeComputed["total"];
}): Row {
  const entry = buildRecipeLogEntry({
    recipe: goldenLoggableRecipe(options.total),
    quantity: options.quantity ?? 1,
    unit: options.unit ?? "serving",
    localDate: options.date,
    loggedAt: `${options.date}T${options.utcTime}:00+00:00`,
  });

  return { ...entry, ...databaseColumns(), kcal: entry.nutrients.kcal };
}

/**
 * The sample day of the boards, Thursday 15 October 2026: 1,039 kcal. The times are the board's London
 * times, which are one hour behind in UTC, as the clocks are on British Summer Time.
 */
export function sampleDay(date = "2026-10-15"): Row[] {
  const base = { date, kcal: 0, protein: 0, fat: 0, carbs: 0 };
  return [
    foodEntry({
      ...base,
      utcTime: "07:05",
      name: "Porridge oats",
      quantity: 50,
      unit: "g",
      kcal: 187,
      protein: 5.6,
      fat: 4.2,
      carbs: 30.2,
    }),
    foodEntry({
      ...base,
      utcTime: "07:05",
      name: "Semi-skimmed milk",
      quantity: 200,
      unit: "ml",
      kcal: 92,
      protein: 7,
      fat: 3.4,
      carbs: 9.6,
    }),
    foodEntry({
      ...base,
      utcTime: "07:10",
      name: "Banana",
      quantity: 1,
      unit: "portion",
      kcal: 95,
      protein: 1.2,
      fat: 0.1,
      carbs: 20.3,
    }),
    foodEntry({
      ...base,
      utcTime: "11:40",
      name: "Chicken breast, grilled",
      quantity: 150,
      unit: "g",
      kcal: 222,
      protein: 48,
      fat: 3.3,
      carbs: 0,
    }),
    foodEntry({
      ...base,
      utcTime: "11:40",
      name: "Basmati rice, boiled",
      quantity: 180,
      unit: "g",
      kcal: 216,
      protein: 4.9,
      fat: 0.7,
      carbs: 47.5,
    }),
    quickEntry({
      date,
      utcTime: "11:45",
      label: "Meal deal crisps",
      kcal: 130,
      protein: 2,
      fat: 7,
      carbs: 15,
    }),
    foodEntry({
      ...base,
      utcTime: "14:20",
      name: "Greek yoghurt 0% fat",
      quantity: 170,
      unit: "g",
      kcal: 97,
      protein: 17.3,
      fat: 0.3,
      carbs: 6.5,
    }),
  ];
}

/** A `day_totals` row as the view returns it: the four nutrients the week reads, and the rest null. */
export function dayTotalsRow(
  localDate: string,
  [kcal, protein, carbs, fat]: [number, number, number, number],
): Row {
  return {
    local_date: localDate,
    entry_count: 5,
    kcal,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    fibre_g: null,
    sat_fat_g: null,
    sugars_g: null,
    salt_g: null,
  };
}

/** A `day_logs` row for a day marked complete. */
export function completeDayLog(localDate: string): Row {
  return { local_date: localDate, is_complete: true, completed_at: null, note: null };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// `local_date=eq.X` is one day, and `gte` with `lte` is a week.
function inDateFilter(search: URLSearchParams, localDate: unknown): boolean {
  if (typeof localDate !== "string") {
    return false;
  }
  return search.getAll("local_date").every((condition) => {
    const separator = condition.indexOf(".");
    const operator = condition.slice(0, separator);
    const value = condition.slice(separator + 1);
    if (operator === "eq") {
      return localDate === value;
    }
    if (operator === "gte") {
      return localDate >= value;
    }
    if (operator === "lt") {
      return localDate < value;
    }
    return operator === "lte" ? localDate <= value : true;
  });
}

export const SIGNED_IN_USER_ID = "11111111-1111-4111-8111-111111111111";

// The update of the targets: the columns that were sent replace the stored ones, and the row is returned.
function saveTargets(body: unknown): Response {
  const saved: unknown = typeof body === "string" ? JSON.parse(body) : {};
  diaryBackend.saves.push(saved);
  if (typeof saved === "object" && saved !== null) {
    diaryBackend.targets = {
      target_kcal: numberOrNull(saved, "target_kcal"),
      target_protein_g: numberOrNull(saved, "target_protein_g"),
      target_carbs_g: numberOrNull(saved, "target_carbs_g"),
      target_fat_g: numberOrNull(saved, "target_fat_g"),
    };
  }

  return jsonResponse([diaryBackend.targets]);
}

function numberOrNull(source: object, key: string): number | null {
  const value: unknown = Object.getOwnPropertyDescriptor(source, key)?.value;

  return typeof value === "number" ? value : null;
}

function profileRow(select: string): Row {
  if (select.includes("target_kcal")) {
    return diaryBackend.targets;
  }
  if (select.includes("timezone")) {
    return { timezone: diaryBackend.timezone };
  }
  return diaryBackend.terms;
}

const WRITE_METHODS = new Set(["POST", "PATCH"]);

function readBody(init?: RequestInit): unknown {
  return typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
}

function fieldOf(source: unknown, key: string): unknown {
  return typeof source === "object" && source !== null
    ? Object.getOwnPropertyDescriptor(source, key)?.value
    : undefined;
}

const isLive = (row: Row): boolean => (row["deleted_at"] ?? null) === null;

/** The rows a write's filters pick: `id=eq.x`, `id=in.(x,y)`, `local_date=eq.d` and `deleted_at=is.null`. */
function rowsPicked(rows: Row[], search: URLSearchParams): Row[] {
  const id = search.get("id");
  const localDate = search.get("local_date");
  const ids = id?.startsWith("in.(")
    ? id.slice(4, -1).split(",")
    : id
      ? [id.replace("eq.", "")]
      : null;

  return rows.filter(
    (row) =>
      (ids === null || ids.includes(String(row["id"]))) &&
      (localDate === null || `eq.${String(row["local_date"])}` === localDate) &&
      (search.get("deleted_at") !== "is.null" || isLive(row)),
  );
}

// PostgREST answers a request for one object with the object, and with a 406 for any other count of rows.
function answerRows(rows: Row[], init?: RequestInit, status = 200): Response {
  if (!new Headers(init?.headers).get("Accept")?.includes("vnd.pgrst.object+json")) {
    return jsonResponse(rows, status);
  }
  const [only] = rows;
  if (rows.length === 1 && only !== undefined) {
    return jsonResponse(only, status);
  }

  return jsonResponse(
    {
      code: "PGRST116",
      message: "Cannot coerce the result to a single JSON object",
      details: `The result contains ${rows.length} rows`,
      hint: null,
    },
    406,
  );
}

function writeEntries(init: RequestInit, search: URLSearchParams): Response {
  const body = readBody(init);
  if (init.method === "POST") {
    const nutrients = fieldOf(body, "nutrients");
    const row = {
      ...(typeof body === "object" && body !== null ? body : {}),
      ...databaseColumns(),
      kcal: fieldOf(nutrients, "kcal") ?? null,
      deleted_at: null,
    };
    diaryBackend.entries.push(row);

    return answerRows([row], init, 201);
  }
  const picked = rowsPicked(diaryBackend.entries, search);
  for (const row of picked) {
    Object.assign(row, body);
  }

  return answerRows(
    picked.map((row) => ({ id: row["id"] })),
    init,
  );
}

/** The id a recipe saved through `save_recipe` is given, since a test needs to know where its view is. */
export const SAVED_RECIPE_ID = "77777777-7777-4777-8777-777777777777";

const objectOrEmpty = (value: unknown): object =>
  typeof value === "object" && value !== null ? value : {};

// `save_recipe` writes a new recipe and its ingredients in one call and answers with the recipe's id.
function saveRecipe(init: RequestInit): Response {
  const body = readBody(init);
  const ingredients = fieldOf(body, "p_ingredients");
  const existingId = fieldOf(body, "p_recipe_id");
  const id = typeof existingId === "string" ? existingId : SAVED_RECIPE_ID;
  // A saved recipe is replaced in place, as the database does when `p_recipe_id` is given.
  diaryBackend.recipes = diaryBackend.recipes.filter((row) => row["id"] !== id);
  diaryBackend.recipes.push({
    ...objectOrEmpty(fieldOf(body, "p_recipe")),
    id,
    is_archived: false,
    recipe_ingredients: (Array.isArray(ingredients) ? ingredients : []).map(
      (ingredient: unknown, position) => ({ ...objectOrEmpty(ingredient), position }),
    ),
  });

  return jsonResponse(id);
}

function writeDayLogs(init: RequestInit, search: URLSearchParams): Response {
  const body = readBody(init);
  if (init.method === "POST") {
    const row = { note: null, ...(typeof body === "object" && body !== null ? body : {}) };
    diaryBackend.dayLogs.push(row);

    return answerRows([row], init, 201);
  }
  const picked = rowsPicked(diaryBackend.dayLogs, search);
  for (const row of picked) {
    Object.assign(row, body);
  }

  return answerRows(
    picked.map((row) => ({ local_date: row["local_date"] })),
    init,
  );
}

// A write that is told to fail: every write to its table, an insert from the nth, or one of the next updates.
function writeShouldFail(table: string, method: string): boolean {
  if (diaryBackend.failingWriteTables.has(table)) {
    return true;
  }
  const inserts = diaryBackend.writes.filter(
    (write) => write.table === table && write.method === "POST",
  ).length;
  if (
    table === "food_log_entries" &&
    method === "POST" &&
    diaryBackend.failingInsertsFrom !== null &&
    inserts >= diaryBackend.failingInsertsFrom
  ) {
    return true;
  }
  if (table === "food_log_entries" && method === "PATCH" && diaryBackend.failingUpdates > 0) {
    diaryBackend.failingUpdates -= 1;
    return true;
  }
  return false;
}

const readDateOf = (search: URLSearchParams): string =>
  search.get("local_date")?.replace("eq.", "") ?? "";

function byTimeline(first: Row, second: Row): number {
  return (
    String(first["logged_at"]).localeCompare(String(second["logged_at"])) ||
    String(first["created_at"]).localeCompare(String(second["created_at"])) ||
    String(first["id"]).localeCompare(String(second["id"]))
  );
}

export async function fakeFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const { pathname, searchParams } = new URL(address);
  const table = pathname.split("/").pop() ?? "";
  const method = init?.method ?? "GET";
  diaryBackend.requests.push({ table, search: searchParams.toString(), method });

  const isDiaryWrite =
    WRITE_METHODS.has(method) && (table === "food_log_entries" || table === "day_logs");
  if (isDiaryWrite) {
    diaryBackend.writes.push({
      table,
      method,
      search: searchParams.toString(),
      body: readBody(init),
    });
    if (diaryBackend.hungWriteTables.has(table)) {
      return new Promise(() => undefined);
    }
    if (table === "food_log_entries" && method === "PATCH" && diaryBackend.holdUpdates) {
      await new Promise<void>((release) => diaryBackend.heldUpdates.push(release));
    }
    if (writeShouldFail(table, method)) {
      return jsonResponse(
        { code: "XX000", message: "raw database text", details: null, hint: null },
        500,
      );
    }
  }

  // A week is read as a range of days, where a day is read by its date alone.
  const isWeekRead =
    table === "day_totals" &&
    searchParams.getAll("local_date").some((condition) => condition.startsWith("gte."));
  if (isWeekRead && diaryBackend.weekReadsHang) {
    return new Promise(() => undefined);
  }
  if (
    isWeekRead &&
    searchParams
      .getAll("local_date")
      .some((condition) => diaryBackend.hungWeekStarts.has(condition.replace("gte.", "")))
  ) {
    return new Promise(() => undefined);
  }
  if (isWeekRead && diaryBackend.weekReadsFail) {
    return Promise.resolve(
      jsonResponse({ code: "XX000", message: "raw database text", details: null, hint: null }, 500),
    );
  }

  if (diaryBackend.hungTables.has(table)) {
    return new Promise(() => undefined);
  }

  if (diaryBackend.failingTables.has(table)) {
    return Promise.resolve(
      jsonResponse({ code: "XX000", message: "raw database text", details: null, hint: null }, 500),
    );
  }

  switch (table) {
    case "user":
      return Promise.resolve(
        jsonResponse({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
      );
    case "profiles":
      if (init?.method === "PATCH") {
        return Promise.resolve(saveTargets(init.body));
      }
      if (
        (diaryBackend.targetsReadFails && searchParams.get("select")?.includes("target_kcal")) ||
        (diaryBackend.timeZoneReadFails && searchParams.get("select")?.includes("timezone"))
      ) {
        return Promise.resolve(
          jsonResponse(
            { code: "XX000", message: "raw database text", details: null, hint: null },
            500,
          ),
        );
      }
      return Promise.resolve(jsonResponse([profileRow(searchParams.get("select") ?? "")]));
    case "programs":
      // The targets read asks for the active program alone with `ended_on=is.null`.
      return Promise.resolve(
        jsonResponse(
          diaryBackend.programs.filter(
            (row) => searchParams.get("ended_on") !== "is.null" || row["ended_on"] === null,
          ),
        ),
      );
    case "targets":
      // The targets read asks for the current row alone with `effective_to=is.null`.
      return Promise.resolve(
        jsonResponse(
          diaryBackend.engineTargets.filter(
            (row) => searchParams.get("effective_to") !== "is.null" || row["effective_to"] === null,
          ),
        ),
      );
    case "food_log_entries":
      if (init !== undefined && isDiaryWrite) {
        return Promise.resolve(writeEntries(init, searchParams));
      }
      if (diaryBackend.hungEntryReadsOnce.delete(readDateOf(searchParams))) {
        return new Promise(() => undefined);
      }
      return Promise.resolve(
        jsonResponse(
          diaryBackend.entries
            .filter((row) => inDateFilter(searchParams, row["local_date"]))
            .filter((row) => searchParams.get("deleted_at") !== "is.null" || isLive(row))
            .sort(byTimeline),
        ),
      );
    case "recipes":
      // The library asks for the live recipes alone with `is_archived=eq.false`, and for both without it.
      // One recipe is asked for by `id=eq.<id>`, and its row holds the ingredients as `recipe_ingredients`.
      return Promise.resolve(
        jsonResponse(
          diaryBackend.recipes
            .filter(
              (row) =>
                searchParams.get("is_archived") !== "eq.false" || row["is_archived"] === false,
            )
            .filter(
              (row) =>
                searchParams.get("id") === null ||
                searchParams.get("id") === `eq.${String(row["id"])}`,
            )
            .sort((first, second) => String(first["name"]).localeCompare(String(second["name"]))),
        ),
      );
    case "save_recipe":
      return Promise.resolve(saveRecipe(init ?? {}));
    case "day_logs":
      if (init !== undefined && isDiaryWrite) {
        return Promise.resolve(writeDayLogs(init, searchParams));
      }
      return Promise.resolve(
        jsonResponse(
          diaryBackend.dayLogs
            .filter((row) => inDateFilter(searchParams, row["local_date"]))
            .filter(
              (row) => searchParams.get("is_complete") !== "eq.true" || row["is_complete"] === true,
            ),
        ),
      );
    case "day_totals":
      return Promise.resolve(
        jsonResponse(
          diaryBackend.dayTotals.filter((row) => inDateFilter(searchParams, row["local_date"])),
        ),
      );
    case "training_goals":
      // The user has no goal, so the training reads that wait for it are not held up by an error.
      return Promise.resolve(jsonResponse([]));
    case "accepted_suggestions":
      // The user has accepted no suggestion, so the projection that waits for them is not held up by an error.
      return Promise.resolve(jsonResponse([]));
    default:
      return Promise.resolve(jsonResponse({ message: "unexpected request" }, 404));
  }
}

/** A real Supabase client whose network is the fake database above, for the provider the screens read through. */
export const diaryClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

/**
 * A query cache that never starts react-query's clean-up timers and does not wait between retries. The
 * diary reads set their own retry policy, which this cannot switch off, so a failing read is tried
 * again at once and then fails.
 */
export function createDiaryQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
}

/** The number of requests made to a table. */
export const requestsTo = (table: string): number =>
  diaryBackend.requests.filter((request) => request.table === table).length;

const encodeSegment = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

/** Gives the client a session without a real sign in. The token is unsigned: the fake user endpoint vouches for it. */
export async function signInDiaryClient(): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const accessToken = [
    encodeSegment({ alg: "HS256", typ: "JWT" }),
    encodeSegment({
      sub: SIGNED_IN_USER_ID,
      role: "authenticated",
      aud: "authenticated",
      exp: expiresAt,
    }),
    encodeSegment({ note: "unsigned" }),
  ].join(".");

  await diaryClient.auth.setSession({ access_token: accessToken, refresh_token: "refresh" });
}
