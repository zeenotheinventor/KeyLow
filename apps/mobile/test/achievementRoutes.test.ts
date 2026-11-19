import { achievementPath, achievementsPath } from "../lib/achievementRoutes";

describe("achievementsPath", () => {
  it("should be the Achievements screen inside the More tab", () => {
    expect(achievementsPath()).toBe("/more/achievements");
  });
});

describe("achievementPath", () => {
  it("should be the badge detail sheet of one badge", () => {
    expect(achievementPath("hat-trick")).toBe("/more/achievements/hat-trick");
  });
});
