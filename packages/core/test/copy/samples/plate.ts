import * as copy from "../../../src/copy";

// Every function `src/copy/plate.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeFoodCount: () => [copy.describeFoodCount(1), copy.describeFoodCount(4)],
  describeLogPlateAction: () => [copy.describeLogPlateAction(1), copy.describeLogPlateAction(4)],
  describeLogPlateActionName: () => [
    copy.describeLogPlateActionName(1),
    copy.describeLogPlateActionName(4),
  ],
  describePlateChipName: () => [copy.describePlateChipName(1), copy.describePlateChipName(4)],
  describeAddToPlateName: () => [copy.describeAddToPlateName("Banana", "1 medium (100 g)")],
  describeAddedToPlate: () => [copy.describeAddedToPlate("Banana")],
  describePlateDay: () => [copy.describePlateDay("Today"), copy.describePlateDay("Wed 14 Oct")],
  describeStripDay: () => [
    copy.describeStripDay("Today", false),
    copy.describeStripDay("Today", true),
  ],
  describePlateRowOpenName: () => [
    copy.describePlateRowOpenName("Chicken and rice", "1", "serving", "374"),
  ],
  describeRemoveFromPlate: () => [copy.describeRemoveFromPlate("Banana")],
  describePlateAmountField: () => [copy.describePlateAmountField("Banana", "medium")],
  describeDiscardPlateBody: () => [
    copy.describeDiscardPlateBody(1),
    copy.describeDiscardPlateBody(4),
  ],
  describeLoggedPlate: () => [
    copy.describeLoggedPlate(["Banana"]),
    copy.describeLoggedPlate(["Banana", "Milk", "Oats", "Egg"]),
  ],
};
