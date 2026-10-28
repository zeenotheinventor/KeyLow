import { describe, expect, it } from "vitest";

import {
  COPY_FAILED_BANNER,
  DIARY_ACTIONS,
  DIARY_LOAD_FAILED,
  DIARY_PROBLEMS,
  ENTRY_DELETED_TOAST,
  FOOD_CHANGED_BANNER,
  FOOD_DELETED_NOTICE,
  MACROS_OPTIONAL,
  NO_TARGET_BANNER,
  OFFLINE_BANNER,
  QUICK_ADD_NOTE,
  RECENT_FOODS,
  SAVE_FAILED_BANNER,
  TARGETS_NOTE,
  TARGETS_SAVED_TOAST,
  TARGET_KCAL_HELPER,
  ADDED_TOAST,
  EMPTY_DAY,
  TIME_ROW_LABEL,
  describeAddFoodAtHour,
  describeAddedFood,
  describeCopiedEntriesToToday,
  describeCopiedFromYesterday,
  describeDateInWords,
  describeEntryCaption,
  describeMacroTargetField,
  describeHourChip,
  describeLastLogged,
  describeLoggedAmount,
  describeHourGroup,
  describeMacroTotal,
  describeProgressBar,
  describeProgressStrip,
  describeTimeRowName,
  describeTimeValue,
  describeProgressTarget,
  describeProgressValue,
  describeWeekStripDay,
  WEEK_STRIP_DAY_NAMES,
  describeWeekStripName,
} from "../../src/copy";
import * as diaryCopy from "../../src/copy/diary";
import { progressBars } from "../../src/diary/rules";

import type { ProgressBar, ProgressBarKey } from "../../src/diary/rules";

describe("the diary actions", () => {
  it("should pin the labels the boards draw", () => {
    expect(DIARY_ACTIONS).toEqual({
      addFood: "Add food",
      copyYesterday: "Copy yesterday",
      copyToToday: "Copy to today",
      nothingLoggedYesterday: "Nothing logged yesterday",
      quickAdd: "Quick add",
      quickAddCaption: "Calories and macros by hand",
    });
  });
});

describe("the diary toasts", () => {
  it("should pin the fixed messages", () => {
    expect(ENTRY_DELETED_TOAST).toBe("Entry deleted");
    expect(TARGETS_SAVED_TOAST).toBe("Targets saved");
  });

  it("should say Added, as the one-tap plus and the portion picker's toast do", () => {
    expect(ADDED_TOAST).toBe("Added");
  });

  it("should say which food the plus added", () => {
    expect(describeAddedFood("Chicken breast, grilled")).toBe("Added Chicken breast, grilled");
  });

  it.each([
    [1, "Copied 1 entry from yesterday"],
    [8, "Copied 8 entries from yesterday"],
  ])("should say %i copied from yesterday", (count, expected) => {
    expect(describeCopiedFromYesterday(count)).toBe(expected);
  });

  it.each([
    [1, "Copied 1 entry to today"],
    [8, "Copied 8 entries to today"],
  ])("should say %i copied to today", (count, expected) => {
    expect(describeCopiedEntriesToToday(count)).toBe(expected);
  });
});

describe("the diary banners", () => {
  it("should pin the no target banner", () => {
    expect(NO_TARGET_BANNER).toEqual({
      title: "No target set",
      body: "Set a calorie and macro target to see what is left.",
      action: "Set target",
    });
  });

  it("should pin the offline banner", () => {
    expect(OFFLINE_BANNER).toEqual({
      title: "You're offline",
      body: "Showing your last saved diary. Changes need a connection.",
    });
  });

  it("should pin the failed save and failed copy sentences", () => {
    expect(SAVE_FAILED_BANNER).toBe("Not saved. Check your connection and try again.");
    expect(COPY_FAILED_BANNER).toBe("Not copied. Check your connection and try again.");
  });

  it("should pin the failed load state", () => {
    expect(DIARY_LOAD_FAILED).toEqual({
      title: "Couldn't load your diary",
      body: "Check your connection and try again.",
      action: "Try again",
    });
  });
});

