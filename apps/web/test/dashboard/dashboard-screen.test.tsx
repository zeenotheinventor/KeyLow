import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goldenThursdayBodyMap } from "./bodyMapFixtures";
import {
  boardWeek,
  diaryDay,
  noTargets,
  overTargetDay,
  recipeEntry,
  sampleDay,
  targets,
} from "../diary/support";
import { renderWithRouter } from "../ui/appRouter";

import type { DashboardBodyMap, DiaryDay, Targets, TrainingReadResult } from "@keylow/api-client";

import { DashboardScreen } from "@/components/dashboard";

type Query<Data> = {
  data: Data | undefined;
  isError: boolean;
  refetch: () => Promise<unknown>;
};

type Backend = {
  timeZone: Query<string | null>;
  days: Map<string, Query<DiaryDay>>;
  targets: Query<Targets>;
  dayReads: string[];
  bodyMap: TrainingReadResult<DashboardBodyMap>;
};

const refetchTimeZone = vi.fn<() => Promise<unknown>>();
const refetchDay = vi.fn<() => Promise<unknown>>();
const refetchTargets = vi.fn<() => Promise<unknown>>();

const backend = vi.hoisted((): Backend => ({
  timeZone: { data: undefined, isError: false, refetch: () => Promise.resolve() },
  days: new Map(),
  targets: { data: undefined, isError: false, refetch: () => Promise.resolve() },
  dayReads: [],
  bodyMap: {
    data: undefined,
    isPending: true,
    isError: false,
    error: null,
    refetch: () => Promise.resolve(),
  },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => backend.timeZone,
  useDiaryDay: (date: string) => {
    backend.dayReads.push(date);
    return (
      backend.days.get(date) ?? {
        data: undefined,
        isError: false,
        refetch: () => Promise.resolve(),
      }
    );
  },
  // This file is about the Today card, so the week beside it is always there. The card has its own file.
  useDiaryWeek: () => ({ data: boardWeek, isError: false, refetch: () => Promise.resolve() }),
  useTargets: () => backend.targets,
  useDashboardBodyMap: () => backend.bodyMap,
}));

const TODAY = "2026-10-15";
const waitingDay = (): Query<DiaryDay> => ({
  data: undefined,
  isError: false,
  refetch: refetchDay,
});
const settledDay = (day: DiaryDay): Query<DiaryDay> => ({
  data: day,
  isError: false,
  refetch: refetchDay,
});

function showDay(date: string, entries = sampleDay(date)) {
  backend.days.set(date, settledDay(diaryDay(date, entries)));
}

function showTargets(value: Targets) {
  backend.targets = { data: value, isError: false, refetch: refetchTargets };
}

function renderDashboard() {
  return renderWithRouter(<DashboardScreen />);
}

const card = () => screen.getByRole("link", { name: /^Today, open the diary\./ });

beforeEach(() => {
  vi.resetAllMocks();
  // 11:20 on Thursday 15 October 2026 in UTC.
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date("2026-10-15T11:20:00Z"));
  onlineManager.setOnline(true);
  backend.timeZone = { data: "UTC", isError: false, refetch: refetchTimeZone };
  backend.days.clear();
  backend.dayReads = [];
  backend.bodyMap = {
    data: goldenThursdayBodyMap,
    isPending: false,
    isError: false,
    error: null,
    refetch: () => Promise.resolve(),
  };
  showDay(TODAY);
  showTargets(targets);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  onlineManager.setOnline(true);
});

