import { describe, expect, it } from "vitest";

import {
  assistantCardSchema,
  buildFoodCreatedCard,
  buildTargetsChangedCard,
  confirmTargetsButtons,
  confirmTargetsQuestion,
  describeAssistantChange,
  withActionIds,
} from "../../src/assistant";
import { describeMacrosAdjustedNote } from "../../src/copy";

const foodId = "00000000-0000-4000-8000-0000000000f1";
const actionIds: [string, ...string[]] = ["00000000-0000-4000-8000-0000000000d1"];

const proteinBar = {
  id: foodId,
  name: "My protein bar",
  portionLabel: "1 bar",
  kcal: 210,
  protein_g: 20,
  carbs_g: 19,
  fat_g: 6,
};

describe("buildFoodCreatedCard", () => {
  it("should build the board's card for My protein bar", () => {
    const draft = buildFoodCreatedCard(proteinBar);

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      actionIds,
      kind: "food_created",
      title: "Added food My protein bar",
      sub: "Yours · 1 bar",
      rows: [
        {
          name: "Per bar",
          amountText: "P 20 g · C 19 g · F 6 g",
          time: null,
          kcalText: "210 kcal",
          match: null,
          matchedFood: null,
          estimate: false,
        },
      ],
      totalText: null,
      note: "Not logged yet. Say when you had it, or log it from search.",
      link: { label: "Open in your foods", target: { screen: "own_food", foodId } },
      undo: "available",
      undoneSub: "Removed My protein bar from your foods",
    });
  });

  it("should keep a portion label that does not start with 1 whole", () => {
    const draft = buildFoodCreatedCard({ ...proteinBar, portionLabel: "2 slices" });

    expect(draft.sub).toBe("Yours · 2 slices");
    expect(draft.rows[0]?.name).toBe("Per 2 slices");
  });

  it("should word a per 100 g food with no portion", () => {
    const draft = buildFoodCreatedCard({ ...proteinBar, portionLabel: null });

    expect(draft.sub).toBe("Yours");
    expect(draft.rows[0]?.name).toBe("Per 100 g");
  });
});

describe("confirmTargetsButtons", () => {
  it("should name the number the person keeps", () => {
    expect(confirmTargetsButtons(2140)).toEqual({
      confirmLabel: "Change target",
      cancelLabel: "Keep 2,140",
    });
  });

  it("should say don't change when there is no target to keep", () => {
    expect(confirmTargetsButtons(null).cancelLabel).toBe("Don't change");
  });
});

describe("confirmTargetsQuestion", () => {
  it("should be the board's question while a programme is active", () => {
    expect(
      confirmTargetsQuestion({ currentKcal: 2140, newKcal: 2000, programmeActive: true }),
    ).toBe(
      "Change your calorie target from 2,140 to 2,000 kcal? This ends your programme and its weekly check-in. Today and later days use your own targets.",
    );
  });

  it("should leave out the programme sentence when there is none", () => {
    expect(
      confirmTargetsQuestion({ currentKcal: 1900, newKcal: 2000, programmeActive: false }),
    ).toBe("Change your calorie target from 1,900 to 2,000 kcal?");
    expect(
      confirmTargetsQuestion({ currentKcal: null, newKcal: 2000, programmeActive: false }),
    ).toBe("Set your calorie target to 2,000 kcal?");
  });
});

describe("describeMacrosAdjustedNote", () => {
  it("should name the three macros in whole grams", () => {
    expect(describeMacrosAdjustedNote({ protein_g: 118, carbs_g: 229, fat_g: 68 })).toBe(
      "Your macros will be adjusted proportionally: protein 118 g, carbs 229 g, fat 68 g.",
    );
  });

  it("should leave out a macro that is null", () => {
    expect(describeMacrosAdjustedNote({ protein_g: 118, carbs_g: null, fat_g: 68 })).toBe(
      "Your macros will be adjusted proportionally: protein 118 g, fat 68 g.",
    );
  });
});

