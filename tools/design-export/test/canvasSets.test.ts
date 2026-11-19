import { describe, expect, it } from "vitest";

import {
  achievementsCanvasSet,
  canvasSets,
  m2CanvasSet,
  widgetsCanvasSet,
} from "../src/canvasSets.ts";

describe("canvasSets", () => {
  it("should keep the M2 canvas in source, with the token stylesheets", () => {
    expect(m2CanvasSet).toEqual({ sourceFolder: "source", linksTokens: true });
  });

  it("should keep the widgets canvas in its own folder, without the token stylesheets", () => {
    expect(widgetsCanvasSet.sourceFolder).toBe("source-widgets");
    expect(widgetsCanvasSet.linksTokens).toBe(false);
  });

  it("should name boards A, B, C and D", () => {
    expect(widgetsCanvasSet.boardNames).toEqual({
      "Main.dc.html": { slug: "widgets", state: "dashboard" },
      "QuickLog.dc.html": { slug: "widgets", state: "quick-log" },
      "LockScreen.dc.html": { slug: "widgets", state: "lock-screen" },
      "States.dc.html": { slug: "widgets", state: "states" },
    });
  });

  it("should keep the achievements canvas in its own folder, with the token stylesheet and no proposals", () => {
    expect(achievementsCanvasSet.sourceFolder).toBe("source-achievements");
    expect(achievementsCanvasSet.linksTokens).toBe(true);
    expect(achievementsCanvasSet.linksProposals).toBe(false);
  });

  it("should serve both canvas stylesheets of the achievements boards from packages/tokens", () => {
    expect(achievementsCanvasSet.tokenBlobs).toEqual([
      "/_blob/2fe51da7acf9d6abcc3277b8f18ab330",
      "/_blob/4dca4da7a7878d551adca2cea33f5974",
    ]);
  });

  it("should name the nine achievements boards", () => {
    expect(achievementsCanvasSet.boardNames).toEqual({
      "Main.dc.html": { slug: "achievements", state: "screen" },
      "BadgeDetail.dc.html": { slug: "achievements", state: "badge-detail" },
      "Celebrations.dc.html": { slug: "achievements", state: "celebrations" },
      "Streaks.dc.html": { slug: "achievements", state: "streaks" },
      "DayComplete.dc.html": { slug: "achievements", state: "day-complete" },
      "Reminders.dc.html": { slug: "achievements", state: "reminders-switches" },
      "WebPage.dc.html": { slug: "achievements", state: "web-page" },
      "BadgeArt.dc.html": { slug: "achievements", state: "badge-art" },
      "BadgeCatalogue.dc.html": { slug: "achievements", state: "badge-catalogue" },
    });
  });

  it("should list each canvas folder once", () => {
    expect(canvasSets.map((set) => set.sourceFolder)).toEqual([
      "source",
      "source-widgets",
      "source-achievements",
    ]);
  });
});