describe("the field errors and helpers", () => {
  it("should pin the field errors", () => {
    expect(DIARY_PROBLEMS).toEqual({
      quantity: "Enter an amount above 0.",
      quickAddKcal: "Enter calories.",
      targetKcal: "Enter a target between 800 and 6,000 kcal.",
      targetKcalRequired: "Enter a calorie target.",
      targetKcalWhole: "Enter whole calories.",
    });
  });

  it("should pin the helpers", () => {
    expect(TARGET_KCAL_HELPER).toBe("Between 800 and 6,000 kcal");
    expect(MACROS_OPTIONAL).toBe("Macros are optional");
  });

  it.each([
    [131, "Macros add up to 131 kcal"],
    [0, "Macros add up to 0 kcal"],
    [2480, "Macros add up to 2,480 kcal"],
    [130.6, "Macros add up to 131 kcal"],
  ])("should total macros of %f kcal", (kcal, expected) => {
    expect(describeMacroTotal(kcal)).toBe(expected);
  });

  it("should pin the notes under the forms", () => {
    expect(TARGETS_NOTE).toBe(
      "You set these yourself for now. Later, Ki-Lo will suggest targets from your weight trend.",
    );
    expect(QUICK_ADD_NOTE).toBe(
      'Quick adds count towards the day\'s totals and show as "Quick add" in the diary.',
    );
  });
});

describe("the entry notices", () => {
  it("should pin the changed food banner", () => {
    expect(FOOD_CHANGED_BANNER).toEqual({
      title: "This food has changed since you logged it.",
      body: "Your entry keeps the values you saved.",
      action: "Update to current food data",
    });
  });

  it("should pin the deleted food notice", () => {
    expect(FOOD_DELETED_NOTICE).toBe(
      "This food has been deleted. Your entry keeps its saved values.",
    );
  });
});

describe("the recent foods", () => {
  it("should pin the heading, caption and empty state", () => {
    expect(RECENT_FOODS).toEqual({
      heading: "Recent",
      caption: "as last logged",
      empty: { title: "Nothing recent", body: "Foods you log appear here." },
    });
  });
});

const overDay = {
  totals: { kcal: 2412, protein_g: 86, carbs_g: 129, fat_g: 81 },
  targets: { kcal: 2200, protein_g: 160, carbs_g: 0, fat_g: 70 },
};

describe("the diary has no meals", () => {
  const collectStrings = (value: unknown): string[] => {
    if (typeof value === "string") {
      return [value];
    }
    if (typeof value === "object" && value !== null) {
      return Object.values(value).flatMap(collectStrings);
    }
    return [];
  };

  const sentences = [
    ...Object.values(diaryCopy).flatMap(collectStrings),
    ...[1, 8].flatMap((count) => [diaryCopy.describeCopiedEntriesToToday(count)]),
    diaryCopy.describeMacroTotal(131),
    diaryCopy.describeAddedFood("Banana"),
    ...[1, 8].map(diaryCopy.describeCopiedFromYesterday),
    diaryCopy.describeTimeValue("12:40", true),
    diaryCopy.describeTimeRowName("12:40", true),
    diaryCopy.describeAddFoodAtHour("12:00"),
    diaryCopy.describeHourChip("11:00", true),
    ...[0, 1, 2].map((count) => diaryCopy.describeHourGroup("08:00", count)),
    diaryCopy.describeWeekStripDay("2026-10-15", { isToday: true, isComplete: true }),
    diaryCopy.describeWeekStripName("2026-10-12", true),
    diaryCopy.describeWeekStripName("2026-10-12", false),
    ...progressBars(overDay.totals, overDay.targets).map(diaryCopy.describeProgressBar),
    diaryCopy.describeProgressStrip(progressBars(overDay.totals, overDay.targets)),
  ];

  it("should check a real number of sentences", () => {
    expect(sentences.length).toBeGreaterThan(30);
  });

  it.each(["Breakfast", "Lunch", "Dinner", "Snacks"])("should never say %s", (word) => {
    expect(
      sentences.filter((sentence) => sentence.toLowerCase().includes(word.toLowerCase())),
    ).toEqual([]);
  });
});

