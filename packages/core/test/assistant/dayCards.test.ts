import { describe, expect, it } from "vitest";

import { dayCopiedCard } from "./cardFixtures";
import {
  assistantCardSchema,
  buildDayCompletedCard,
  buildDayCopiedCard,
  cardEntryOfRow,
  confirmCopyButtons,
  confirmCopyQuestion,
  withActionIds,
} from "../../src/assistant";
import { buildQuickEntry } from "../../src/diary";

import type { CardEntry } from "../../src/assistant";

const London = "Europe/London";

// Eight quick adds that total the board's 1,940 kcal, on Saturday 24 October 2026.
const copiedEntries = (kcals: readonly (number | null)[]): CardEntry[] =>
  kcals.flatMap((kcal, index) => {
    const entry = cardEntryOfRow(
      {
        id: `00000000-0000-4000-8000-00000000c0${String(index).padStart(2, "0")}`,
        created_at: "2026-10-25T08:00:00+00:00",
        kcal: kcal ?? 0,
        ...buildQuickEntry({
          kcal: kcal ?? 0,
          label: `Entry ${index}`,
          loggedAt: "2026-10-25T08:00:00.000Z",
          localDate: "2026-10-25",
        }),
        nutrients: {
          kcal,
          protein_g: null,
          fat_g: null,
          carbs_g: null,
          fibre_g: null,
        },
      },
      London,
    );
    return entry === null ? [] : [entry];
  });

const eight = copiedEntries([300, 250, 200, 220, 180, 260, 280, 250]);
const actionIds: [string, ...string[]] = ["00000000-0000-4000-8000-0000000000d1"];

describe("buildDayCopiedCard", () => {
  it("should build the board's card for yesterday copied to today", () => {
    const draft = buildDayCopiedCard({
      from: "2026-10-24",
      to: "2026-10-25",
      today: "2026-10-25",
      entries: eight,
    });

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      ...dayCopiedCard,
      actionIds,
    });
  });

  it("should name an earlier day by its short date and keep the long dates in the sub", () => {
    const draft = buildDayCopiedCard({
      from: "2026-10-20",
      to: "2026-10-25",
      today: "2026-10-25",
      entries: eight,
    });

    expect(draft.title).toBe("Copied 8 entries from Tue 20 Oct");
    expect(draft.sub).toBe("Tuesday 20 October to today · 1,940 kcal");
  });

  it("should name a target day that is not today, and say its Undo in the same words", () => {
    const draft = buildDayCopiedCard({
      from: "2026-10-24",
      to: "2026-10-23",
      today: "2026-10-25",
      entries: eight,
    });

    expect(draft.sub).toBe("Saturday 24 October to Friday 23 October · 1,940 kcal");
    expect(draft.undoneSub).toBe("Removed 8 copied entries from Fri 23 Oct");
  });

  it("should leave the kcal out when no copied entry has one, and count one entry in the singular", () => {
    const draft = buildDayCopiedCard({
      from: "2026-10-24",
      to: "2026-10-25",
      today: "2026-10-25",
      entries: copiedEntries([null]),
    });

    expect(draft.title).toBe("Copied 1 entry from yesterday");
    expect(draft.sub).toBe("Saturday 24 October to today");
    expect(draft.undoneSub).toBe("Removed 1 copied entry from today");
  });

  it("should total only the entries that have a figure", () => {
    const draft = buildDayCopiedCard({
      from: "2026-10-24",
      to: "2026-10-25",
      today: "2026-10-25",
      entries: copiedEntries([300, null]),
    });

    expect(draft.sub).toBe("Saturday 24 October to today · 300 kcal");
  });
});

describe("confirmCopyButtons", () => {
  it("should be the board's two buttons for eight entries", () => {
    expect(confirmCopyButtons(8)).toEqual({
      confirmLabel: "Copy 8 entries",
      cancelLabel: "Don't copy",
    });
  });

  it("should count one entry in the singular", () => {
    expect(confirmCopyButtons(1).confirmLabel).toBe("Copy 1 entry");
  });
});

describe("confirmCopyQuestion", () => {
  it("should be the board's question for yesterday copied onto a day with three entries", () => {
    expect(
      confirmCopyQuestion({
        from: "2026-10-24",
        to: "2026-10-25",
        today: "2026-10-25",
        existingCount: 3,
        copyingCount: 8,
      }),
    ).toBe("Today already has 3 entries. Add yesterday's 8 entries to them? Nothing is replaced.");
  });

  it("should name days other than yesterday and today by their short dates", () => {
    expect(
      confirmCopyQuestion({
        from: "2026-10-20",
        to: "2026-10-23",
        today: "2026-10-25",
        existingCount: 1,
        copyingCount: 2,
      }),
    ).toBe(
      "Fri 23 Oct already has 1 entry. Add the 2 entries from Tue 20 Oct to it? Nothing is replaced.",
    );
  });
});

describe("buildDayCompletedCard", () => {
  it("should use the Diary's own words for a day marked complete, with the day as the sub", () => {
    const draft = buildDayCompletedCard({ localDate: "2026-11-03", complete: true });

    expect(draft).toEqual({
      kind: "day_completed",
      title: "Day complete",
      sub: "Tuesday 3 November",
      rows: [],
      totalText: null,
      note: null,
      link: null,
      undo: "available",
      undoneSub: "Day marked incomplete",
    });
    expect(assistantCardSchema.parse(withActionIds(draft, actionIds)).title).toBe("Day complete");
  });

  it("should word a day marked incomplete, and its Undo back to complete", () => {
    const draft = buildDayCompletedCard({ localDate: "2026-11-03", complete: false });

    expect(draft.title).toBe("Day marked incomplete");
    expect(draft.sub).toBe("Tuesday 3 November");
    expect(draft.undoneSub).toBe("Day complete");
  });
});
