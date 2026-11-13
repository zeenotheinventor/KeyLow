import {
  assert,
  assertEquals,
  assertFalse,
  assertNotEquals,
  assertStringIncludes,
} from "@std/assert";

import { executeTool } from "../executor.ts";
import { toJsonSchema } from "../tool.ts";
import { undoAction } from "../undo.ts";
import { planMealsTool } from "./planMeals.ts";
import { kitchenTables, planContext, scriptedGeneration } from "./planMealsFixtures.ts";
import { replanDayTool } from "./replanDay.ts";
import { payloadOf } from "./testing.ts";
import { structuredOf } from "./writeFixtures.ts";

import type { StoredUndo } from "../store.ts";

const planInput = {
  start_date: null,
  days: null,
  max_repeats: null,
  named_macros: [] as string[],
  request: null,
};
const ranking = { ranking: ["r1", "r2", "f1", "f2"] };
const wishes = { ranking: ["f1"] };

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

const daysOf = (tables: Tables): Row[] =>
  (tables["meal_plans"]?.[0]?.["meal_plan_days"] ?? []) as Row[];
const itemsOf = (day: Row | undefined): Row[] => (day?.["meal_plan_items"] ?? []) as Row[];
const dayOn = (tables: Tables, date: string): Row | undefined =>
  daysOf(tables).find((day) => day["local_date"] === date);

// What a day holds, without the ids the database gave and the links that name them.
const contentOf = (day: Row | undefined): string =>
  JSON.stringify(
    [...itemsOf(day)]
      .sort((first, second) => Number(first["position"]) - Number(second["position"]))
      .map((item) => {
        // `at` and the two `leftover_of_` keys are the stand-in database's own bookkeeping.
        const {
          id: _id,
          leftover_of: _link,
          at: _at,
          leftover_of_position: _p,
          leftover_of_day: _d,
          ...content
        } = item;
        return content;
      }),
  );

// How many leftovers on any day name an item of this day as the cook.
const linkedTo = (tables: Tables, date: string): number => {
  const cooks = new Set(itemsOf(dayOn(tables, date)).map((item) => item["id"]));
  return daysOf(tables)
    .flatMap(itemsOf)
    .filter((item) => cooks.has(item["leftover_of"])).length;
};

const idsWithEaters = (tables: Tables): Set<unknown> =>
  new Set(
    daysOf(tables).flatMap((day) =>
      itemsOf(day).flatMap((item) => (item["leftover_of"] === null ? [] : [item["leftover_of"]])),
    ),
  );

// A day whose items nobody eats leftovers of, and one that holds a cook somebody does.
const freeDay = (tables: Tables): Row | undefined => {
  const eaten = idsWithEaters(tables);
  return daysOf(tables).find((day) => itemsOf(day).every((item) => !eaten.has(item["id"])));
};
const cookDay = (tables: Tables): Row | undefined => {
  const eaten = idsWithEaters(tables);
  return daysOf(tables).find((day) => itemsOf(day).some((item) => eaten.has(item["id"])));
};

async function plannedWeek(replies: unknown[] = [ranking, wishes]) {
  const scripted = scriptedGeneration(replies);
  const made = planContext([planMealsTool, replanDayTool], { generation: scripted.generation });
  const planned = await executeTool(made.ctx, "plan_meals", planInput);
  assertEquals(planned.status, "ok");
  return { ...made, ...scripted };
}

type Planned = Awaited<ReturnType<typeof plannedWeek>>;

const replan = (planned: Planned, day: Row | undefined, request: string | null = null) =>
  executeTool(planned.ctx, "replan_day", { local_date: String(day?.["local_date"]), request });

// What the turn loop does with `structured.undo`: keeps it beside the action, for the inverse to read.
const keepUndo = (planned: Planned, result: Awaited<ReturnType<typeof replan>>): string => {
  assert(result.status === "ok" && result.actionId !== null);
  planned.store.previousValues.set(result.actionId, structuredOf(result)["undo"] as StoredUndo);
  return result.actionId;
};

