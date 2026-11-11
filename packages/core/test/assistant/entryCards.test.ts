import { describe, expect, it } from "vitest";

import { loggedCard } from "./cardFixtures";
import {
  assistantCardSchema,
  withActionIds,
  cardEntryOfRow,
  buildDeletedCard,
  buildLoggedCard,
  buildUpdatedCard,
  confirmDeleteButtons,
  confirmDeleteDayWord,
  confirmDeleteQuestion,
} from "../../src/assistant";
import { buildLogEntry, buildQuickEntry } from "../../src/diary";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { CardEntry } from "../../src/assistant";

const London = "Europe/London";

function mustEntry(row: unknown, timeZone: string): CardEntry {
  const entry = cardEntryOfRow(row, timeZone);
  if (entry === null) {
    throw new Error("The fixture row is not an entry");
  }
  return entry;
}
const actionIds: [string, ...string[]] = [
  "00000000-0000-4000-8000-0000000000d1",
  "00000000-0000-4000-8000-0000000000d2",
];
// 08:10 on 3 November 2026 is GMT, so the instant and the clock time are the same.
const timing = (clock: string) => ({
  loggedAt: `2026-11-03T${clock}:00.000Z`,
  localDate: "2026-11-03",
});

const egg = buildFood({
  id: "00000000-0000-4000-8000-0000000000a1",
  name: "Egg, boiled",
  kcal: 144,
  protein_g: 12.6,
  carbs_g: 0.8,
  fat_g: 9.5,
});
const largeEgg = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000b1",
  label: "large egg",
  grams: 50,
});
const toast = buildFood({
  id: "00000000-0000-4000-8000-0000000000a2",
  name: "Toast, white bread",
  kcal: 293.3333,
  protein_g: 9.3333,
  carbs_g: 54.6667,
  fat_g: 3,
});
const slice = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000b2",
  label: "slice",
  grams: 30,
});

// A stored row: the insert fields with the columns the database adds.
const stored = (id: string, insert: object) => ({
  id,
  created_at: "2026-11-03T08:11:00+00:00",
  kcal: 1,
  ...insert,
});

const twoEggs = (): CardEntry => {
  const row = stored(
    "00000000-0000-4000-8000-0000000000c1",
    buildLogEntry({
      food: egg,
      quantity: 2,
      unit: "portion",
      portion: largeEgg,
      ...timing("08:10"),
    }),
  );
  return mustEntry(row, London);
};
const oneSlice = (): CardEntry => {
  const row = stored(
    "00000000-0000-4000-8000-0000000000c2",
    buildLogEntry({
      food: toast,
      quantity: 1,
      unit: "portion",
      portion: slice,
      ...timing("08:10"),
    }),
  );
  return mustEntry(row, London);
};

describe("buildLoggedCard", () => {
  it("should build the board's card for two eggs and toast at 08:10 from the rows that were written", () => {
    const card = withActionIds(buildLoggedCard([twoEggs(), oneSlice()]), actionIds);

    expect(assistantCardSchema.parse(card)).toEqual({ ...loggedCard, undo: "available" });
  });

  it("should word a single food by its name and a quantity in grams without a count", () => {
    const rice = buildFood({
      id: "00000000-0000-4000-8000-0000000000a3",
      name: "White rice, boiled",
      kcal: 138,
    });
    const row = stored(
      "00000000-0000-4000-8000-0000000000c3",
      buildLogEntry({ food: rice, quantity: 200, unit: "g", ...timing("13:00") }),
    );

    const card = buildLoggedCard([mustEntry(row, London)]);

    expect(card.title).toBe("Logged white rice at 13:00");
    expect(card.rows[0]).toMatchObject({
      amountText: "200 g",
      time: "13:00",
      kcalText: "276 kcal",
    });
    expect(card.undoneSub).toBe("Removed white rice from 13:00");
  });

  it("should mark every row an estimate when the amount was estimated, and no row otherwise", () => {
    const rice = buildFood({
      id: "00000000-0000-4000-8000-0000000000a3",
      name: "White rice, boiled",
      kcal: 138,
    });
    const row = stored(
      "00000000-0000-4000-8000-0000000000c3",
      buildLogEntry({ food: rice, quantity: 180, unit: "g", ...timing("13:00") }),
    );
    const entries = [mustEntry(row, London)];

    expect(buildLoggedCard(entries, { estimated: true }).rows[0]?.estimate).toBe(true);
    expect(buildLoggedCard(entries, { estimated: false }).rows[0]?.estimate).toBe(false);
    expect(buildLoggedCard(entries).rows[0]?.estimate).toBe(false);
  });

  it.each([
    ["Bucket", 1, "1 Bucket"],
    ["Bucket", 2, "2 Buckets"],
    ["1 bucket", 1, "1 bucket"],
    ["1 bucket", 2, "2 × 1 bucket"],
  ])(
    "should word a count of the portion '%s' with no size when the food is per portion",
    (label, quantity, expected) => {
      const bucket = buildFood({
        id: "00000000-0000-4000-8000-0000000000a9",
        source: "restaurant",
        name: "Bargain bucket",
        basis: "per_portion",
        kcal: 500,
      });
      const row = stored(
        "00000000-0000-4000-8000-0000000000c9",
        buildLogEntry({
          food: bucket,
          quantity,
          unit: "portion",
          portion: buildFoodPortion({ label, grams: null, ml: null }),
          ...timing("13:00"),
        }),
      );

      expect(buildLoggedCard([mustEntry(row, London)]).rows[0]?.amountText).toBe(expected);
    },
  );

  it("should leave the time out of the title when the entries are at different times", () => {
    const later = mustEntry(
      stored(
        "00000000-0000-4000-8000-0000000000c4",
        buildLogEntry({
          food: toast,
          quantity: 1,
          unit: "portion",
          portion: slice,
          ...timing("09:00"),
        }),
      ),
      London,
    );

    expect(withActionIds(buildLoggedCard([twoEggs(), later]), actionIds).title).toBe(
      "Logged 2 eggs and toast",
    );
  });

  it("should word a quick add by its label and total only what is known", () => {
    const row = stored(
      "00000000-0000-4000-8000-0000000000c5",
      buildQuickEntry({ kcal: 300, label: "Flat white", ...timing("07:30") }),
    );

    const card = buildLoggedCard([mustEntry(row, London)]);

    expect(card.title).toBe("Logged flat white at 07:30");
    expect(card.totalText).toBe("300 kcal");
  });

  it("should read the time in the person's zone", () => {
    const summer = mustEntry(
      stored(
        "00000000-0000-4000-8000-0000000000c6",
        buildQuickEntry({
          kcal: 100,
          loggedAt: "2026-07-03T07:10:00.000Z",
          localDate: "2026-07-03",
        }),
      ),
      London,
    );

    expect(summer.clockTime).toBe("08:10");
  });
});