describe("the time row", () => {
  it("should label the row Time", () => {
    expect(TIME_ROW_LABEL).toBe("Time");
  });

  it("should show the clock time, or Now with it before saving", () => {
    expect(describeTimeValue("12:40", false)).toBe("12:40");
    expect(describeTimeValue("12:40", true)).toBe("Now · 12:40");
  });

  it("should name the row for a screen reader", () => {
    expect(describeTimeRowName("12:40", false)).toBe("Time, 12:40, change");
    expect(describeTimeRowName("12:40", true)).toBe("Time, now, 12:40, change");
  });
});

describe("the hours of the food log", () => {
  it("should name the plus of an hour", () => {
    expect(describeAddFoodAtHour("12:00")).toBe("Add food at 12:00");
  });

  it("should name the chip of an hour, with now for the current hour", () => {
    expect(describeHourChip("08:00", false)).toBe("08:00");
    expect(describeHourChip("11:00", true)).toBe("11:00, now");
  });

  it.each([
    ["08:00", 2, "08:00, 2 foods"],
    ["08:00", 1, "08:00, 1 food"],
    ["09:00", 0, "09:00, nothing logged"],
  ])("should name the group of hour %s with %i foods", (label, count, expected) => {
    expect(describeHourGroup(label, count)).toBe(expected);
  });
});

describe("the empty day", () => {
  it("should pin the card and its hints", () => {
    expect(EMPTY_DAY).toEqual({
      title: "Nothing logged yet",
      mobileHint: "Tap + on an hour, search, scan or quick add.",
      webHint: "Search, scan or quick add, or copy yesterday.",
    });
  });
});

describe("the week strip", () => {
  it.each([
    ["2026-10-15", { isToday: true, isComplete: false }, "Thursday 15 October, today"],
    ["2026-10-13", { isToday: false, isComplete: true }, "Tuesday 13 October, complete"],
    ["2026-10-14", { isToday: false, isComplete: false }, "Wednesday 14 October"],
    ["2026-10-15", { isToday: true, isComplete: true }, "Thursday 15 October, today, complete"],
    ["2026-11-01", { isToday: false, isComplete: false }, "Sunday 1 November"],
  ])(
    "should name the day %s, leaving selection to the control's own state",
    (localDate, state, expected) => {
      expect(describeWeekStripDay(localDate, state)).toBe(expected);
    },
  );

  it("should name the days Mo to Su, Monday first", () => {
    expect(WEEK_STRIP_DAY_NAMES).toEqual(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);
  });

  it("should name the strip This week, or Week of the Monday", () => {
    expect(describeWeekStripName("2026-10-12", true)).toBe("This week");
    expect(describeWeekStripName("2026-10-12", false)).toBe("Week of Mon 12 October");
    expect(describeWeekStripName("2026-10-05", false)).toBe("Week of Mon 5 October");
  });
});

