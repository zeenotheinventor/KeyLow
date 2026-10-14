import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MorePage from "@/app/(dashboard)/more/page";

const { getUser, signOut, themeCookie } = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
  themeCookie: vi.fn<() => string | undefined>(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser } }),
}));

vi.mock("@/app/(dashboard)/actions", () => ({ signOut }));

vi.mock("@/lib/theme/setTheme", () => ({ setTheme: vi.fn(() => Promise.resolve()) }));

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const value = name === "kl-theme" ? themeCookie() : undefined;
        return value === undefined ? undefined : { name, value };
      },
    }),
}));

async function renderPage() {
  render(await MorePage());
}

describe("More page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getUser.mockResolvedValue({ data: { user: { email: "ada@example.com" } }, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("should be titled More", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "More" })).toBeTruthy();
  });

  it("should have the four sections the board draws, in order", async () => {
    await renderPage();

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Food", "Body", "Settings", "Account"]);
  });

  it("should draw each heading as the bare line the board draws", async () => {
    await renderPage();

    for (const name of ["Food", "Body", "Settings", "Account"]) {
      expect(
        screen.getByRole("heading", { level: 2, name }).parentElement?.className,
      ).not.toContain("min-h-[32px]");
    }
  });

  it("should reach Your foods, with its subtitle, at the own foods list", async () => {
    await renderPage();

    const link = screen.getByRole("link", { name: /Your foods/ });
    expect(link.getAttribute("href")).toBe("/foods?scope=own");
    expect(link.textContent).toContain("Foods you created or copied");
  });

  it("should show Weight as coming soon and not available", async () => {
    await renderPage();

    const weight = screen.getByRole("link", { name: /Weight/ });
    expect(weight.getAttribute("aria-disabled")).toBe("true");
    expect(weight.getAttribute("href")).toBeNull();
    expect(weight.textContent).toContain("Coming soon");
  });

  it("should not link to a Settings page, because Appearance is on this page", async () => {
    await renderPage();

    expect(screen.queryByRole("link", { name: /Settings/ })).toBeNull();
  });

  it("should put the Appearance control under Settings, on dark by default", async () => {
    await renderPage();

    const settings = screen.getByRole("region", { name: "Settings" });
    expect(within(settings).getByRole("radiogroup", { name: "Appearance" })).toBeTruthy();
    expect(within(settings).getByRole("radio", { name: "Dark" })).toHaveProperty("checked", true);
  });

  it.each([
    ["light", "Light"],
    ["device", "Match device"],
  ])(
    "should select %s in the Appearance control when the cookie says so",
    async (cookie, label) => {
      themeCookie.mockReturnValue(cookie);

      await renderPage();

      expect(screen.getByRole("radio", { name: label })).toHaveProperty("checked", true);
    },
  );

  it("should show who is signed in under the Sign out button", async () => {
    await renderPage();

    expect(screen.getByRole("button", { name: /Sign out/ }).textContent).toContain(
      "ada@example.com",
    );
  });

  it("should run the sign out action when Sign out is pressed", async () => {
    await renderPage();

    screen.getByRole("button", { name: /Sign out/ }).click();

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledOnce();
    });
  });
});
