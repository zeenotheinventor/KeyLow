import * as copy from "../../../src/copy";

// The sentences each function of the celebration copy can print, for the voice test's sweep.
export const samples: Record<string, () => string[]> = {
  describeFreezeChip: () => [copy.describeFreezeChip(1), copy.describeFreezeChip(3)],
  describeLevelChip: () => [copy.describeLevelChip("Sapling")],
  describePoints: () => [copy.describePoints(10)],
  describeSingleToastTitle: () => [copy.describeSingleToastTitle("hat-trick")],
  describeSingleToastBody: () => [copy.describeSingleToastBody("hat-trick", 10)],
  describeGroupedToastTitle: () => [copy.describeGroupedToastTitle(3)],
  describeGroupedToastBody: () => [
    copy.describeGroupedToastBody(["fortnight", "notebook", "bullseye"], 45),
    copy.describeGroupedToastBody(["fortnight", "notebook", "bullseye", "hat-trick"], 55),
  ],
  describeMomentTierLabel: () => [copy.describeMomentTierLabel("gold")],
  describeMomentBody: () => [copy.describeMomentBody("month-strong")],
  describeMomentOthers: () => [copy.describeMomentOthers(1), copy.describeMomentOthers(2)],
  describeMomentLabel: () => [copy.describeMomentLabel("month-strong", "gold")],
};
