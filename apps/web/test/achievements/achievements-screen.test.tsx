import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stateWithOneEntry } from "./fixtures";

import type { AchievementState } from "@keylow/api-client";

import { AchievementsScreen } from "@/components/achievements";

const { useAchievementState } = vi.hoisted(() => ({
  useAchievementState: vi.fn<
    () => {
      data: AchievementState | undefined;
      isError: boolean;
      refetch: () => Promise<unknown>;
    }
  >(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useAchievementState,
}));

// The sync is tested on its own in use-sync-achievements.test.tsx.
vi.mock("@/components/achievements/useSyncAchievements", () => ({
  DEVICE_INPUTS: { reminderEnabled: false },
  useSyncAchievements: vi.fn(),
}));

const refetch = vi.fn<() => Promise<unknown>>();

function loaded() {
  useAchievementState.mockReturnValue({ data: stateWithOneEntry(), isError: false, refetch });
}

afterEach(cleanup);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Achievements screen", () => {
  describe("loaded", () => {
    beforeEach(loaded);

    it("should have the page heading", () => {
      render(<AchievementsScreen />);

      expect(screen.getByRole("heading", { level: 1, name: "Achievements" })).toBeTruthy();
    });

    it("should show the level, its name and the points to the next level", () => {
      render(<AchievementsScreen />);

      expect(screen.getByText("Level 0")).toBeTruthy();
      expect(screen.getByText("Sprout")).toBeTruthy();
      expect(screen.getByText("10 points. 40 to level 1")).toBeTruthy();
      expect(
        screen
          .getByRole("progressbar", { name: "Progress to the next level" })
          .getAttribute("aria-valuenow"),
      ).toBe("10");
    });

    it("should show the daily streak with the last 14 days", () => {
      render(<AchievementsScreen />);

      expect(screen.getByText("Daily streak")).toBeTruthy();
      expect(screen.getByText("0 days")).toBeTruthy();
      expect(screen.getByText(/^Longest 0\. \d+ freezes? held$/)).toBeTruthy();
      expect(
        within(screen.getByRole("list", { name: "Last 14 days" })).getAllByRole("listitem"),
      ).toHaveLength(14);
    });

    it("should count the badges earned against the 130 and say the weekly streaks", () => {
      render(<AchievementsScreen />);

      expect(screen.getByText("1 of 130")).toBeTruthy();
      expect(screen.getByText("Training streak 0 weeks. Weigh-in streak 0 weeks.")).toBeTruthy();
    });

    it("should list the 13 categories as headed sections", () => {
      render(<AchievementsScreen />);

      expect(screen.getAllByRole("region")).toHaveLength(13);
      expect(screen.getByRole("region", { name: "Daily streaks" })).toBeTruthy();
      expect(
        within(screen.getByRole("region", { name: "Getting started" })).getByText("1 of 12"),
      ).toBeTruthy();
    });

    it("should draw all 130 badges as buttons", () => {
      render(<AchievementsScreen />);

      const badgeButtons = screen
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-label")?.match(/earned|locked|Hidden/));
      expect(badgeButtons).toHaveLength(130);
    });

    it("should name an earned badge, a locked one with its progress, and a hidden one as hidden", () => {
      render(<AchievementsScreen />);

      expect(screen.getByRole("button", { name: "First Bite, Bronze, earned" })).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Jotter, Bronze, locked, 1 of 10 entries" }),
      ).toBeTruthy();
      expect(screen.getAllByRole("button", { name: "Hidden badge" }).length).toBeGreaterThan(0);
    });

    it("should open an earned badge's date and points in a dialog and close it with Done", async () => {
      const user = userEvent.setup();
      render(<AchievementsScreen />);

      await user.click(screen.getByRole("button", { name: "First Bite, Bronze, earned" }));

      const dialog = screen.getByRole("dialog", { name: "First Bite" });
      expect(within(dialog).getByText("Bronze · Getting started")).toBeTruthy();
      expect(within(dialog).getByText("Logging your first food.")).toBeTruthy();
      expect(within(dialog).getByText("6 November 2026")).toBeTruthy();
      expect(within(dialog).getByText("+10")).toBeTruthy();

      await user.click(within(dialog).getByRole("button", { name: "Done" }));

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should open a locked badge with its progress and what it is worth", async () => {
      const user = userEvent.setup();
      render(<AchievementsScreen />);

      await user.click(
        screen.getByRole("button", { name: "Jotter, Bronze, locked, 1 of 10 entries" }),
      );

      const dialog = screen.getByRole("dialog", { name: "Jotter" });
      expect(
        within(dialog)
          .getByRole("progressbar", { name: "Jotter progress" })
          .getAttribute("aria-valuenow"),
      ).toBe("1");
      expect(within(dialog).getByText("1 of 10 entries")).toBeTruthy();
      expect(within(dialog).getByText("9 to go")).toBeTruthy();
      expect(within(dialog).getByText("+10 points")).toBeTruthy();
    });

    it("should open a hidden badge without giving away its name", async () => {
      const user = userEvent.setup();
      render(<AchievementsScreen />);

      const [firstHiddenBadge] = screen.getAllByRole("button", { name: "Hidden badge" });
      if (firstHiddenBadge === undefined) {
        throw new Error("The catalogue has hidden badges.");
      }
      await user.click(firstHiddenBadge);

      const dialog = screen.getByRole("dialog", { name: "A hidden badge" });
      expect(within(dialog).getByText(/Some badges stay secret/)).toBeTruthy();
      expect(within(dialog).queryByRole("progressbar")).toBeNull();
    });

    it("should close the dialog with Escape", async () => {
      const user = userEvent.setup();
      render(<AchievementsScreen />);
      await user.click(screen.getByRole("button", { name: "First Bite, Bronze, earned" }));

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("loading", () => {
    it("should be a status region named Loading achievements", async () => {
      useAchievementState.mockReturnValue({ data: undefined, isError: false, refetch });
      render(<AchievementsScreen />);

      expect(await screen.findByRole("status", { name: "Loading achievements" })).toBeTruthy();
      expect(screen.queryByRole("region")).toBeNull();
    });
  });

  describe("failed", () => {
    it("should say it could not load, and read again on Try again", async () => {
      const user = userEvent.setup();
      useAchievementState.mockReturnValue({ data: undefined, isError: true, refetch });
      render(<AchievementsScreen />);

      expect(screen.getByRole("alert").textContent).toContain("Couldn't load your achievements");
      await user.click(screen.getByRole("button", { name: "Try again" }));

      expect(refetch).toHaveBeenCalledOnce();
    });

    it("should keep what was read when a later read fails", () => {
      useAchievementState.mockReturnValue({
        data: stateWithOneEntry(),
        isError: true,
        refetch,
      });
      render(<AchievementsScreen />);

      expect(screen.getByText("1 of 130")).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