describe("the dashboard screen", () => {
  describe("the body map card", () => {
    const bodyMapCard = () => screen.getByRole("region", { name: "Training" });
    const weekCard = () =>
      screen.getByRole("link", { name: /^This week, open your weekly averages\./ });

    it("should sit in the second column after the This week card", () => {
      renderDashboard();

      expect(weekCard().compareDocumentPosition(bodyMapCard())).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(bodyMapCard().parentElement).toBe(weekCard().closest("section")?.parentElement);
    });

    it("should name the card by the short title and carry the full name on one image inside it", () => {
      renderDashboard();

      expect(
        within(bodyMapCard()).getByRole("img", {
          name: /^Body map, Actual heat now\. Warmest: lats 25 percent/,
        }),
      ).toBeTruthy();
    });

    it("should leave the Today card in place when its own read fails", () => {
      backend.bodyMap = {
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error("read failed"),
        refetch: () => Promise.resolve(),
      };

      renderDashboard();

      expect(screen.getByText("Couldn't load the body map")).toBeTruthy();
      expect(card()).toBeTruthy();
      expect(weekCard()).toBeTruthy();
    });
  });

  describe("the header", () => {
    it("should name the day above the title, in the profile's time zone", () => {
      renderDashboard();

      expect(screen.getByText("Thursday 15 October")).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy();
    });

    it("should roll the day over at midnight in the profile's zone, not in UTC", () => {
      backend.timeZone = { data: "Pacific/Auckland", isError: false, refetch: refetchTimeZone };
      showDay("2026-10-16");

      renderDashboard();

      expect(screen.getByText("Friday 16 October")).toBeTruthy();
      expect(backend.dayReads).toContain("2026-10-16");
    });

    it("should read the same day query the diary reads", () => {
      renderDashboard();

      expect(new Set(backend.dayReads)).toEqual(new Set([TODAY]));
    });
  });

  describe("today", () => {
    it("should draw the calorie ring named by what is left of the target", () => {
      renderDashboard();

      expect(
        screen.getByRole("img", { name: "1,161 calories remaining of 2,200", hidden: true }),
      ).toBeTruthy();
    });

    it("should leave (est.) off the ring's target line, because the person set it", () => {
      renderDashboard();

      expect(screen.getByText("2,200 target")).toBeTruthy();
      expect(screen.queryByText(/est\./)).toBeNull();
    });

    it("should draw the three macro rows named by grams against the target", () => {
      renderDashboard();

      expect(
        screen.getByRole("group", { name: "Protein: 86 of 160 grams", hidden: true }),
      ).toBeTruthy();
      expect(
        screen.getByRole("group", { name: "Carbs: 129 of 220 grams", hidden: true }),
      ).toBeTruthy();
      expect(screen.getByRole("group", { name: "Fat: 19 of 70 grams", hidden: true })).toBeTruthy();
    });

    it("should be one link to the diary, named by its title, the ring and the three macros", () => {
      renderDashboard();

      expect(card().getAttribute("href")).toBe("/diary");
      expect(card().getAttribute("aria-label")).toBe(
        "Today, open the diary. 1,161 calories remaining of 2,200. Protein: 86 of 160 grams. Carbs: 129 of 220 grams. Fat: 19 of 70 grams",
      );
    });

    it("should hold the title and the ring and bars inside that link, hidden from assistive technology so they are not read twice", () => {
      renderDashboard();

      // The only image outside the hidden card is the body map card's, which names itself in full and
      // holds its figures and legend as presentation.
      const bodyMap = screen.getByRole("region", { name: "Training" });
      const images = screen.getAllByRole("img").filter((image) => !bodyMap.contains(image));
      expect(images).toHaveLength(0);
      expect(within(bodyMap).getAllByRole("img")[0]?.getAttribute("aria-label")).toMatch(
        /^Body map, Actual heat now\./,
      );
      expect(screen.queryByRole("group")).toBeNull();
      expect(screen.queryByRole("heading", { level: 2, name: "Today" })).toBeNull();
      const inside = within(card());
      expect(inside.getByRole("heading", { level: 2, name: "Today", hidden: true })).toBeTruthy();
      expect(inside.getByRole("img", { hidden: true })).toBeTruthy();
      expect(inside.getAllByRole("group", { hidden: true })).toHaveLength(3);
    });

    it("should print the target under a hairline, outside the link, with an Edit link to the targets", () => {
      renderDashboard();

      const caption = screen.getByText("Target 2,200 kcal");
      const edit = screen.getByRole("link", { name: "Edit targets" });
      expect(edit.textContent).toBe("Edit");
      expect(edit.getAttribute("href")).toBe("/more/targets");
      expect(card().contains(caption)).toBe(false);
      expect(card().contains(edit)).toBe(false);
    });

    it("should draw Edit in the accent ink with a 44 px target", () => {
      renderDashboard();

      const { className } = screen.getByRole("link", { name: "Edit targets" });

      expect(className).toContain("text-accent-ink");
      expect(className).toContain("min-h-touch-target");
    });

    it("should open the diary when the card is pressed", () => {
      const { push } = renderDashboard();

      fireEvent.click(card());

      expect(push).toHaveBeenCalledExactlyOnceWith("/diary", expect.anything());
    });

    it("should open the targets when Edit is pressed", () => {
      const { push } = renderDashboard();

      fireEvent.click(screen.getByRole("link", { name: "Edit targets" }));

      expect(push).toHaveBeenCalledExactlyOnceWith("/more/targets", expect.anything());
    });

    it("should show no banner", () => {
      renderDashboard();

      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  describe("nothing logged", () => {
    beforeEach(() => {
      showDay(TODAY, []);
    });

    it("should read the whole target as remaining, with empty bars", () => {
      renderDashboard();

      expect(
        screen.getByRole("img", { name: "2,200 calories remaining of 2,200", hidden: true }),
      ).toBeTruthy();
      expect(
        screen.getByRole("group", { name: "Protein: 0 of 160 grams", hidden: true }),
      ).toBeTruthy();
      expect(screen.queryByTestId("ring-eaten-arc")).toBeNull();
    });

    it("should still show the footer", () => {
      renderDashboard();

      expect(screen.getByText("Target 2,200 kcal")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Edit targets" })).toBeTruthy();
    });
  });

  describe("a recipe entry in the day", () => {
    it("should count the serving in today's calories and macros", () => {
      showDay(TODAY, [...sampleDay(TODAY), recipeEntry({ date: TODAY, time: "18:00" })]);

      renderDashboard();

      // 1,039 kcal and the golden serving's 374.2 leave 787 of 2,200.
      expect(card().getAttribute("aria-label")).toBe(
        "Today, open the diary. 787 calories remaining of 2,200. Protein: 118 of 160 grams. Carbs: 168 of 220 grams. Fat: 27 of 70 grams",
      );
    });
  });

  describe("over target", () => {
    beforeEach(() => {
      showDay(TODAY, overTargetDay(TODAY));
    });

    it("should read the calories over the target", () => {
      renderDashboard();

      expect(
        screen.getByRole("img", { name: "212 calories over target of 2,200", hidden: true }),
      ).toBeTruthy();
      expect(
        screen.getByRole("group", { name: "Fat: 81 of 70 grams, 11 over", hidden: true }),
      ).toBeTruthy();
      expect(
        screen.getByRole("group", { name: "Carbs: 257 of 220 grams, 37 over", hidden: true }),
      ).toBeTruthy();
    });

    it("should name the card with the over-target ring", () => {
      renderDashboard();

      expect(card().getAttribute("aria-label")).toContain(
        "Today, open the diary. 212 calories over target of 2,200. ",
      );
    });

    it("should draw the ring's outlines and the over bars' outlines, and no warning", () => {
      renderDashboard();

      expect(screen.getByTestId("ring-outer-outline")).toBeTruthy();
      expect(screen.getByTestId("ring-inner-outline")).toBeTruthy();
      expect(screen.getByTestId("fat-bar").className).toContain("box-shadow");
      expect(screen.getByTestId("protein-bar").className).not.toContain("box-shadow");
      expect(document.body.innerHTML).not.toContain("warning");
    });
  });

  describe("no target", () => {
    beforeEach(() => {
      showTargets(noTargets);
    });

    it("should say no target is set, with a link to set one", () => {
      renderDashboard();

      const banner = screen.getByRole("status");
      expect(within(banner).getByText("No target set")).toBeTruthy();
      expect(
        within(banner).getByText("Set a calorie and macro target to see what is left."),
      ).toBeTruthy();
      expect(within(banner).getByRole("link", { name: "Set target" }).getAttribute("href")).toBe(
        "/more/targets",
      );
    });

    it("should put the banner above the card", () => {
      renderDashboard();

      const banner = screen.getByRole("status");

      expect(
        banner.compareDocumentPosition(card()) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("should draw the ring as the calories eaten and the bars as grams only", () => {
      renderDashboard();

      expect(
        screen.getByRole("img", { name: "1,039 calories eaten, no target set", hidden: true }),
      ).toBeTruthy();
      expect(screen.getByRole("group", { name: "Protein: 86 grams", hidden: true })).toBeTruthy();
      expect(card().getAttribute("aria-label")).toBe(
        "Today, open the diary. 1,039 calories eaten, no target set. Protein: 86 grams. Carbs: 129 grams. Fat: 19 grams",
      );
    });

    it("should leave the footer off, so there is no Edit", () => {
      renderDashboard();

      expect(screen.queryByText(/^Target /)).toBeNull();
      expect(screen.queryByRole("link", { name: "Edit targets" })).toBeNull();
    });

    it("should still open the diary", () => {
      renderDashboard();

      expect(card().getAttribute("href")).toBe("/diary");
    });
  });

  describe("loading", () => {
    it("should show the header and, after 200 ms, a skeleton named for the card", () => {
      backend.days.set(TODAY, waitingDay());
      renderDashboard();
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy();
      expect(screen.getByRole("status", { name: "Loading today's nutrition" })).toBeTruthy();
      expect(screen.queryByRole("link", { name: /^Today/ })).toBeNull();
    });

    it("should wait for the targets as well", () => {
      backend.targets = { data: undefined, isError: false, refetch: refetchTargets };
      renderDashboard();

      expect(screen.getByRole("status", { name: "Loading today's nutrition" })).toBeTruthy();
      expect(screen.queryByRole("link", { name: /^Today/ })).toBeNull();
    });

    it("should wait for the time zone, which says which day today is", () => {
      backend.timeZone = { data: undefined, isError: false, refetch: refetchTimeZone };
      renderDashboard();

      expect(screen.getByRole("status", { name: "Loading today's nutrition" })).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy();
      expect(backend.dayReads).toEqual([]);
    });
  });

  describe("error", () => {
    it("should put an error in place of the card and keep the header", () => {
      backend.days.set(TODAY, { data: undefined, isError: true, refetch: refetchDay });
      renderDashboard();

      expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy();
      expect(
        screen.getByRole("heading", { level: 2, name: "Couldn't load today's nutrition" }),
      ).toBeTruthy();
      expect(screen.getByText("Check your connection and try again.")).toBeTruthy();
      expect(screen.queryByRole("link", { name: /^Today/ })).toBeNull();
    });

    it("should refetch only what failed when Try again is pressed", () => {
      backend.days.set(TODAY, { data: undefined, isError: true, refetch: refetchDay });
      renderDashboard();

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(refetchDay).toHaveBeenCalledOnce();
      expect(refetchTargets).not.toHaveBeenCalled();
    });

    it("should fail on the targets too, and refetch them", () => {
      backend.targets = { data: undefined, isError: true, refetch: refetchTargets };
      renderDashboard();

      // The targets are the This week card's too, so it shows its own error beside Today's.
      const weekRegion = screen.getByRole("region", { name: "This week" });
      const [todaysRetry] = screen
        .getAllByRole("button", { name: "Try again" })
        .filter((button) => !weekRegion.contains(button));
      expect(todaysRetry).toBeDefined();
      fireEvent.click(todaysRetry ?? weekRegion);

      expect(refetchTargets).toHaveBeenCalledOnce();
      expect(refetchDay).not.toHaveBeenCalled();
    });

    it("should fail on the time zone, and refetch it", () => {
      backend.timeZone = { data: undefined, isError: true, refetch: refetchTimeZone };
      renderDashboard();

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(refetchTimeZone).toHaveBeenCalledOnce();
      expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy();
    });

    it("should keep the card when a refetch fails while the day is on screen", () => {
      backend.days.set(TODAY, {
        data: diaryDay(TODAY, sampleDay(TODAY)),
        isError: true,
        refetch: refetchDay,
      });
      renderDashboard();

      expect(card()).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    });

    it("should keep the card when a refetch of the targets fails", () => {
      backend.targets = { data: targets, isError: true, refetch: refetchTargets };
      renderDashboard();

      expect(card()).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    });

    it("should keep the day when a refetch of the time zone fails", () => {
      backend.timeZone = { data: "UTC", isError: true, refetch: refetchTimeZone };
      renderDashboard();

      expect(card()).toBeTruthy();
    });
  });

  describe("offline", () => {
    beforeEach(() => {
      onlineManager.setOnline(false);
    });

    it("should say so above the card and keep the card readable", () => {
      renderDashboard();

      const banner = screen.getByRole("status");
      expect(within(banner).getByText("You're offline")).toBeTruthy();
      expect(
        within(banner).getByText("Showing your last saved diary. Changes need a connection."),
      ).toBeTruthy();
      expect(card()).toBeTruthy();
      expect(
        screen.getByRole("img", { name: "1,161 calories remaining of 2,200", hidden: true }),
      ).toBeTruthy();
    });

    it("should show the banner over the skeleton when the page opens already offline", () => {
      backend.days.set(TODAY, waitingDay());
      renderDashboard();

      expect(screen.getByText("You're offline")).toBeTruthy();
      expect(screen.getByRole("status", { name: "Loading today's nutrition" })).toBeTruthy();
    });

    it("should show the banner over the skeleton while the time zone is unknown", () => {
      backend.timeZone = { data: undefined, isError: false, refetch: refetchTimeZone };
      renderDashboard();

      expect(screen.getByText("You're offline")).toBeTruthy();
    });

    it("should take the banner away when the connection comes back", () => {
      renderDashboard();

      act(() => {
        onlineManager.setOnline(true);
      });

      expect(screen.queryByText("You're offline")).toBeNull();
    });

    it("should show both banners when there is no target either", () => {
      showTargets(noTargets);
      renderDashboard();

      expect(screen.getByText("No target set")).toBeTruthy();
      expect(screen.getByText("You're offline")).toBeTruthy();
    });
  });

  describe("midnight", () => {
    it("should keep the last day on screen while the new day loads, and move the date on", () => {
      renderDashboard();
      expect(
        screen.getByRole("img", { name: "1,161 calories remaining of 2,200", hidden: true }),
      ).toBeTruthy();

      act(() => {
        vi.setSystemTime(new Date("2026-10-16T00:01:00Z"));
        vi.advanceTimersByTime(60_000);
      });

      expect(screen.getByText("Friday 16 October")).toBeTruthy();
      expect(backend.dayReads).toContain("2026-10-16");
      expect(
        screen.getByRole("img", { name: "1,161 calories remaining of 2,200", hidden: true }),
      ).toBeTruthy();
      expect(screen.queryByRole("status", { name: "Loading today's nutrition" })).toBeNull();
    });

    it("should show the new day once it has loaded", () => {
      const { push } = renderDashboard();
      showDay("2026-10-16", []);

      act(() => {
        vi.setSystemTime(new Date("2026-10-16T00:01:00Z"));
        vi.advanceTimersByTime(60_000);
      });

      expect(
        screen.getByRole("img", { name: "2,200 calories remaining of 2,200", hidden: true }),
      ).toBeTruthy();
      fireEvent.click(card());
      expect(push).toHaveBeenCalledExactlyOnceWith("/diary", expect.anything());
    });

    it("should show the error when the new day fails while the last day is on screen", () => {
      renderDashboard();
      expect(card()).toBeTruthy();
      backend.days.set("2026-10-16", { data: undefined, isError: true, refetch: refetchDay });

      act(() => {
        vi.setSystemTime(new Date("2026-10-16T00:01:00Z"));
        vi.advanceTimersByTime(60_000);
      });

      expect(
        screen.getByRole("heading", { level: 2, name: "Couldn't load today's nutrition" }),
      ).toBeTruthy();
      expect(screen.queryByRole("link", { name: /^Today/ })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(refetchDay).toHaveBeenCalledOnce();
    });
  });
});