Deno.test("replan_day is a kitchen write on a plan day that makes a generation call", () => {
  assertEquals(replanDayTool.name, "replan_day");
  assertEquals(replanDayTool.group, "kitchen");
  assertEquals(replanDayTool.generation, true);
  assertEquals(replanDayTool.kind, "write");
  assertEquals(replanDayTool.targetTable, "meal_plan_days");
  assertEquals(replanDayTool.needsConfirmation, undefined);
  assert(replanDayTool.description.length < 200);
  assertFalse("confirmation_id" in (toJsonSchema(replanDayTool)["properties"] as object));
});

Deno.test(
  "with no new words there is no Opus call and every other day is byte-identical",
  async () => {
    const planned = await plannedWeek();
    const day = freeDay(planned.stub.tables);
    assert(day !== undefined);
    const before = JSON.stringify(daysOf(planned.stub.tables));
    const others = daysOf(planned.stub.tables).filter((other) => other !== day);

    const result = await replan(planned, day);

    assertEquals(result.status, "ok");
    assertEquals(planned.calls.length, 1);
    assertEquals((payloadOf(result) as { replanned: boolean }).replanned, true);
    const after = daysOf(planned.stub.tables);
    for (const other of others) {
      const same = after.find((candidate) => candidate["id"] === other["id"]);
      assertEquals(JSON.stringify(same), JSON.stringify(other));
    }
    assertEquals(after.length, JSON.parse(before).length);
  },
);

Deno.test(
  "new words make exactly one plan_generate call and plan only what it ranked",
  async () => {
    const planned = await plannedWeek();
    const day = freeDay(planned.stub.tables);
    const others = daysOf(planned.stub.tables).filter((other) => other !== day);
    const othersBefore = JSON.stringify(others);

    const result = await replan(planned, day, "no meat or fish that day");

    assertEquals(result.status, "ok");
    assertEquals(planned.calls.length, 2);
    assertEquals(planned.calls[1]?.route, "plan_generate");
    assertStringIncludes(String(planned.calls[1]?.userContent), "no meat or fish that day");
    assertEquals(JSON.stringify(others), othersBefore);
    assertNotEquals(contentOf(day), "[]");
  },
);

Deno.test("the card is the replanned card, built from the day's own figures", async () => {
  const planned = await plannedWeek();
  const day = freeDay(planned.stub.tables);

  const result = await replan(planned, day, "something light");

  const card = structuredOf(result)["card"] as {
    kind: string;
    title: string;
    sub: string;
    rows: { name: string; kcalText: string }[];
    undo: string;
    undoneSub: string;
  };
  const date = String(day?.["local_date"]);
  assertEquals(card.kind, "plan_day_replanned");
  assertStringIncludes(card.title, "Replanned ");
  const kcal = itemsOf(dayOn(planned.stub.tables, date)).reduce(
    (sum, item) => sum + (item["nutrients"] as { kcal: number }).kcal,
    0,
  );
  assertStringIncludes(card.sub, `${Math.round(kcal).toLocaleString("en-GB")} of 1,300 kcal`);
  assertEquals(card.undo, "available");
  assertStringIncludes(card.undoneSub, "back as it was");
});

Deno.test("a confirmed day is refused with no Opus call and nothing written", async () => {
  const planned = await plannedWeek();
  const day = freeDay(planned.stub.tables);
  assert(day !== undefined);
  Object.assign(day, { confirmed_at: "2026-11-16T12:00:00+00:00", confirmed_entry_ids: [] });
  const before = JSON.stringify(planned.stub.tables["meal_plans"]);

  const result = await replan(planned, day, "no meat");

  assertEquals((payloadOf(result) as { reason: string }).reason, "day_confirmed");
  assertEquals(planned.calls.length, 1);
  assertEquals(JSON.stringify(planned.stub.tables["meal_plans"]), before);
});

