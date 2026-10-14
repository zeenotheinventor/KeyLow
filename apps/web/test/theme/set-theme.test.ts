import { afterEach, describe, expect, it, vi } from "vitest";

import { writeThemeCookie } from "@/lib/theme/actions";
import { setTheme } from "@/lib/theme/setTheme";

vi.mock("@/lib/theme/actions", () => ({
  writeThemeCookie: vi.fn(() => Promise.resolve()),
}));

describe("setTheme", () => {
  afterEach(() => {
    delete document.documentElement.dataset["theme"];
    vi.clearAllMocks();
  });

  it("should switch the page to the theme straight away", async () => {
    await setTheme("light");

    expect(document.documentElement.dataset["theme"]).toBe("light");
  });

  it("should mark the page as following the device when asked to", async () => {
    await setTheme("device");

    expect(document.documentElement.dataset["theme"]).toBe("device");
  });

  it("should have the server remember the theme", async () => {
    await setTheme("light");

    expect(writeThemeCookie).toHaveBeenCalledWith("light");
  });

  it("should put the page back on its earlier theme when the server cannot remember the choice", async () => {
    document.documentElement.dataset["theme"] = "dark";
    vi.mocked(writeThemeCookie).mockRejectedValueOnce(new Error("offline"));

    await expect(setTheme("light")).rejects.toThrow("offline");

    expect(document.documentElement.dataset["theme"]).toBe("dark");
  });
});
