import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pagePaddingOf } from "./pagePadding";

import MorePage from "@/app/(dashboard)/more/page";

const { getUser, signOut, themeCookie, useTargets, useProgramSummary, useAssistantConsent } =
  vi.hoisted(() => ({
    getUser: vi.fn(),
    signOut: vi.fn(),
    themeCookie: vi.fn<() => string | undefined>(),
    useTargets: vi.fn<() => { data: { kcal: number | null } | undefined }>(),
    useProgramSummary: vi.fn<
      () => {
        data: { program: { nextCheckinDate: string | null } | null } | undefined;
        isError?: boolean;
      }
    >(),
    useAssistantConsent:
      vi.fn<
        () => { data: { isOn: boolean } | undefined; isPending?: boolean; fetchStatus?: string }
      >(),
  }));

// The Goal row reads the goal and the time zone. Its own tests are in goals/goal-row.test.tsx, so here both
// reads are paused, as they are offline, which leaves the row with no sub line.
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useTargets,
  useProgramSummary,
  useAssistantConsent,
  useTrainingGoals: () => ({ data: undefined, isPending: true, fetchStatus: "paused" }),
  useProfileTimeZone: () => ({ data: undefined, isPending: true, fetchStatus: "paused" }),
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
    useTargets.mockReturnValue({ data: { kcal: 2200 } });
    useProgramSummary.mockReturnValue({ data: undefined });
    useAssistantConsent.mockReturnValue({ data: { isOn: false } });
  });

  afterEach(() => {
    cleanup();
  });

  it("should be titled More", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "More" })).toBeTruthy();
  });

  it("should have the five sections the board draws, in order, with Nutrition between Food and Body", async () => {
    await renderPage();

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Food", "Nutrition", "Body", "Settings", "Account"]);
  });

  it("should draw each heading as the bare line the board draws", async () => {
    await renderPage();

    for (const name of ["Food", "Nutrition", "Body", "Settings", "Account"]) {
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

  describe("the Nutrition section", () => {
    it("should reach Targets, with its subtitle and the calorie target as its value", async () => {
      await renderPage();

      const link = screen.getByRole("link", { name: /Targets/ });

      expect(link.getAttribute("href")).toBe("/more/targets");
      expect(link.textContent).toBe("TargetsSet by you2,200 kcal");
    });

    it("should show no value while the target is unset or still loading", async () => {
      useTargets.mockReturnValue({ data: { kcal: null } });
      await renderPage();
      expect(screen.getByRole("link", { name: /Targets/ }).textContent).toBe("TargetsSet by you");

      cleanup();
      useTargets.mockReturnValue({ data: undefined });
      await renderPage();
      expect(screen.getByRole("link", { name: /Targets/ }).textContent).toBe("TargetsSet by you");
    });

    it("should reach the Programme page from the row under Targets, with nothing under it until the read is in", async () => {
      await renderPage();

      const link = screen.getByRole("link", { name: /Programme/ });

      expect(link.getAttribute("href")).toBe("/more/program");
      expect(link.textContent).toBe("Programme");
    });

    it("should say the next check-in under Programme while a programme runs", async () => {
      useProgramSummary.mockReturnValue({ data: { program: { nextCheckinDate: "2026-10-30" } } });
      await renderPage();

      expect(screen.getByRole("link", { name: /Programme/ }).textContent).toBe(
        "ProgrammeNext check-in Fri 30 Oct",
      );
    });

    it("should offer to let Ki-Lo set the targets under Programme when there is no programme", async () => {
      useProgramSummary.mockReturnValue({ data: { program: null } });
      await renderPage();

      expect(screen.getByRole("link", { name: /Programme/ }).textContent).toBe(
        "ProgrammeLet Ki-Lo set your targets",
      );
    });

    it("should say nothing under Programme for a programme with no check-in date yet", async () => {
      useProgramSummary.mockReturnValue({ data: { program: { nextCheckinDate: null } } });
      await renderPage();

      expect(screen.getByRole("link", { name: /Programme/ }).textContent).toBe("Programme");
    });

    it("should say nothing under Programme when the programme cannot be read", async () => {
      // A failed read has no data, as a read that has not arrived does, so it is not known that there is no programme.
      useProgramSummary.mockReturnValue({ data: undefined, isError: true });
      await renderPage();

      expect(screen.getByRole("link", { name: /Programme/ }).textContent).toBe("Programme");
    });

    it("should reach the recipe library from Recipes, the row after Programme", async () => {
      await renderPage();

      const links = within(screen.getByRole("region", { name: "Nutrition" })).getAllByRole("link");

      expect(links.map((link) => link.textContent)).toEqual([
        "TargetsSet by you2,200 kcal",
        "Programme",
        "Recipes",
      ]);
      expect(screen.getByRole("link", { name: "Recipes" }).getAttribute("href")).toBe("/recipes");
    });
  });

  it("should reach the Weight page from the Body section, as a row that goes somewhere", async () => {
    await renderPage();

    const link = within(screen.getByRole("region", { name: "Body" })).getByRole("link", {
      name: "Weight",
    });
    expect(link.getAttribute("href")).toBe("/weight");
    expect(link.getAttribute("aria-disabled")).toBeNull();
    expect(link.textContent).toBe("Weight");
  });

  it("should put the Goal row in Body, after Weight", async () => {
    await renderPage();

    const rows = within(screen.getByRole("region", { name: "Body" })).getAllByRole("link");

    expect(rows.map((row) => row.textContent)).toEqual(["Weight", "Goal"]);
    expect(rows[1]?.getAttribute("href")).toBe("/goal");
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

  it("should reach About from Settings, after Appearance", async () => {
    await renderPage();

    const settings = screen.getByRole("region", { name: "Settings" });
    const about = within(settings).getByRole("link", { name: "About" });
    expect(about.getAttribute("href")).toBe("/about");
    expect(
      within(settings)
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual([
      expect.stringContaining("Assistant"),
      expect.stringContaining("Appearance"),
      expect.stringContaining("Body map"),
      expect.stringContaining("Dashboard body map"),
      "About",
    ]);
  });

  describe("the Assistant row", () => {
    const settingsRows = () =>
      within(screen.getByRole("region", { name: "Settings" })).getAllByRole("listitem");

    it("should be the first row of Settings, a link to the Assistant page, saying Off until turned on", async () => {
      await renderPage();

      const row = settingsRows()[0];
      const link = within(row ?? document.body).getByRole("link", { name: /^Assistant/ });
      expect(link.getAttribute("href")).toBe("/more/assistant");
      expect(link.textContent).toBe("AssistantOff until you turn it onOff");
    });

    it("should say On, and what it is for, when the assistant is on", async () => {
      useAssistantConsent.mockReturnValue({ data: { isOn: true } });
      await renderPage();

      expect(
        within(screen.getByRole("region", { name: "Settings" })).getByRole("link", {
          name: /^Assistant/,
        }).textContent,
      ).toBe("AssistantLog and ask in your own wordsOn");
    });

    it("should be the title alone, and still open, while the setting is not read, as it is offline", async () => {
      useAssistantConsent.mockReturnValue({
        data: undefined,
        isPending: true,
        fetchStatus: "paused",
      });
      await renderPage();

      const link = within(screen.getByRole("region", { name: "Settings" })).getByRole("link", {
        name: "Assistant",
      });
      expect(link.getAttribute("href")).toBe("/more/assistant");
    });
  });

  it("should put the Body map control under Settings, after Appearance, on 2D", async () => {
    await renderPage();

    const settings = screen.getByRole("region", { name: "Settings" });
    expect(within(settings).getByRole("radiogroup", { name: "Body map" })).toBeTruthy();
    expect(within(settings).getByRole("radio", { name: "2D" })).toHaveProperty("checked", true);
  });

  it("should put the Dashboard body map control under Settings, between Appearance and About, on Heat", async () => {
    await renderPage();

    const settings = screen.getByRole("region", { name: "Settings" });
    expect(within(settings).getByRole("radiogroup", { name: "Dashboard body map" })).toBeTruthy();
    expect(within(settings).getByRole("radio", { name: "Heat" })).toHaveProperty("checked", true);
  });

  it("should put Export my data first in Account, above Sign out, as a row that opens the export page", async () => {
    await renderPage();

    const account = screen.getByRole("region", { name: "Account" });
    const link = within(account).getByRole("link", { name: /Export my data/ });
    expect(link.getAttribute("href")).toBe("/more/export");
    expect(link.textContent).toBe("Export my dataA file with everything in your account");
    expect(link.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(link.querySelectorAll("svg")).toHaveLength(1);
    expect(
      within(account)
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual([
      "Export my dataA file with everything in your account",
      expect.stringContaining("Sign out"),
    ]);
  });

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

  it("should pad top and bottom as the shell boards draw it", async () => {
    const { container } = render(await MorePage());

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [24, 24],
      desktop: [40, 40],
    });
  });
});