Deno.test("a date that is in no plan is refused", async () => {
  const planned = await plannedWeek();

  const result = await executeTool(planned.ctx, "replan_day", {
    local_date: "2027-02-01",
    request: null,
  });

  assertEquals((payloadOf(result) as { reason: string }).reason, "day_not_planned");
  assertEquals(planned.calls.length, 1);
});

Deno.test(
  "a cook that other days eat leftovers of is kept, and those days keep their link",
  async () => {
    const planned = await plannedWeek();
    const day = cookDay(planned.stub.tables);
    assert(day !== undefined, "the week has a cook with leftovers");
    const date = String(day["local_date"]);
    const linkedBefore = linkedTo(planned.stub.tables, date);
    const contentBefore = new Map(
      daysOf(planned.stub.tables).map((d) => [d["local_date"], contentOf(d)]),
    );

    const result = await replan(planned, day, "something light");

    assertEquals(result.status, "ok");
    const card = structuredOf(result)["card"] as { note: string };
    assertStringIncludes(card.note, "Kept ");
    assertStringIncludes(card.note, "other days eat");
    assertEquals((payloadOf(result) as { notes: string[] }).notes.length, 1);
    const tables = planned.stub.tables;
    for (const other of daysOf(tables).filter((d) => d["local_date"] !== date)) {
      assertEquals(
        contentOf(other),
        contentBefore.get(other["local_date"]),
        String(other["local_date"]),
      );
    }
    assertEquals(linkedTo(tables, date), linkedBefore);
    assert(linkedBefore > 0);
  },
);

Deno.test("Undo puts the day and the links back, once", async () => {
  const planned = await plannedWeek();
  const day = cookDay(planned.stub.tables);
  assert(day !== undefined);
  const date = String(day["local_date"]);
  const contentBefore = daysOf(planned.stub.tables).map(contentOf);
  const eatersBefore = daysOf(planned.stub.tables).map(
    (d) => itemsOf(d).filter((item) => item["leftover_of"] !== null).length,
  );
  const result = await replan(planned, day, "something light");
  const actionId = keepUndo(planned, result);
  assertNotEquals(
    contentOf(dayOn(planned.stub.tables, date)),
    contentBefore[daysOf(planned.stub.tables).findIndex((d) => d["local_date"] === date)],
  );

  const first = await undoAction(planned.ctx, actionId);
  const second = await undoAction(planned.ctx, actionId);

  assertEquals(first, { status: "undone", actionId });
  assertEquals(second, { status: "error", code: "already_undone" });
  assertEquals(daysOf(planned.stub.tables).map(contentOf), contentBefore);
  assertEquals(
    daysOf(planned.stub.tables).map(
      (d) => itemsOf(d).filter((item) => item["leftover_of"] !== null).length,
    ),
    eatersBefore,
  );
});

Deno.test("Undo is unavailable when the day changed since, and changes nothing", async () => {
  const planned = await plannedWeek();
  const day = freeDay(planned.stub.tables);
  assert(day !== undefined);
  const result = await replan(planned, day, "something light");
  const actionId = keepUndo(planned, result);
  const items = itemsOf(day);
  items.pop();
  const after = JSON.stringify(planned.stub.tables["meal_plans"]);

  const undone = await undoAction(planned.ctx, actionId);

  assertEquals(undone, { status: "error", code: "undo_unavailable", reason: "changed" });
  assertEquals(JSON.stringify(planned.stub.tables["meal_plans"]), after);
});

Deno.test("Undo is unavailable once the day is confirmed", async () => {
  const planned = await plannedWeek();
  const day = freeDay(planned.stub.tables);
  assert(day !== undefined);
  const result = await replan(planned, day, "something light");
  const actionId = keepUndo(planned, result);
  Object.assign(day, { confirmed_at: "2026-11-16T12:00:00+00:00", confirmed_entry_ids: [] });

  const undone = await undoAction(planned.ctx, actionId);

  assertEquals(undone, { status: "error", code: "undo_unavailable" });
});

