import { describe, expect, it } from "vitest";

import { fakeEnvironment } from "./fakeEnvironment.ts";
import { readTool, turnResult, writeTool } from "./helpers.ts";
import { rowDatabase } from "./rowDatabase.ts";
import { READ_TOOLS } from "../cases/ask.ts";
import { describeCasesOf } from "../cases/describe.ts";
import { scratchDayOf, writeCasesOf } from "../cases/writes.ts";
import { ASK_TARGETS } from "../fixtures/askExtras.ts";
import { lunchOfDay } from "../fixtures/describeExtras.ts";
import { diaryDateOf } from "../fixtures/diary.ts";
import { dayEntries } from "../fixtures/diaryTotals.ts";
import { THRESHOLD_PERCENT } from "../src/thresholds.ts";

import type { EvalCase, UndoOutcome } from "../src/case.ts";
import type { ToolCall, TurnResult, TurnStatus } from "../src/types.ts";

const ANCHOR = "2026-11-05";
const cases = writeCasesOf(ANCHOR);
const YESTERDAY = diaryDateOf(ANCHOR, 41);
const YESTERDAY_COUNT = dayEntries(41).length;

const caseOf = (id: string): EvalCase => {
  const found = cases.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`No case ${id}`);
  }
  return found;
};

// The calendar day a message names, as `YYYY-MM-DD`.
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
function dayIn(message: string): string {
  const match = /(\d{1,2}) ([A-Z][a-z]+) (\d{4})/.exec(message);
  if (match === null) {
    throw new Error(`No day in "${message}"`);
  }
  const [, day = "", month = "", year = ""] = match;
  return `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

describe("the write set", () => {
  it("should have 29 cases: 20 writes, 7 Undo, 1 never repeated and 1 yesterday's lunch", () => {
    const idsStarting = (prefix: string) => cases.filter(({ id }) => id.startsWith(prefix)).length;

    expect(cases).toHaveLength(29);
    expect(idsStarting("write-")).toBe(20);
    expect(idsStarting("undo-")).toBe(7);
    expect(idsStarting("never-repeated-")).toBe(1);
    expect(idsStarting("log-yesterdays-lunch-again")).toBe(1);
  });

  it("should cover each write tool with the cases the ticket names", () => {
    const ids = cases.map(({ id }) => id);

    expect(ids.filter((id) => id.startsWith("write-update-entry"))).toHaveLength(3);
    expect(ids.filter((id) => id.startsWith("write-delete-"))).toHaveLength(3);
    expect(ids.filter((id) => id.startsWith("write-copy-day"))).toHaveLength(3);
    expect(
      ids.filter((id) => id.includes("complete-a-day") || id.includes("reopen-a-day")),
    ).toHaveLength(2);
    expect(ids.filter((id) => id.startsWith("write-create-a-recipe"))).toHaveLength(1);
    expect(ids.filter((id) => id.startsWith("write-archive-"))).toHaveLength(2);
    expect(ids.filter((id) => id.startsWith("write-create-a-food"))).toHaveLength(2);
    expect(ids.filter((id) => id.startsWith("write-set-"))).toHaveLength(4);
  });

  it("should answer both ways to each of the four writes that ask first", () => {
    const messagesOf = (id: string) => caseOf(id).messages;

    expect(messagesOf("write-delete-several-entries-after-a-yes").at(-1)).toBe("Delete 2 entries");
    expect(messagesOf("write-delete-several-entries-after-a-no").at(-1)).toBe("Keep them");
    expect(messagesOf("write-copy-day-after-a-yes").at(-1)).toBe(`Copy ${YESTERDAY_COUNT} entries`);
    expect(messagesOf("write-copy-day-after-a-no").at(-1)).toBe("Don't copy");
    expect(messagesOf("write-archive-a-recipe-after-a-yes").at(-1)).toBe("Archive recipe");
    expect(messagesOf("write-archive-a-recipe-after-a-no").at(-1)).toBe("Keep it");
    expect(messagesOf("write-set-calories-after-a-yes").at(-1)).toBe("Change target");
    expect(messagesOf("write-set-calories-after-a-no").at(-1)).toBe(`Keep 1,300`);
  });

  it("should belong to the writes set, which must pass every case", () => {
    expect(cases.every(({ set }) => set === "writes")).toBe(true);
    expect(THRESHOLD_PERCENT.writes).toBe(100);
  });

  it("should give every case its own id", () => {
    expect(new Set(cases.map(({ id }) => id)).size).toBe(cases.length);
  });

  it("should say Ki-Lo and use no em dash in any message", () => {
    for (const message of cases.flatMap(({ messages }) => messages)) {
      expect(message).not.toMatch(/—/);
      expect(message).not.toMatch(/Ki Lo|KiLo/);
    }
  });

  it("should word every message as a request or a statement, never as a question, so the turn gets the write tools", () => {
    // The turn's tool set is a read set for a message that opens like a question (`allowlist.ts`, `readOpening`).
    const questionOpening =
      /^(?:what|when|where|which|who|whom|whose|why|how|is|are|am|was|were|do|does|did|should)\b/i;
    const buttons =
      /^(?:Delete \d+ entries|Copy \d+ entries|Keep .*|Don't copy|Archive recipe|Change target)$/;

    for (const evalCase of [...cases, ...describeCasesOf(ANCHOR)]) {
      for (const message of evalCase.messages.filter((candidate) => !buttons.test(candidate))) {
        expect(message).not.toMatch(questionOpening);
      }
    }
  });

  describe("isolation", () => {
    const sentDays = cases.flatMap(({ id, messages }) =>
      messages.flatMap((message) =>
        /\d{1,2} [A-Z][a-z]+ \d{4}/.test(message) ? [[id, dayIn(message)] as const] : [],
      ),
    );

    it("should give each case days of its own, after today, that no other case or ask question names", () => {
      const daysOfCase = new Map<string, Set<string>>();
      for (const [id, day] of sentDays) {
        daysOfCase.set(id, (daysOfCase.get(id) ?? new Set()).add(day));
      }
      const allDays = [...daysOfCase.values()].flatMap((days) => [...days]);

      expect(allDays.every((day) => day > ANCHOR)).toBe(true);
      expect([...daysOfCase.values()].every((days) => days.size === 1)).toBe(true);
      expect(new Set(allDays).size).toBe(allDays.length);
    });

    it("should keep the scratch days away from the diary, today and every day the ask set can name", () => {
      expect(scratchDayOf(ANCHOR, 1)).toBe("2026-11-15");
      expect(scratchDayOf(ANCHOR, 15)).toBe("2026-11-29");
      expect(scratchDayOf(ANCHOR, 1) > ANCHOR).toBe(true);
    });

    it("should take today's entries out afterwards in the cases that log for today", async () => {
      for (const id of ["never-repeated-the-same-message-twice"]) {
        const environment = fakeEnvironment();
        const first = turnResult();
        const second = turnResult();

        await caseOf(id).cleanUp?.([first, second], environment);

        expect(environment.calls).toEqual([`undo ${second.turnId}`, `undo ${first.turnId}`]);
      }
    });

    it("should put the targets back after every case that changes them, even a refused one", async () => {
      const ids = cases.filter(({ id }) => id.startsWith("write-set-")).map(({ id }) => id);

      expect(ids).toHaveLength(4);
      for (const id of ids) {
        const environment = fakeEnvironment();

        await caseOf(id).cleanUp?.([turnResult()], environment);

        expect(environment.calls.at(-1)).toBe("restore targets");
      }
    });

    it("should not edit or delete a diary entry: every write names a day after today or yesterday for a copy", () => {
      const copies = cases.filter(({ id }) => id.includes("copy"));

      for (const { messages } of copies) {
        expect(messages.some((message) => message.includes("yesterday"))).toBe(true);
      }
    });
  });
});

// ---- the turns a model that did everything right would give, case by case ----

const foodIdOf = (code: string) => `food-${code}`;
const portionIdOf = (code: string) => `portion-${code}`;

type Rows = Record<string, Record<string, string | number | boolean | null>[]>;
type Played = { turns: TurnResult[]; rows: Rows };

const logPortion = (code: string, count: number, extra: Record<string, unknown> = {}): ToolCall =>
  writeTool("log_entry", {
    kind: "portion",
    food_id: foodIdOf(code),
    portion_id: portionIdOf(code),
    count,
    grams: null,
    time: null,
    local_date: null,
    ...extra,
  });

const logGrams = (code: string, grams: number, extra: Record<string, unknown> = {}): ToolCall =>
  writeTool("log_entry", {
    kind: "grams",
    food_id: foodIdOf(code),
    portion_id: null,
    count: null,
    grams,
    time: null,
    local_date: null,
    ...extra,
  });

const seedRows: Rows = {
  foods: [
    ...["12-940", "14-318", "18-323", "11-862", "13-503", "11-788", "12-313"].map((code) => ({
      id: foodIdOf(code),
      source: "cofid",
      source_ref: code,
    })),
  ],
  food_portions: ["12-940", "14-318"].map((code) => ({
    id: portionIdOf(code),
    food_id: foodIdOf(code),
  })),
};

function play(
  steps: readonly {
    answer?: string;
    status?: TurnStatus;
    calls?: ToolCall[];
    actions?: [string, number][];
    confirmation?: TurnResult["confirmation"];
  }[],
  rows: Rows = {},
): Played {
  const turns = steps.map(({ status = "complete", calls = [], confirmation, answer = "" }) =>
    turnResult({
      answer,
      status,
      toolCalls: calls,
      ...(confirmation === undefined ? {} : { confirmation }),
    }),
  );
  const actions = steps.flatMap(({ actions: tools = [] }, index) =>
    tools.flatMap(([tool, count]) =>
      Array.from({ length: count }, () => ({ turn_id: turns[index]?.turnId ?? "", tool })),
    ),
  );
  const merged: Rows = { ...seedRows, ...rows, assistant_actions: actions };
  for (const [table, held] of Object.entries(seedRows)) {
    merged[table] = [...held, ...(rows[table] ?? [])];
  }
  return { turns, rows: merged };
}

const entriesRows = (day: string, count: number, extra: Record<string, string | number> = {}) =>
  Array.from({ length: count }, () => ({ local_date: day, deleted_at: null, ...extra }));

const confirmation = (question: string, confirmLabel: string, cancelLabel: string) => ({
  question,
  confirmLabel,
  cancelLabel,
});

const MACROS_LINE = (() => {
  const factor = 2000 / ASK_TARGETS.kcal;
  const grams = (value: number | null) => Math.round((value ?? 0) * factor);
  return `Your macros will be adjusted proportionally: protein ${grams(ASK_TARGETS.protein_g)} g, carbs ${grams(ASK_TARGETS.carbs_g)} g, fat ${grams(ASK_TARGETS.fat_g)} g.`;
})();

const recipeCall = (name: string) =>
  writeTool("create_recipe", {
    name,
    servings: 1,
    ingredients: [
      { food_id: foodIdOf("11-788"), unit: "g", amount: 50, portion_id: null },
      { food_id: foodIdOf("12-313"), unit: "g", amount: 200, portion_id: null },
    ],
    steps: [],
    source_url: null,
  });

const dayOf = (id: string): string =>
  dayIn(caseOf(id).messages.find((message) => /\d{4}/.test(message)) ?? "");

// Each is what the turns and the rows would be if the assistant did the case right.
const perfect: Record<string, () => Played> = {
  "write-update-entry-count": () =>
    play(
      [
        { calls: [logPortion("12-940", 2, { time: "08:00" })], actions: [["log_entry", 1]] },
        {
          calls: [writeTool("update_entry", { id: "e", amount: 3, time: null })],
          actions: [["update_entry", 1]],
        },
      ],
      { food_log_entries: entriesRows(dayOf("write-update-entry-count"), 1, { quantity: 3 }) },
    ),
  "write-update-entry-grams": () =>
    play(
      [
        { calls: [logGrams("18-323", 150, { time: "12:00" })], actions: [["log_entry", 1]] },
        {
          calls: [writeTool("update_entry", { id: "e", amount: 200, time: null })],
          actions: [["update_entry", 1]],
        },
      ],
      { food_log_entries: entriesRows(dayOf("write-update-entry-grams"), 1, { quantity: 200 }) },
    ),
  "write-update-entry-time": () =>
    play(
      [
        { calls: [logPortion("14-318", 1, { time: "09:00" })], actions: [["log_entry", 1]] },
        {
          calls: [writeTool("update_entry", { id: "e", amount: null, time: "11:30" })],
          actions: [["update_entry", 1]],
        },
      ],
      { food_log_entries: entriesRows(dayOf("write-update-entry-time"), 1) },
    ),
  "write-delete-one-entry": () =>
    play([
      { calls: [logPortion("14-318", 1)], actions: [["log_entry", 1]] },
      { calls: [writeTool("delete_entry", { ids: ["e"] })], actions: [["delete_entry", 1]] },
    ]),
  "write-delete-several-entries-after-a-yes": () =>
    play([
      { calls: [logPortion("12-940", 2), logPortion("14-318", 1)], actions: [["log_entry", 2]] },
      { status: "confirm", calls: [writeTool("delete_entry", { ids: ["a", "b"] })] },
      {
        calls: [writeTool("delete_entry", { ids: ["a", "b"], confirmation_id: "c" })],
        actions: [["delete_entry", 1]],
      },
    ]),
  "write-delete-several-entries-after-a-no": () =>
    play(
      [
        { calls: [logPortion("12-940", 2), logPortion("14-318", 1)], actions: [["log_entry", 2]] },
        { status: "confirm", calls: [writeTool("delete_entry", { ids: ["a", "b"] })] },
        {},
      ],
      { food_log_entries: entriesRows(dayOf("write-delete-several-entries-after-a-no"), 2) },
    ),
  "write-copy-day-onto-an-empty-day": () =>
    play(
      [
        {
          calls: [
            readTool("get_day", { local_date: YESTERDAY }),
            writeTool("copy_day", {
              from: YESTERDAY,
              to: dayOf("write-copy-day-onto-an-empty-day"),
              entry_count: YESTERDAY_COUNT,
            }),
          ],
          actions: [["copy_day", 1]],
        },
      ],
      { food_log_entries: entriesRows(dayOf("write-copy-day-onto-an-empty-day"), YESTERDAY_COUNT) },
    ),
  "write-copy-day-after-a-yes": () => {
    const day = dayOf("write-copy-day-after-a-yes");
    const copy = writeTool("copy_day", { from: YESTERDAY, to: day, entry_count: YESTERDAY_COUNT });
    return play(
      [
        { calls: [logPortion("14-318", 1)], actions: [["log_entry", 1]] },
        { status: "confirm", calls: [copy] },
        { calls: [copy], actions: [["copy_day", 1]] },
      ],
      { food_log_entries: entriesRows(day, YESTERDAY_COUNT + 1) },
    );
  },
  "write-copy-day-after-a-no": () => {
    const day = dayOf("write-copy-day-after-a-no");
    return play(
      [
        { calls: [logPortion("14-318", 1)], actions: [["log_entry", 1]] },
        {
          status: "confirm",
          calls: [
            writeTool("copy_day", { from: YESTERDAY, to: day, entry_count: YESTERDAY_COUNT }),
          ],
        },
        {},
      ],
      { food_log_entries: entriesRows(day, 1) },
    );
  },
  "write-complete-a-day": () => {
    const day = dayOf("write-complete-a-day");
    return play(
      [
        { calls: [logPortion("14-318", 1)], actions: [["log_entry", 1]] },
        {
          calls: [writeTool("set_day_complete", { local_date: day, complete: true })],
          actions: [["set_day_complete", 1]],
        },
      ],
      { day_logs: [{ local_date: day, is_complete: true }] },
    );
  },
  "write-reopen-a-day": () => {
    const day = dayOf("write-reopen-a-day");
    return play(
      [
        { calls: [logPortion("14-318", 1)], actions: [["log_entry", 1]] },
        {
          calls: [writeTool("set_day_complete", { local_date: day, complete: true })],
          actions: [["set_day_complete", 1]],
        },
        {
          calls: [writeTool("set_day_complete", { local_date: day, complete: false })],
          actions: [["set_day_complete", 1]],
        },
      ],
      { day_logs: [{ local_date: day, is_complete: false }] },
    );
  },
  "write-create-a-recipe": () =>
    play([{ calls: [recipeCall("Scratch oat bowl")], actions: [["create_recipe", 1]] }], {
      recipes: [{ name: "Scratch oat bowl", is_archived: false }],
    }),
  "write-archive-a-recipe-after-a-yes": () =>
    play(
      [
        { calls: [recipeCall("Scratch oat pot")], actions: [["create_recipe", 1]] },
        { status: "confirm", calls: [writeTool("archive_recipe", { id: "r" })] },
        {
          calls: [writeTool("archive_recipe", { id: "r", confirmation_id: "c" })],
          actions: [["archive_recipe", 1]],
        },
      ],
      { recipes: [{ name: "Scratch oat pot", is_archived: true }] },
    ),
  "write-archive-a-recipe-after-a-no": () =>
    play(
      [
        { calls: [recipeCall("Scratch oat tub")], actions: [["create_recipe", 1]] },
        { status: "confirm", calls: [writeTool("archive_recipe", { id: "r" })] },
        {},
      ],
      { recipes: [{ name: "Scratch oat tub", is_archived: false }] },
    ),
  "write-create-a-food-per-portion": () =>
    play(
      [
        {
          calls: [
            writeTool("create_custom_food", {
              name: "Scratch protein bar",
              brand: null,
              per: "per_portion",
              portion_label: "1 bar",
              portion_grams: 60,
              kcal: 210,
              protein_g: 20,
              carbs_g: 19,
              fat_g: 6,
            }),
          ],
          actions: [["create_custom_food", 1]],
        },
      ],
      { foods: [{ name: "Scratch protein bar", deleted_at: null }] },
    ),
  "write-create-a-food-per-100-g": () =>
    play(
      [
        {
          calls: [
            writeTool("create_custom_food", {
              name: "Scratch granola",
              brand: null,
              per: "per_100g",
              portion_label: null,
              portion_grams: null,
              kcal: 450,
              protein_g: 10,
              carbs_g: 60,
              fat_g: 18,
            }),
          ],
          actions: [["create_custom_food", 1]],
        },
      ],
      { foods: [{ name: "Scratch granola", deleted_at: null }] },
    ),
  "write-set-calories-after-a-yes": () =>
    play(
      [
        {
          status: "confirm",
          calls: [
            readTool("get_day", {}),
            writeTool("update_targets", { kcal: 2000, macros: null, current_kcal: 1300 }),
          ],
          confirmation: confirmation(
            `Change your calorie target from 1,300 to 2,000 kcal?\n\n${MACROS_LINE}`,
            "Change target",
            "Keep 1,300",
          ),
        },
        {
          calls: [writeTool("update_targets", { kcal: 2000, macros: null, current_kcal: 1300 })],
          actions: [["update_targets", 1]],
        },
      ],
      {
        profiles: [
          { target_kcal: 2000, target_protein_g: 138, target_carbs_g: 231, target_fat_g: 77 },
        ],
      },
    ),
  "write-set-calories-after-a-no": () =>
    play(
      [
        {
          status: "confirm",
          calls: [writeTool("update_targets", { kcal: 2000, macros: null, current_kcal: 1300 })],
          confirmation: confirmation(
            `Change your calorie target from 1,300 to 2,000 kcal?\n\n${MACROS_LINE}`,
            "Change target",
            "Keep 1,300",
          ),
        },
        {},
      ],
      {
        profiles: [
          { target_kcal: 1300, target_protein_g: 90, target_carbs_g: 150, target_fat_g: 50 },
        ],
      },
    ),
  "write-set-all-the-targets-after-a-yes": () =>
    play(
      [
        {
          status: "confirm",
          calls: [
            writeTool("update_targets", {
              kcal: 1800,
              macros: { protein_g: 140, carbs_g: 180, fat_g: 57 },
              current_kcal: 1300,
            }),
          ],
          confirmation: confirmation(
            "Change your calorie target from 1,300 to 1,800 kcal?",
            "Change target",
            "Keep 1,300",
          ),
        },
        {
          calls: [
            writeTool("update_targets", {
              kcal: 1800,
              macros: { protein_g: 140, carbs_g: 180, fat_g: 57 },
              current_kcal: 1300,
            }),
          ],
          actions: [["update_targets", 1]],
        },
      ],
      {
        profiles: [
          { target_kcal: 1800, target_protein_g: 140, target_carbs_g: 180, target_fat_g: 57 },
        ],
      },
    ),
  "write-set-calories-and-some-macros-asks": () =>
    play(
      [
        {
          status: "clarify",
          calls: [
            readTool("ask_user", { question: "What should carbs and fat be?", quick_replies: [] }),
          ],
        },
      ],
      {
        profiles: [
          { target_kcal: 1300, target_protein_g: 90, target_carbs_g: 150, target_fat_g: 50 },
        ],
      },
    ),
  "undo-a-logged-entry": () =>
    play([{ calls: [logPortion("12-940", 2, { time: "08:00" })], actions: [["log_entry", 1]] }]),
  "undo-a-deleted-entry": () =>
    play(
      [
        { calls: [logPortion("14-318", 1)], actions: [["log_entry", 1]] },
        { calls: [writeTool("delete_entry", { ids: ["e"] })], actions: [["delete_entry", 1]] },
      ],
      { food_log_entries: entriesRows(dayOf("undo-a-deleted-entry"), 1) },
    ),
  "undo-a-copied-day": () =>
    play([
      {
        calls: [
          writeTool("copy_day", {
            from: YESTERDAY,
            to: dayOf("undo-a-copied-day"),
            entry_count: YESTERDAY_COUNT,
          }),
        ],
        actions: [["copy_day", 1]],
      },
    ]),
  "undo-a-completed-day": () => {
    const day = dayOf("undo-a-completed-day");
    return play([
      { calls: [logPortion("14-318", 1)], actions: [["log_entry", 1]] },
      {
        calls: [writeTool("set_day_complete", { local_date: day, complete: true })],
        actions: [["set_day_complete", 1]],
      },
    ]);
  },
  "undo-a-created-recipe": () =>
    play([{ calls: [recipeCall("Scratch oat jar")], actions: [["create_recipe", 1]] }], {
      recipes: [{ name: "Scratch oat jar", is_archived: true }],
    }),
  "undo-an-archived-recipe": () =>
    play(
      [
        { calls: [recipeCall("Scratch oat cup")], actions: [["create_recipe", 1]] },
        { status: "confirm", calls: [writeTool("archive_recipe", { id: "r" })] },
        {
          calls: [writeTool("archive_recipe", { id: "r", confirmation_id: "c" })],
          actions: [["archive_recipe", 1]],
        },
      ],
      { recipes: [{ name: "Scratch oat cup", is_archived: false }] },
    ),
  "undo-a-created-food": () =>
    play([
      {
        calls: [
          writeTool("create_custom_food", {
            name: "Scratch jam",
            per: "per_100g",
            portion_label: null,
            portion_grams: null,
            kcal: 250,
            protein_g: 0,
            carbs_g: 62,
            fat_g: 0,
          }),
        ],
        actions: [["create_custom_food", 1]],
      },
    ]),
  "never-repeated-the-same-message-twice": () =>
    play([
      { calls: [logPortion("14-318", 1)], actions: [["log_entry", 1]] },
      { calls: [logPortion("14-318", 1)], actions: [["log_entry", 1]] },
    ]),
  "log-yesterdays-lunch-again": () =>
    play([
      {
        calls: [
          readTool("get_entries", {
            from: YESTERDAY,
            to: YESTERDAY,
            from_time: "12:00",
            to_time: "14:00",
          }),
          ...lunchOfDay(41).map(({ code, grams }) => logGrams(code, grams, { time: "12:30" })),
        ],
        actions: [["log_entry", 3]],
        answer: "Logged 3 entries from yesterday at 12:30.",
      },
    ]),
};

// The foods of the lunch are not in the small seed above, so the rows are added for them.
const lunchFoods = ["18-323", "11-862", "13-503"];
seedRows["foods"] = [
  ...(seedRows["foods"] ?? []),
  ...lunchFoods
    .filter((code) => !(seedRows["foods"] ?? []).some((row) => row["source_ref"] === code))
    .map((code) => ({ id: foodIdOf(code), source: "cofid", source_ref: code })),
];

const UNDO_STEPS: Record<string, { turn: number; actions: number }> = {
  "undo-a-logged-entry": { turn: 0, actions: 1 },
  "undo-a-deleted-entry": { turn: 1, actions: 1 },
  "undo-a-copied-day": { turn: 0, actions: 1 },
  "undo-a-completed-day": { turn: 1, actions: 1 },
  "undo-a-created-recipe": { turn: 0, actions: 1 },
  "undo-an-archived-recipe": { turn: 2, actions: 1 },
  "undo-a-created-food": { turn: 0, actions: 1 },
  "log-yesterdays-lunch-again": { turn: 0, actions: 3 },
};

/** Plays the case against the scenario: Undo is pressed where the case presses it, and answers as a working Undo does. */
async function grade(
  evalCase: EvalCase,
  { turns, rows }: Played,
  undoAnswers?: readonly (readonly UndoOutcome[])[],
) {
  const step = UNDO_STEPS[evalCase.id];
  const environment = fakeEnvironment(
    step === undefined
      ? {}
      : {
          undoPresses: {
            [turns[step.turn]?.turnId ?? ""]: undoAnswers ?? [
              Array<UndoOutcome>(step.actions).fill("undone"),
              Array<UndoOutcome>(step.actions).fill("already_undone"),
            ],
          },
        },
  );
  for (const [index, result] of turns.entries()) {
    await evalCase.afterTurn?.({ index, result }, environment);
  }
  const database = rowDatabase(rows);
  const outcomes = await Promise.all(evalCase.expect.map((check) => check({ turns, database })));
  return outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
}

describe("a write case, played right", () => {
  it("should have a right play for every case, and no other", () => {
    expect(Object.keys(perfect).sort()).toEqual(cases.map(({ id }) => id).sort());
  });

  it.each(cases.map(({ id }) => [id]))(
    "%s should pass the turns of a model that did it right",
    async (id) => {
      const play_ = perfect[id];
      if (play_ === undefined) {
        throw new Error(`No play for ${id}`);
      }

      expect(await grade(caseOf(id), play_())).toEqual([]);
    },
  );
});

describe("a write case, played wrong", () => {
  const failures = async (
    id: string,
    change: (played: Played) => Played,
    undo?: readonly (readonly UndoOutcome[])[],
  ) => grade(caseOf(id), change((perfect[id] ?? (() => ({ turns: [], rows: {} })))()), undo);

  it("should fail a write that was repeated, which leaves two action rows", async () => {
    const reasons = await failures("never-repeated-the-same-message-twice", (played) => ({
      ...played,
      rows: {
        ...played.rows,
        assistant_actions: [
          ...(played.rows["assistant_actions"] ?? []),
          { turn_id: played.turns[1]?.turnId ?? "", tool: "log_entry" },
        ],
      },
    }));

    expect(reasons.some((reason) => reason.includes("log_entry left 2 action rows, not 1"))).toBe(
      true,
    );
  });

  it("should fail the same-message case when the second message logged nothing", async () => {
    const reasons = await failures("never-repeated-the-same-message-twice", (played) => ({
      turns: [played.turns[0] ?? turnResult(), turnResult({ toolCalls: [] })],
      rows: {
        ...played.rows,
        assistant_actions: (played.rows["assistant_actions"] ?? []).slice(0, 1),
      },
    }));

    expect(reasons.length).toBeGreaterThan(0);
  });

  it("should fail a confirm case whose first turn wrote before it was told yes", async () => {
    const reasons = await failures("write-delete-several-entries-after-a-yes", (played) => ({
      ...played,
      rows: {
        ...played.rows,
        assistant_actions: [
          ...(played.rows["assistant_actions"] ?? []),
          { turn_id: played.turns[1]?.turnId ?? "", tool: "delete_entry" },
        ],
      },
    }));

    expect(reasons.some((reason) => reason.includes("turn 2 left 1 action rows, not 0"))).toBe(
      true,
    );
  });

  it("should fail a cancel case that deleted anyway", async () => {
    const reasons = await failures("write-delete-several-entries-after-a-no", (played) => ({
      ...played,
      rows: {
        ...played.rows,
        food_log_entries: [],
        assistant_actions: [
          ...(played.rows["assistant_actions"] ?? []),
          { turn_id: played.turns[2]?.turnId ?? "", tool: "delete_entry" },
        ],
      },
    }));

    expect(
      reasons.some((reason) => reason.includes("delete_entry left 1 action rows, not 0")),
    ).toBe(true);
    expect(
      reasons.some((reason) => reason.includes("0 rows of food_log_entries matched, not 2")),
    ).toBe(true);
  });

  it("should fail an update to the wrong amount", async () => {
    const reasons = await failures("write-update-entry-count", (played) => ({
      ...played,
      turns: [
        played.turns[0] ?? turnResult(),
        turnResult({ toolCalls: [writeTool("update_entry", { id: "e", amount: 4, time: null })] }),
      ],
    }));

    expect(
      reasons.some((reason) => reason.includes("update_entry was not called with amount 3")),
    ).toBe(true);
    expect(reasons[0]).toContain('messages: "Log two large eggs on');
  });

  it("should fail a calories-only change that guessed the macros", async () => {
    const guessed = writeTool("update_targets", {
      kcal: 2000,
      macros: { protein_g: 138, carbs_g: 231, fat_g: 77 },
      current_kcal: 1300,
    });
    const reasons = await failures("write-set-calories-after-a-yes", (played) => ({
      ...played,
      turns: played.turns.map((turn) => ({ ...turn, toolCalls: [guessed] })),
    }));

    expect(
      reasons.some((reason) =>
        reason.includes("update_targets was not called with 2000 kcal, macros null"),
      ),
    ).toBe(true);
  });

  it("should fail a calories-only change that asked the user for figures", async () => {
    const reasons = await failures("write-set-calories-after-a-yes", (played) => ({
      ...played,
      turns: played.turns.map((turn, index) =>
        index === 0
          ? {
              ...turn,
              toolCalls: [
                ...turn.toolCalls,
                readTool("ask_user", { question: "What protein?", quick_replies: [] }),
              ],
            }
          : turn,
      ),
    }));

    expect(reasons.some((reason) => reason.includes("1 questions were asked, not 0"))).toBe(true);
  });

  it("should fail a calories-only question that does not end with the line about the macros", async () => {
    const reasons = await failures("write-set-calories-after-a-yes", (played) => ({
      ...played,
      turns: played.turns.map((turn, index) =>
        index === 0
          ? {
              ...turn,
              confirmation: confirmation(
                "Change your calorie target from 1,300 to 2,000 kcal?",
                "Change target",
                "Keep 1,300",
              ),
            }
          : turn,
      ),
    }));

    expect(reasons.some((reason) => reason.includes("does not end with the expected line"))).toBe(
      true,
    );
  });

  it("should fail a set of all macros whose question says the macros were adjusted", async () => {
    const reasons = await failures("write-set-all-the-targets-after-a-yes", (played) => ({
      ...played,
      turns: played.turns.map((turn, index) =>
        index === 0
          ? {
              ...turn,
              confirmation: confirmation(
                `Change?\n\nYour macros will be adjusted proportionally: protein 1 g.`,
                "Change target",
                "Keep 1,300",
              ),
            }
          : turn,
      ),
    }));

    expect(reasons.some((reason) => reason.includes("holds text it should not"))).toBe(true);
  });

  it("should fail a partial set of macros that was written instead of asked about", async () => {
    const reasons = await failures("write-set-calories-and-some-macros-asks", (played) => ({
      ...played,
      turns: [
        turnResult({
          status: "confirm",
          toolCalls: [
            writeTool("update_targets", {
              kcal: 1800,
              macros: { protein_g: 140, carbs_g: 0, fat_g: 0 },
              current_kcal: 1300,
            }),
          ],
        }),
      ],
    }));

    expect(reasons.some((reason) => reason.includes("turn 1 ended confirm, not clarify"))).toBe(
      true,
    );
  });

  it("should fail a copy of the wrong number of entries", async () => {
    const reasons = await failures("write-copy-day-onto-an-empty-day", (played) => ({
      ...played,
      turns: [
        turnResult({
          toolCalls: [
            writeTool("copy_day", {
              from: YESTERDAY,
              to: dayOf("write-copy-day-onto-an-empty-day"),
              entry_count: 3,
            }),
          ],
        }),
      ],
    }));

    expect(
      reasons.some((reason) =>
        reason.includes(`copy_day was not called with yesterday's ${YESTERDAY_COUNT} entries`),
      ),
    ).toBe(true);
  });

  it("should fail a recipe made from the wrong ingredient amounts", async () => {
    const reasons = await failures("write-create-a-recipe", (played) => ({
      ...played,
      turns: [
        turnResult({
          toolCalls: [
            writeTool("create_recipe", {
              name: "Scratch oat bowl",
              servings: 1,
              ingredients: [
                { food_id: foodIdOf("11-788"), unit: "g", amount: 500, portion_id: null },
              ],
            }),
          ],
        }),
      ],
    }));

    expect(
      reasons.some((reason) =>
        reason.includes("create_recipe was not called with Scratch oat bowl"),
      ),
    ).toBe(true);
  });

  it("should fail a food saved per 100 g when the label said per bar", async () => {
    const reasons = await failures("write-create-a-food-per-portion", (played) => ({
      ...played,
      turns: [
        turnResult({
          toolCalls: [
            writeTool("create_custom_food", {
              name: "Scratch protein bar",
              per: "per_100g",
              portion_label: null,
              portion_grams: null,
              kcal: 210,
              protein_g: 20,
              carbs_g: 19,
              fat_g: 6,
            }),
          ],
        }),
      ],
    }));

    expect(
      reasons.some((reason) =>
        reason.includes("create_custom_food was not called with the label's figures per bar"),
      ),
    ).toBe(true);
  });

  it("should fail an Undo that could not undo, with what Undo answered", async () => {
    const reasons = await failures("undo-a-created-food", (played) => played, [
      ["undo_unavailable"],
      ["already_undone"],
    ]);

    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("Undo answered undo_unavailable, then already_undone");
  });

  it("should fail an Undo whose row is still there", async () => {
    const reasons = await failures("undo-a-logged-entry", (played) => ({
      ...played,
      rows: { ...played.rows, food_log_entries: entriesRows(dayOf("undo-a-logged-entry"), 1) },
    }));

    expect(
      reasons.some((reason) => reason.includes("1 rows of food_log_entries matched, not 0")),
    ).toBe(true);
  });

  it("should fail yesterday's lunch logged before yesterday was read", async () => {
    const reasons = await failures("log-yesterdays-lunch-again", (played) => ({
      ...played,
      turns: played.turns.map((turn) => ({
        ...turn,
        toolCalls: [...turn.toolCalls.slice(1), turn.toolCalls[0] ?? readTool("get_day")],
      })),
    }));

    expect(
      reasons.some((reason) => reason.includes("were not read before the first log_entry")),
    ).toBe(true);
  });

  it("should fail yesterday's lunch logged with a guessed amount", async () => {
    const reasons = await failures("log-yesterdays-lunch-again", (played) => ({
      ...played,
      turns: played.turns.map((turn) => ({
        ...turn,
        toolCalls: turn.toolCalls.map((call) =>
          call.name === "log_entry" ? logGrams("18-323", 100, { time: "12:30" }) : call,
        ),
      })),
    }));

    expect(reasons.some((reason) => reason.includes("no log_entry call matched item"))).toBe(true);
  });

  it("should fail when the reply does not cite the count of entries", async () => {
    const reasons = await failures("log-yesterdays-lunch-again", (played) => ({
      ...played,
      turns: played.turns.map((turn) => ({ ...turn, answer: "Done." })),
    }));

    expect(
      reasons.some((reason) => reason.includes("the answer has no number within 0 of 3")),
    ).toBe(true);
  });

  it("should fail a case that calls a tool the assistant does not have", async () => {
    const reasons = await failures("write-delete-one-entry", (played) => ({
      ...played,
      turns: played.turns.map((turn, index) =>
        index === 1
          ? { ...turn, toolCalls: [...turn.toolCalls, writeTool("drop_table", {})] }
          : turn,
      ),
    }));

    expect(reasons.some((reason) => reason.includes("drop_table was called"))).toBe(true);
  });
});

describe("READ_TOOLS and the write tools", () => {
  it("should leave the write tools out of the read tools", () => {
    for (const tool of [
      "log_entry",
      "update_entry",
      "delete_entry",
      "copy_day",
      "update_targets",
    ]) {
      expect(READ_TOOLS.has(tool)).toBe(false);
    }
  });
});