describe("the progress strip", () => {
  const targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };
  const sampleDay = { kcal: 1039, protein_g: 86, carbs_g: 129, fat_g: 19 };

  const barOf = (
    key: ProgressBarKey,
    totals: typeof sampleDay,
    barTargets: Parameters<typeof progressBars>[1],
    plate?: Parameters<typeof progressBars>[2],
  ): ProgressBar => {
    const bar = progressBars(totals, barTargets, plate).find((candidate) => candidate.key === key);
    if (bar === undefined) {
      throw new Error(`No ${key} bar`);
    }
    return bar;
  };

  it("should write the target after the value as a slash and the target, in each bar's own format", () => {
    expect(describeProgressTarget(barOf("calories", sampleDay, targets))).toBe("/ 2,200");
    expect(describeProgressTarget(barOf("protein", sampleDay, targets))).toBe("/ 160");
    expect(
      describeProgressTarget(
        barOf("fat", { ...sampleDay, fat_g: 4.5 }, { ...targets, fat_g: 7.5 }),
      ),
    ).toBe("/ 7.5");
  });

  it("should write only the unit when there is no target", () => {
    const noTargets = { kcal: null, protein_g: null, carbs_g: null, fat_g: null };

    expect(describeProgressTarget(barOf("calories", sampleDay, noTargets))).toBe("kcal");
    expect(describeProgressTarget(barOf("carbs", sampleDay, noTargets))).toBe("g");
  });

  it("should say the calories as kilocalories", () => {
    expect(describeProgressBar(barOf("calories", sampleDay, targets))).toBe(
      "Calories: 1,039 of 2,200 kilocalories",
    );
  });

  it("should name the carbs Carbohydrate, as the board does", () => {
    expect(describeProgressBar(barOf("carbs", sampleDay, targets))).toBe(
      "Carbohydrate: 129 of 220 grams",
    );
  });

  it("should say over target, and not by how much, when the bar is over", () => {
    const bar = barOf("calories", { ...sampleDay, kcal: 2412 }, targets);

    expect(describeProgressBar(bar)).toBe("Calories: 2,412 of 2,200 kilocalories, over target");
  });

  it("should say only what was eaten when there is no target", () => {
    const noTargets = { ...targets, kcal: null, protein_g: 0 };

    expect(describeProgressBar(barOf("calories", sampleDay, noTargets))).toBe(
      "Calories: 1,039 kilocalories",
    );
    expect(describeProgressBar(barOf("protein", sampleDay, noTargets))).toBe("Protein: 86 grams");
  });

  it("should round grams the way the strip shows them", () => {
    const bar = barOf("protein", { ...sampleDay, protein_g: 4.46 }, targets);

    expect(describeProgressBar(bar)).toBe("Protein: 4.5 of 160 grams");
  });

  describe("with the plate", () => {
    const eatenToday = { kcal: 1039, protein_g: 86, carbs_g: 129.1, fat_g: 19 };
    const severalOnPlate = { kcal: 658, protein_g: 57, carbs_g: 79, fat_g: 12 };
    const overOnPlate = { kcal: 1241, protein_g: 69.1, carbs_g: 180.8, fat_g: 25.8 };
    const noTargets = { kcal: null, protein_g: null, carbs_g: null, fat_g: null };
    const emptyPlate = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

    it("should say what is on the plate after the amount, with eaten plus the plate as the amount", () => {
      expect(describeProgressBar(barOf("calories", eatenToday, targets, severalOnPlate))).toBe(
        "Calories: 1,697 of 2,200 kilocalories, 658 on your plate",
      );
      expect(describeProgressBar(barOf("protein", eatenToday, targets, severalOnPlate))).toBe(
        "Protein: 143 of 160 grams, 57 on your plate",
      );
    });

    it("should say on your plate before over target", () => {
      expect(describeProgressBar(barOf("calories", eatenToday, targets, overOnPlate))).toBe(
        "Calories: 2,280 of 2,200 kilocalories, 1,241 on your plate, over target",
      );
      expect(describeProgressBar(barOf("protein", eatenToday, targets, overOnPlate))).toBe(
        "Protein: 155 of 160 grams, 69 on your plate",
      );
    });

    it("should say the amount with no target as eaten plus the plate", () => {
      expect(describeProgressBar(barOf("calories", eatenToday, noTargets, severalOnPlate))).toBe(
        "Calories: 1,697 kilocalories, 658 on your plate",
      );
    });

    it("should say nothing about the plate when the plate is empty", () => {
      expect(progressBars(eatenToday, targets, emptyPlate).map(describeProgressBar)).toEqual(
        progressBars(eatenToday, targets).map(describeProgressBar),
      );
    });

    it("should name the strip with the label it is given, then the four values", () => {
      const bars = progressBars(eatenToday, targets, severalOnPlate);

      expect(describeProgressStrip(bars, "Today with your plate")).toBe(
        "Today with your plate. Calories: 1,697 of 2,200 kilocalories, 658 on your plate. Protein: 143 of 160 grams, 57 on your plate. Carbohydrate: 208 of 220 grams, 79 on your plate. Fat: 31 of 70 grams, 12 on your plate",
      );
      expect(describeProgressStrip(progressBars(eatenToday, targets), "Today")).toMatch(
        /^Today\. Calories: 1,039 of 2,200 kilocalories\. /,
      );
    });

    it("should write eaten plus the plate as the column value", () => {
      expect(describeProgressValue(barOf("calories", eatenToday, targets, severalOnPlate))).toBe(
        "1,697",
      );
      expect(describeProgressValue(barOf("carbs", eatenToday, targets, severalOnPlate))).toBe(
        "208",
      );
      expect(describeProgressValue(barOf("calories", eatenToday, targets))).toBe("1,039");
    });
  });

  it("should name the strip Targets, then the four values in order", () => {
    expect(describeProgressStrip(progressBars(sampleDay, targets))).toBe(
      "Targets. Calories: 1,039 of 2,200 kilocalories. Protein: 86 of 160 grams. Carbohydrate: 129 of 220 grams. Fat: 19 of 70 grams",
    );
  });
});