Deno.test("Undo is unavailable when the turn's stored value is gone", async () => {
  const planned = await plannedWeek();
  const result = await replan(planned, freeDay(planned.stub.tables), "something light");
  assert(result.status === "ok" && result.actionId !== null);

  const undone = await undoAction(planned.ctx, result.actionId);

  assertEquals(undone, { status: "error", code: "undo_unavailable" });
});

Deno.test("a refused, timed out or failed ranking saves nothing and says so", async () => {
  for (const failure of ["generation_refused", "generation_timeout", "generation_failed"]) {
    const planned = await plannedWeek([ranking, { failure }]);
    const before = JSON.stringify(planned.stub.tables["meal_plans"]);

    const result = await replan(planned, freeDay(planned.stub.tables), "something light");

    assertEquals((payloadOf(result) as { reason: string }).reason, failure);
    assertEquals(planned.calls.length, 2);
    assertEquals(JSON.stringify(planned.stub.tables["meal_plans"]), before);
  }
});

Deno.test("an answer that is not a ranking fails the replan and saves nothing", async () => {
  const planned = await plannedWeek([ranking, { nonsense: true }]);
  const before = JSON.stringify(planned.stub.tables["meal_plans"]);

  const result = await replan(planned, freeDay(planned.stub.tables), "something light");

  assertEquals((payloadOf(result) as { reason: string }).reason, "generation_failed");
  assertEquals(JSON.stringify(planned.stub.tables["meal_plans"]), before);
});

Deno.test("new words with no generation service answer tool_failed and save nothing", async () => {
  const planned = await plannedWeek();
  const { generation: _unused, ...withoutGeneration } = planned.ctx;
  const before = JSON.stringify(planned.stub.tables["meal_plans"]);

  const result = await executeTool(withoutGeneration, "replan_day", {
    local_date: String(freeDay(planned.stub.tables)?.["local_date"]),
    request: "something light",
  });

  assertEquals(result.status, "error");
  assertEquals(JSON.stringify(planned.stub.tables["meal_plans"]), before);
});

Deno.test("with no new words the replan needs no generation service", async () => {
  const planned = await plannedWeek();
  const { generation: _unused, ...withoutGeneration } = planned.ctx;

  const result = await executeTool(withoutGeneration, "replan_day", {
    local_date: String(freeDay(planned.stub.tables)?.["local_date"]),
    request: null,
  });

  assertEquals(result.status, "ok");
});

Deno.test("a failed write of the day is a failed call and leaves the plan as it was", async () => {
  let failing = false;
  const scripted = scriptedGeneration([ranking]);
  const made = planContext([planMealsTool, replanDayTool], {
    generation: scripted.generation,
    replaceFails: () => failing,
  });
  await executeTool(made.ctx, "plan_meals", planInput);
  failing = true;
  const before = JSON.stringify(made.stub.tables["meal_plans"]);

  const result = await replan({ ...made, ...scripted }, freeDay(made.stub.tables));

  assertEquals(result.status, "error");
  assertEquals(JSON.stringify(made.stub.tables["meal_plans"]), before);
});

Deno.test(
  "a day that could not be rewritten for its link is reported and the replan stands",
  async () => {
    let writes = 0;
    const scripted = scriptedGeneration([ranking]);
    const made = planContext([planMealsTool, replanDayTool], {
      generation: scripted.generation,
      replaceFails: () => writes++ > 0,
    });
    await executeTool(made.ctx, "plan_meals", planInput);
    writes = 0;
    const day = cookDay(made.stub.tables);

    const result = await replan({ ...made, ...scripted }, day);

    assertEquals(result.status, "ok");
    const notes = (payloadOf(result) as { notes: string[] }).notes;
    assertEquals(notes.length, 2);
    assertStringIncludes(notes[1] ?? "", "could not be rewritten");
    assert(made.reported.length > 0);
  },
);

const recipeIdsOf = (day: Row | undefined): unknown[] =>
  itemsOf(day).flatMap((item) => (item["item_type"] === "recipe" ? [item["recipe_id"]] : []));
