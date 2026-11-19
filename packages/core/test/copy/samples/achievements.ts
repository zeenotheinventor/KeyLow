import * as copy from "../../../src/copy";

// The sentences each function of the achievements copy can print, for the voice test's sweep.
export const samples: Record<string, () => string[]> = {
  levelNameFor: () => [copy.levelNameFor(0), copy.levelNameFor(6), copy.levelNameFor(26)],
  unlockNotification: () => {
    const single = copy.unlockNotification({
      badgeIds: ["hat-trick"],
      points: 10,
      freezes: 1,
      reachedLevelName: "Sapling",
    });
    const several = copy.unlockNotification({
      badgeIds: ["hat-trick", "notebook", "bullseye"],
      points: 30,
      freezes: 3,
      reachedLevelName: null,
    });
    return [single.title, single.body, several.title, several.body];
  },
  levelUpNotification: () => {
    const alone = copy.levelUpNotification({ level: 6, levelName: "Sapling", freezes: 0 });
    const withFreezes = copy.levelUpNotification({ level: 6, levelName: "Sapling", freezes: 2 });
    return [alone.title, alone.body, withFreezes.title, withFreezes.body];
  },
};