describe("describeLoggedAmount and describeEntryCaption", () => {
  const none = { portion: null };

  it.each([
    [{ unit: "g", quantity: 50, resolvedGrams: 50, ...none }, "50 g"],
    [{ unit: "ml", quantity: 200, resolvedGrams: 206, ...none }, "200 ml"],
    [{ unit: "oz", quantity: 2, resolvedGrams: 56.7, ...none }, "2 oz"],
    [{ unit: "fl_oz", quantity: 6.5, resolvedGrams: 192, ...none }, "6.5 fl oz"],
    [{ unit: "g", quantity: 12.34, resolvedGrams: 12.34, ...none }, "12 g"],
  ] as const)("should write a measured amount as the number and the unit, %#", (amount, text) => {
    expect(describeLoggedAmount(amount)).toBe(text);
  });

  it("should write one portion as its label and the grams it came to", () => {
    expect(
      describeLoggedAmount({
        unit: "portion",
        quantity: 1,
        resolvedGrams: 100,
        portion: { label: "1 medium" },
      }),
    ).toBe("1 medium (100 g)");
  });

  it("should not write the size twice when the label already says it", () => {
    expect(
      describeLoggedAmount({
        unit: "portion",
        quantity: 1,
        resolvedGrams: 30,
        portion: { label: "30 g" },
      }),
    ).toBe("30 g");
  });

  it("should keep the size of several portions of a label that says one portion's size", () => {
    expect(
      describeLoggedAmount({
        unit: "portion",
        quantity: 2,
        resolvedGrams: 60,
        portion: { label: "30 g" },
      }),
    ).toBe("2 × 30 g (60 g)");
  });

  it("should write several portions as the count, a times sign, the label and the total grams", () => {
    expect(
      describeLoggedAmount({
        unit: "portion",
        quantity: 2,
        resolvedGrams: 340,
        portion: { label: "1 pot" },
      }),
    ).toBe("2 × 1 pot (340 g)");
  });

  describe("a spoon entry", () => {
    const tablespoon = { label: "1 tbsp", ml: 15 };

    it.each([
      [2, 27.6, "2 tbsp (30 ml)"],
      [1, 13.8, "1 tbsp (15 ml)"],
      [0.5, 6.9, "0.5 tbsp (7.5 ml)"],
    ])(
      "should write %s of the tablespoon as the count and its volume only",
      (quantity, grams, text) => {
        expect(
          describeLoggedAmount({
            unit: "portion",
            quantity,
            resolvedGrams: grams,
            portion: tablespoon,
          }),
        ).toBe(text);
      },
    );

    it.each([
      [1, 240, "1 cup (240 ml)"],
      [2, 480, "2 cups (480 ml)"],
      [0.5, 120, "0.5 cups (120 ml)"],
    ])("should write %s of the cup with a plural for any count but 1", (quantity, ml, text) => {
      expect(
        describeLoggedAmount({
          unit: "portion",
          quantity,
          resolvedGrams: ml,
          portion: { label: "1 cup", ml: 240 },
        }),
      ).toBe(text);
    });

    it("should write a teaspoon the same way", () => {
      expect(
        describeLoggedAmount({
          unit: "portion",
          quantity: 3,
          resolvedGrams: 13.8,
          portion: { label: "1 tsp", ml: 5 },
        }),
      ).toBe("3 tsp (15 ml)");
    });

    it("should read the same through the last logged line", () => {
      const amount = describeLoggedAmount({
        unit: "portion",
        quantity: 2,
        resolvedGrams: 27.6,
        portion: tablespoon,
      });

      expect(describeLastLogged(amount, 1, "Wed 14 Oct")).toBe(
        "Last logged 2 tbsp (30 ml), yesterday",
      );
    });

    it("should leave a gram portion that shares a spoon's label as grams", () => {
      expect(
        describeLoggedAmount({
          unit: "portion",
          quantity: 2,
          resolvedGrams: 28,
          portion: { label: "1 tbsp", grams: 14 },
        }),
      ).toBe("2 × 1 tbsp (28 g)");
    });

    it("should leave a millilitre portion that is not a spoon as it is", () => {
      expect(
        describeLoggedAmount({
          unit: "portion",
          quantity: 1,
          resolvedGrams: 206,
          portion: { label: "1 glass", ml: 200 },
        }),
      ).toBe("1 glass (206 g)");
    });

    it("should leave a spoon-labelled millilitre portion of another size as it is", () => {
      expect(
        describeLoggedAmount({
          unit: "portion",
          quantity: 1,
          resolvedGrams: 12,
          portion: { label: "1 tbsp", ml: 12 },
        }),
      ).toBe("1 tbsp (12 g)");
    });

    it("should still compile and read for a caller that gives the label alone", () => {
      expect(
        describeLoggedAmount({
          unit: "portion",
          quantity: 1,
          resolvedGrams: 100,
          portion: { label: "1 medium" },
        }),
      ).toBe("1 medium (100 g)");
    });
  });

  it("should write a quick add as Quick add", () => {
    expect(describeLoggedAmount(null)).toBe("Quick add");
  });

  it("should join the time and the amount with a middle dot", () => {
    expect(describeEntryCaption("08:05", "50 g")).toBe("08:05 · 50 g");
  });
});

describe("the Targets screen's copy", () => {
  it("should name a macro field by the macro and its unit", () => {
    expect(describeMacroTargetField("Protein")).toBe("Protein target in grams");
  });

  it("should ask for calories when they are blank, and for a range when they are out of it", () => {
    expect(DIARY_PROBLEMS.targetKcalRequired).toBe("Enter a calorie target.");
    expect(DIARY_PROBLEMS.targetKcal).toBe("Enter a target between 800 and 6,000 kcal.");
  });
});

describe("describeDateInWords", () => {
  it("should write the weekday, the day and the month, as the dashboard's eyebrow does", () => {
    expect(describeDateInWords("2026-10-15")).toBe("Thursday 15 October");
  });

  it("should write the day without a leading zero", () => {
    expect(describeDateInWords("2026-03-01")).toBe("Sunday 1 March");
  });
});
