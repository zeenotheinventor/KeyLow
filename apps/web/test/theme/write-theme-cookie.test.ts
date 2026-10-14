import { beforeEach, describe, expect, it, vi } from "vitest";

import { writeThemeCookie } from "@/lib/theme/actions";

const { set } = vi.hoisted(() => ({ set: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ set }),
}));

describe("writeThemeCookie", () => {
  beforeEach(() => {
    set.mockReset();
  });

  it("should write the theme to the kl-theme cookie for the whole site", async () => {
    await writeThemeCookie("light");

    expect(set).toHaveBeenCalledWith(
      "kl-theme",
      "light",
      expect.objectContaining({ path: "/", sameSite: "lax" }),
    );
  });

  it("should write device, so the page follows the system setting", async () => {
    await writeThemeCookie("device");

    expect(set).toHaveBeenCalledWith("kl-theme", "device", expect.objectContaining({ path: "/" }));
  });

  it("should keep the cookie for a year, so the choice outlives the session", async () => {
    await writeThemeCookie("dark");

    expect(set).toHaveBeenCalledWith(
      "kl-theme",
      "dark",
      expect.objectContaining({ maxAge: 60 * 60 * 24 * 365 }),
    );
  });

  it("should refuse a theme it does not know and write nothing", async () => {
    await expect(writeThemeCookie("sepia")).rejects.toThrow(/theme/i);

    expect(set).not.toHaveBeenCalled();
  });
});