describe("cardEntryOfRow", () => {
  it("should answer null for a row that is not an entry", () => {
    expect(cardEntryOfRow({ id: actionIds[0], item_type: "food" }, London)).toBeNull();
    expect(cardEntryOfRow(null, London)).toBeNull();
  });
});

describe("buildDeletedCard", () => {
  const entries = (): CardEntry[] => {
    const make = (id: string, name: string) =>
      mustEntry(
        stored(id, buildQuickEntry({ kcal: 200, label: name, ...timing("13:00") })),
        London,
      );
    return [
      make("00000000-0000-4000-8000-0000000000e1", "Chicken and rice"),
      make("00000000-0000-4000-8000-0000000000e2", "Greek yoghurt"),
      make("00000000-0000-4000-8000-0000000000e3", "apple"),
    ];
  };

  it("should title the card with the count, as the board does after a yes", () => {
    const card = withActionIds(buildDeletedCard(entries()), [actionIds[0]]);

    expect(assistantCardSchema.parse(card).title).toBe("3 entries deleted");
    expect(card.kind).toBe("deleted");
    expect(card.undo).toBe("available");
  });

  // The board reads "Chicken and rice, Greek yoghurt, apple · 13:00", with no "and" before the last name.
  // The sub keeps each stored name's case, capitalises the sentence, and joins "a, b and c".
  it("should word the sub with the stored names, which differs from the board by an and", () => {
    const card = buildDeletedCard(entries());

    expect(card.sub).toBe("Chicken and rice, Greek yoghurt and apple · 13:00");
  });

  it("should word one entry in the singular and word the undone line (not on the canvas)", () => {
    const [first] = entries();
    const card = buildDeletedCard(first === undefined ? [] : [first]);

    expect(card.title).toBe("1 entry deleted");
    expect(buildDeletedCard(entries()).undoneSub).toBe("Restored 3 entries from 13:00");
  });
});

describe("buildUpdatedCard", () => {
  it("should say Undo is off and carry the changed row (not on the canvas)", () => {
    const card = withActionIds(buildUpdatedCard([twoEggs()]), [actionIds[0]]);

    expect(assistantCardSchema.parse(card)).toMatchObject({
      kind: "updated",
      title: "Changed 2 eggs at 08:10",
      undo: "unavailable",
      undoneSub: null,
      note: "Undo is off for changes. Edit it again in the diary.",
    });
    expect(card.rows).toHaveLength(1);
  });
});

describe("confirmDelete", () => {
  it("should word the two buttons as the board does", () => {
    expect(confirmDeleteButtons(3)).toEqual({
      confirmLabel: "Delete 3 entries",
      cancelLabel: "Keep them",
    });
    expect(confirmDeleteButtons(2).confirmLabel).toBe("Delete 2 entries");
  });

  it("should offer a question in the board's shape", () => {
    const make = (id: string, name: string) =>
      mustEntry(
        stored(id, buildQuickEntry({ kcal: 200, label: name, ...timing("13:00") })),
        London,
      );
    const question = confirmDeleteQuestion(
      [
        make("00000000-0000-4000-8000-0000000000e1", "Chicken and rice"),
        make("00000000-0000-4000-8000-0000000000e2", "Greek yoghurt"),
        make("00000000-0000-4000-8000-0000000000e3", "apple"),
      ],
      "today",
    );

    expect(question).toBe(
      "Delete 3 entries at 13:00 today? Chicken and rice, Greek yoghurt and apple.",
    );
  });
});

describe("confirmDeleteDayWord", () => {
  const today = "2026-11-03";

  it("should call the person's own today today", () => {
    expect(confirmDeleteDayWord(["2026-11-03", "2026-11-03"], today)).toBe("today");
  });

  it("should call the day before it yesterday", () => {
    expect(confirmDeleteDayWord(["2026-11-02"], today)).toBe("yesterday");
  });

  it("should name any other day by its short date", () => {
    expect(confirmDeleteDayWord(["2026-10-27", "2026-10-27"], today)).toBe("on Tue 27 Oct");
  });

  it("should count the days when the entries are on several", () => {
    expect(confirmDeleteDayWord(["2026-11-03", "2026-11-02", "2026-11-03"], today)).toBe(
      "across 2 days",
    );
  });
});
