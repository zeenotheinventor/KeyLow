import { describe, expect, it } from "vitest";

import { canvasSets, m2CanvasSet, widgetsCanvasSet } from "../src/canvasSets.ts";

describe("canvasSets", () => {
  it("should keep the M2 canvas in source, with the token stylesheets and the Main board name", () => {
    expect(m2CanvasSet).toEqual({ sourceFolder: "source", linksTokens: true });
  });

  it("should keep the widgets canvas in its own folder, without the token stylesheets", () => {
    expect(widgetsCanvasSet.sourceFolder).toBe("source-widgets");
    expect(widgetsCanvasSet.linksTokens).toBe(false);
  });

  it("should name boards A, B and C and leave out board D until it is approved", () => {
    expect(widgetsCanvasSet.boardNames).toEqual({
      "Main.dc.html": { slug: "widgets", state: "dashboard" },
      "QuickLog.dc.html": { slug: "widgets", state: "quick-log" },
      "LockScreen.dc.html": { slug: "widgets", state: "lock-screen" },
    });
  });

  it("should list each canvas folder once", () => {
    expect(canvasSets.map((set) => set.sourceFolder)).toEqual(["source", "source-widgets"]);
  });
});
