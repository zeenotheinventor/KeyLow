import { describe, expect, it } from "vitest";

import {
  DIARY_PROBLEMS,
  LOG_SEARCH,
  OFFLINE_BANNER,
  PLATE,
  describeAddToPlateName,
  describeAddedToPlate,
  describeDiscardPlateBody,
  describeFoodCount,
  describeLogPlateAction,
  describeLogPlateActionName,
  describeLoggedPlate,
  describePlateAmountField,
  describePlateChipName,
  describePlateDay,
  describePlateRowOpenName,
  describeRemoveFromPlate,
  describeStripDay,
} from "../../src/copy";
import { describeDay } from "../../src/dates";

describe("the plate's words", () => {
  it("should be the words of the boards", () => {
    expect(PLATE).toEqual({
      title: "Your plate",
      clear: "Clear plate",
      recipe: "Recipe",
      onYourPlate: "On your plate",
      addToPlate: "Add to plate",
      cleared: "Plate cleared",
      notLogged: "Not logged. Check your connection and try again.",
      offlineBody: "You can fill your plate. Logging it needs a connection.",
      discard: {
        title: "Discard your plate?",
        confirmLabel: "Discard",
        cancelLabel: "Keep adding",
      },
    });
  });

  it("should leave the offline banner's title as it is", () => {
    expect(OFFLINE_BANNER.title).toBe("You're offline");
  });

  it("should reuse Undo and the amount message rather than say them again", () => {
    expect(LOG_SEARCH.undo).toBe("Undo");
    expect(DIARY_PROBLEMS.quantity).toBe("Enter an amount above 0.");
    expect(Object.values(PLATE)).not.toContain("Undo");
  });
});

describe("describeFoodCount", () => {
  it("should say 1 food and n foods", () => {
    expect(describeFoodCount(1)).toBe("1 food");
    expect(describeFoodCount(2)).toBe("2 foods");
    expect(describeFoodCount(4)).toBe("4 foods");
  });
});

describe("describeLogPlateAction", () => {
  it("should say Log food for one food and Log foods for two or more", () => {
    expect(describeLogPlateAction(1)).toBe("Log food");
    expect(describeLogPlateAction(2)).toBe("Log foods");
    expect(describeLogPlateAction(4)).toBe("Log foods");
  });

  it("should name the button with the count on the plate", () => {
    expect(describeLogPlateActionName(1)).toBe("Log food, 1 food on your plate");
    expect(describeLogPlateActionName(4)).toBe("Log foods, 4 foods on your plate");
  });
});

describe("describePlateChipName", () => {
  it("should name the chip with the count", () => {
    expect(describePlateChipName(1)).toBe("Your plate, 1 food");
    expect(describePlateChipName(4)).toBe("Your plate, 4 foods");
  });
});

describe("the plus's words", () => {
  it("should name the plus with the food and the serving", () => {
    expect(describeAddToPlateName("Greek yoghurt 0% fat", "1 pot (170 g)")).toBe(
      "Add Greek yoghurt 0% fat, 1 pot (170 g), to your plate",
    );
  });

  it("should announce the add", () => {
    expect(describeAddedToPlate("Chicken and rice")).toBe("Chicken and rice added to your plate");
  });
});

describe("describePlateDay and describeStripDay", () => {
  const timeZone = "Europe/London";
  const today = new Date("2026-10-25T19:20:00Z");
  const labelOf = (iso: string) => describeDay(new Date(iso), today, timeZone).label;

  it("should say Today with your plate for today", () => {
    expect(describePlateDay(labelOf("2026-10-25T12:00:00Z"))).toBe("Today with your plate");
  });

  it("should say the day's title for another day", () => {
    expect(describePlateDay(labelOf("2026-10-24T12:00:00Z"))).toBe("Yesterday with your plate");
    expect(describePlateDay(labelOf("2026-10-14T12:00:00Z"))).toBe("Wed 14 Oct with your plate");
  });

  it("should lead the strip's name with the day alone while the plate is empty", () => {
    expect(describeStripDay("Today", false)).toBe("Today");
    expect(describeStripDay("Today", true)).toBe("Today with your plate");
    expect(describeStripDay("Wed 14 Oct", true)).toBe("Wed 14 Oct with your plate");
  });
});

describe("the plate row's words", () => {
  it("should name the remove button", () => {
    expect(describeRemoveFromPlate("Chicken and rice")).toBe(
      "Remove Chicken and rice from your plate",
    );
  });

  it("should name the amount field with the plural unit word", () => {
    expect(describePlateAmountField("Chicken and rice", "servings")).toBe(
      "Amount of Chicken and rice, servings",
    );
    expect(describePlateAmountField("Greek yoghurt 0% fat", "pots")).toBe(
      "Amount of Greek yoghurt 0% fat, pots",
    );
    expect(describePlateAmountField("Semi-skimmed milk", "ml")).toBe(
      "Amount of Semi-skimmed milk, ml",
    );
  });
});

describe("describePlateRowOpenName", () => {
  it("should name the row with the food, the amount, the energy and what pressing it does", () => {
    expect(describePlateRowOpenName("Chicken and rice", "1", "serving", "374")).toBe(
      "Chicken and rice, 1 serving, 374 kilocalories, change amount or unit",
    );
    expect(describePlateRowOpenName("Semi-skimmed milk", "200", "ml", "92")).toBe(
      "Semi-skimmed milk, 200 ml, 92 kilocalories, change amount or unit",
    );
  });

  it("should say 1 kilocalorie in the singular", () => {
    expect(describePlateRowOpenName("Sweetener", "1", "tablet", "1")).toBe(
      "Sweetener, 1 tablet, 1 kilocalorie, change amount or unit",
    );
  });

  it("should leave the amount out while the field is empty", () => {
    expect(describePlateRowOpenName("Chicken and rice", "", "servings", "0")).toBe(
      "Chicken and rice, 0 kilocalories, change amount or unit",
    );
  });
});

describe("describeDiscardPlateBody", () => {
  it("should say how many foods will not be logged", () => {
    expect(describeDiscardPlateBody(1)).toBe("The 1 food on it won't be logged.");
    expect(describeDiscardPlateBody(4)).toBe("The 4 foods on it won't be logged.");
  });
});

describe("describeLoggedPlate", () => {
  it("should name the food when there is one", () => {
    expect(describeLoggedPlate(["Chicken and rice"])).toBe("Logged Chicken and rice");
  });

  it("should count the foods when there are more", () => {
    expect(describeLoggedPlate(["a", "b", "c", "d"])).toBe("Logged 4 foods");
    expect(describeLoggedPlate(["a", "b"])).toBe("Logged 2 foods");
  });
});
