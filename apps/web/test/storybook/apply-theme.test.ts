import { describe, expect, it } from "vitest";

import { applyTheme } from "../../.storybook/applyTheme";

describe("applyTheme", () => {
  it("should set data-theme to light when the toolbar says light", () => {
    const root = document.createElement("html");

    applyTheme(root, "light");

    expect(root.getAttribute("data-theme")).toBe("light");
  });

  it("should set data-theme to dark when the toolbar says dark", () => {
    const root = document.createElement("html");
    root.setAttribute("data-theme", "light");

    applyTheme(root, "dark");

    expect(root.getAttribute("data-theme")).toBe("dark");
  });

  it("should fall back to dark when the toolbar has no value yet", () => {
    const root = document.createElement("html");

    applyTheme(root, undefined);

    expect(root.getAttribute("data-theme")).toBe("dark");
  });
});