describe("buildTargetsChangedCard", () => {
  it("should build the board's card after a programme ended", () => {
    const draft = buildTargetsChangedCard({ kcal: 2000, previousKcal: 2140, endedProgramme: true });

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      actionIds,
      kind: "targets_changed",
      title: "Changed your calorie target to 2,000 kcal",
      sub: "Was 2,140 kcal from your programme",
      rows: [],
      totalText: null,
      note: "Your programme has ended, so Ki-Lo stops adjusting your targets each week. Undo puts back 2,140 kcal and your programme.",
      link: null,
      undo: "available",
      undoneSub: "Put back 2,140 kcal and your programme",
    });
  });

  it("should have no Undo when there was no programme, because the old numbers are not kept", () => {
    const draft = buildTargetsChangedCard({
      kcal: 2000,
      previousKcal: 1900,
      endedProgramme: false,
    });

    expect(draft.sub).toBe("Was 1,900 kcal");
    expect(draft.note).toBe(
      "Undo is off for this change. Ki-Lo does not keep your old numbers, so change them again in More, Targets.",
    );
    expect(draft.undo).toBe("unavailable");
    expect(draft.undoneSub).toBeNull();
  });

  it("should keep the programme words but turn Undo off when Undo cannot work", () => {
    const draft = buildTargetsChangedCard({
      kcal: 2000,
      previousKcal: 2140,
      endedProgramme: true,
      undoable: false,
    });

    expect(draft.sub).toBe("Was 2,140 kcal from your programme");
    expect(draft.note).toBe(
      "Your programme has ended, so Ki-Lo stops adjusting your targets each week. Undo is off for this change.",
    );
    expect(draft.undo).toBe("unavailable");
    expect(draft.undoneSub).toBeNull();
  });

  it("should add no row when the macros were not adjusted", () => {
    const draft = buildTargetsChangedCard({ kcal: 2000, previousKcal: 2140, endedProgramme: true });

    expect(draft.rows).toEqual([]);
  });

  it("should add the adjusted macros as one row, drawn as food created draws its row", () => {
    const draft = buildTargetsChangedCard({
      kcal: 2000,
      previousKcal: 2140,
      endedProgramme: true,
      adjustedMacros: { protein_g: 118, carbs_g: 229, fat_g: 68 },
    });

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds)).rows).toEqual([
      {
        name: "Macros adjusted proportionally",
        amountText: "P 118 g · C 229 g · F 68 g",
        time: null,
        kcalText: null,
        match: null,
        matchedFood: null,
        estimate: false,
      },
    ]);
    expect(draft.title).toBe("Changed your calorie target to 2,000 kcal");
    expect(draft.sub).toBe("Was 2,140 kcal from your programme");
  });

  it("should leave a null macro out of the row", () => {
    const draft = buildTargetsChangedCard({
      kcal: 2000,
      previousKcal: 1900,
      endedProgramme: false,
      adjustedMacros: { protein_g: 118, carbs_g: null, fat_g: 68 },
    });

    expect(draft.rows[0]?.amountText).toBe("P 118 g · F 68 g");
  });

  it("should have no sub when no target was set before", () => {
    const draft = buildTargetsChangedCard({
      kcal: 2000,
      previousKcal: null,
      endedProgramme: false,
    });

    expect(draft.sub).toBeNull();
  });
});

describe("the changes list", () => {
  it("should word a created food by its name", () => {
    expect(
      describeAssistantChange({
        tool: "create_custom_food",
        actionCount: 1,
        targets: [{ id: foodId, row: { id: foodId, name: "My protein bar" } }],
      }),
    ).toEqual({ title: "Added food My protein bar", detail: null });
  });

  it("should word a food that is gone, or several, plainly", () => {
    expect(
      describeAssistantChange({
        tool: "create_custom_food",
        actionCount: 1,
        targets: [{ id: foodId, row: null }],
      }).title,
    ).toBe("Added a food");
    expect(
      describeAssistantChange({ tool: "create_custom_food", actionCount: 2, targets: [] }).title,
    ).toBe("Added 2 foods");
  });

  it("should word a targets change plainly", () => {
    expect(
      describeAssistantChange({ tool: "update_targets", actionCount: 1, targets: [] }).title,
    ).toBe("Changed your targets");
  });
});