// The limit a regenerated day follows is the person's own now, and not the one the plan was made under. One recipe
// of one serving is planned for the mornings, so the other days' mornings count its appearances exactly.
for (const { days, now, placed } of [
  { days: 2, now: 1, placed: 0 },
  { days: 3, now: 3, placed: 1 },
  { days: 3, now: 0, placed: 1 },
]) {
  Deno.test(
    `a replan follows the repeat limit set in the profile now (${now} with ${days - 1} other days)`,
    async () => {
      const scripted = scriptedGeneration([ranking]);
      const made = planContext([planMealsTool, replanDayTool], {
        generation: scripted.generation,
        profile: { meal_plan_repeat_limit: 0 },
        tables: { recipes: kitchenTables().recipes.slice(0, 1) },
      });
      await executeTool(made.ctx, "plan_meals", { ...planInput, days });
      const last = daysOf(made.stub.tables).at(-1);
      assertEquals(recipeIdsOf(last).length, 1, "the plan placed the recipe on every day");
      const profile = made.stub.tables["profiles"]?.[0];
      assert(profile !== undefined);
      profile["meal_plan_repeat_limit"] = now;

      const result = await replan({ ...made, ...scripted }, last);

      assertEquals(result.status, "ok");
      assertEquals(
        recipeIdsOf(dayOn(made.stub.tables, String(last?.["local_date"]))).length,
        placed,
      );
    },
  );
}

Deno.test(
  "a kept cook whose recipe was archived since is kept as it was, and the replan succeeds",
  async () => {
    const planned = await plannedWeek();
    const day = cookDay(planned.stub.tables);
    assert(day !== undefined);
    const eaten = idsWithEaters(planned.stub.tables);
    const cook = itemsOf(day).find((item) => eaten.has(item["id"]));
    assert(cook !== undefined);
    const recipe = planned.stub.tables["recipes"]?.find((row) => row["id"] === cook["recipe_id"]);
    assert(recipe !== undefined);
    recipe["is_archived"] = true;
    const date = String(day["local_date"]);
    const cookContent = JSON.stringify([cook["recipe_id"], cook["snapshot"]]);

    const result = await replan(planned, day);

    assertEquals(result.status, "ok");
    const after = itemsOf(dayOn(planned.stub.tables, date)).find(
      (item) => item["recipe_id"] === cook["recipe_id"],
    );
    assertEquals(JSON.stringify([after?.["recipe_id"], after?.["snapshot"]]), cookContent);
  },
);

Deno.test(
  "a relink that cannot be written because a day is confirmed is counted in the note",
  async () => {
    const planned = await plannedWeek();
    const day = cookDay(planned.stub.tables);
    assert(day !== undefined);
    const eaten = idsWithEaters(planned.stub.tables);
    const eater = daysOf(planned.stub.tables).find((other) =>
      itemsOf(other).some((item) => eaten.has(item["leftover_of"]) && other !== day),
    );
    assert(eater !== undefined);
    const cookIds = new Set(itemsOf(day).map((item) => item["id"]));
    const eatsFromDay = daysOf(planned.stub.tables).filter((other) =>
      itemsOf(other).some((item) => cookIds.has(item["leftover_of"])),
    );
    for (const confirmed of eatsFromDay) {
      Object.assign(confirmed, {
        confirmed_at: "2026-11-16T12:00:00+00:00",
        confirmed_entry_ids: [],
      });
    }

    const result = await replan(planned, day);

    assertEquals(result.status, "ok");
    const notes = (payloadOf(result) as { notes: string[] }).notes;
    assert(notes.some((note) => note.includes("could not be rewritten")));
  },
);

Deno.test(
  "a ranking that comes back empty uses the whole kitchen and says the wishes were not kept",
  async () => {
    const planned = await plannedWeek([ranking, { ranking: [] }]);

    const result = await replan(planned, freeDay(planned.stub.tables), "something light");

    assertEquals(result.status, "ok");
    assertEquals(
      (payloadOf(result) as { wishes_not_fully_kept?: boolean }).wishes_not_fully_kept,
      true,
    );
  },
);
