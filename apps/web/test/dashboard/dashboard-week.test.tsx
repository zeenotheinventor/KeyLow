import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goldenThursdayBodyMap } from "./bodyMapFixtures";
import {
  boardWeek,
  diaryDay,
  emptyWeek,
  noTargets,
  overTargetWeek,
  sampleDay,
  targets,
  weekDay,
} from "../diary/support";
import { renderWithRouter } from "../ui/appRouter";

import type { DiaryDay, DiaryWeekDay, Targets } from "@keylow/api-client";

import { DashboardScreen } from "@/components/dashboard";

type Query<Data> = {
  data: Data | undefined;
  isError: boolean;
  refetch: () => Promise<unknown>;
};

type Backend = {
  timeZone: Query<string | null>;
  targets: Query<Targets>;
  weeks: Map<string, Query<DiaryWeekDay[]>>;
  weekReads: string[];
  days: Map<string, DiaryDay>;
};

const refetchWeek = vi.fn<() => Promise<unknown>>();
const refetchTargets = vi.fn<() => Promise<unknown>>();
const refetchDay = vi.fn<() => Promise<unknown>>();

const backend = vi.hoisted((): Backend => ({
  timeZone: { data: undefined, isError: false, refetch: () => Promise.resolve() },
  targets: { data: undefined, isError: false, refetch: () => Promise.resolve() },
  weeks: new Map(),
  weekReads: [],
  days: new Map(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => backend.timeZone,
  useDiaryDay: (date: string) => {
    // One object per date, as the cache gives, or the Today card would see a new day on every render.
    const day = backend.days.get(date) ?? diaryDay(date, sampleDay(date));
    backend.days.set(date, day);

    return { data: day, isError: false, refetch: refetchDay };
  },
  useDiaryWeek: (weekStart: string) => {
    backend.weekReads.push(weekStart);
    return (
      backend.weeks.get(weekStart) ?? {
        data: undefined,
        isError: false,
        refetch: refetchWeek,
      }
    );
  },
  useTargets: () => backend.targets,
  // This file is about the week, so the body map card beside it is settled and quiet.
  useDashboardBodyMap: () => ({
    data: goldenThursdayBodyMap,
    isPending: false,
    isError: false,
    error: null,
    refetch: () => Promise.resolve(),
  }),
}));

// 11:20 on Thursday 15 October 2026, in the week of Monday 12 October.
const MONDAY = "2026-10-12";

const settledWeek = (days: DiaryWeekDay[]): Query<DiaryWeekDay[]> => ({
  data: days,
  isError: false,
  refetch: refetchWeek,
});

function showWeek(days: DiaryWeekDay[]) {
  backend.weeks.set(MONDAY, settledWeek(days));
}

function showTargets(value: Targets) {
  backend.targets = { data: value, isError: false, refetch: refetchTargets };
}

function renderDashboard() {
  return renderWithRouter(<DashboardScreen />);
}

const weekCard = () =>
  screen.getByRole("link", { name: /^This week, open your weekly averages\./ });
const markerNamed = (name: string) => screen.getByRole("img", { name, hidden: true });

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date("2026-10-15T11:20:00Z"));
  onlineManager.setOnline(true);
  backend.timeZone = { data: "UTC", isError: false, refetch: vi.fn() };
  backend.weeks.clear();
  backend.weekReads = [];
  backend.days.clear();
  showWeek(boardWeek);
  showTargets(targets);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  onlineManager.setOnline(true);
});

describe("the This week card", () => {
  describe("the sample week", () => {
    it("should be one link to the weekly averages page, named by the average and the days complete", () => {
      renderDashboard();

      expect(weekCard().getAttribute("href")).toBe("/dashboard/week");
      expect(weekCard().getAttribute("aria-label")).toBe(
        "This week, open your weekly averages. Average 1,895 of 2,200 kilocalories a day, from 3 days with food logged before today. 2 of 4 days complete.",
      );
    });

    it("should open the weekly averages page when it is pressed", () => {
      const { push } = renderDashboard();

      fireEvent.click(weekCard());

      expect(push).toHaveBeenCalledExactlyOnceWith("/dashboard/week", expect.anything());
    });

    it("should read the week that holds today, once", () => {
      renderDashboard();

      expect(new Set(backend.weekReads)).toEqual(new Set([MONDAY]));
    });

    it("should hold its words inside the link, hidden from assistive technology so they are not read twice", () => {
      renderDashboard();

      expect(screen.queryByRole("heading", { level: 2, name: "This week" })).toBeNull();
      const inside = within(weekCard());
      expect(
        inside.getByRole("heading", { level: 2, name: "This week", hidden: true }),
      ).toBeTruthy();
      expect(inside.getByText("Week of Mon 12 Oct")).toBeTruthy();
      expect(inside.getByText("From 3 days with food logged")).toBeTruthy();
      expect(inside.getByText("2 of 4 days complete")).toBeTruthy();
    });

    it("should print the average of the days before today over the target, captioned Mon to yesterday", () => {
      renderDashboard();

      // Monday 2,140, Tuesday 2,260 and Wednesday 1,286: today's 1,039 is left out.
      const inside = within(weekCard());
      expect(inside.getByText("Average")).toBeTruthy();
      expect(inside.getByText("· Mon to yesterday")).toBeTruthy();
      expect(inside.queryByText(/Mon to today/)).toBeNull();
      expect(inside.getByText("1,895")).toBeTruthy();
      expect(inside.getByText("/ 2,200 kcal")).toBeTruthy();
      expect(inside.queryByText(/over|\+/)).toBeNull();
    });

    it("should draw the bar as a meter named Average, 1,895 of 2,200, with no outline", () => {
      renderDashboard();

      const bar = within(weekCard()).getByRole("meter", { name: "Average", hidden: true });

      expect(bar.getAttribute("aria-valuenow")).toBe("1895");
      expect(bar.getAttribute("aria-valuemax")).toBe("2200");
      expect(bar.getAttribute("aria-valuetext")).toBe("1,895 of 2,200 kilocalories");
      expect(bar.className).not.toContain("box-shadow");
    });

    it("should name the seven markers, Monday to Sunday, by their day and state", () => {
      renderDashboard();

      expect(markerNamed("Monday 12 October, complete")).toBeTruthy();
      expect(markerNamed("Tuesday 13 October, complete")).toBeTruthy();
      expect(markerNamed("Wednesday 14 October")).toBeTruthy();
      expect(markerNamed("Thursday 15 October, today")).toBeTruthy();
      expect(markerNamed("Friday 16 October")).toBeTruthy();
      expect(markerNamed("Saturday 17 October")).toBeTruthy();
      expect(markerNamed("Sunday 18 October")).toBeTruthy();
      expect(
        within(weekCard())
          .getAllByText(/^(Mo|Tu|We|Th|Fr|Sa|Su)$/)
          .map((day) => day.textContent),
      ).toEqual(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);
    });

    it("should draw a day still to come with a dashed ring, and a day so far with a solid one", () => {
      renderDashboard();

      expect(markerNamed("Friday 16 October").className).toContain("border-dashed");
      expect(markerNamed("Wednesday 14 October").className).not.toContain("border-dashed");
      expect(markerNamed("Wednesday 14 October").className).toContain("border-border-strong");
    });

    it("should fill a complete day and leave an open one empty", () => {
      renderDashboard();

      expect(markerNamed("Monday 12 October, complete").className).toContain("bg-success-muted");
      expect(markerNamed("Wednesday 14 October").className).not.toContain("bg-success-muted");
    });

    it("should sit in a section named for the week, with a chevron in the title", () => {
      renderDashboard();

      expect(screen.getByRole("region", { name: "This week" })).toBeTruthy();
    });

    it("should leave the Today card as it was", () => {
      renderDashboard();

      expect(screen.getByRole("link", { name: /^Today, open the diary\./ })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Edit targets" })).toBeTruthy();
    });

    it("should count a day marked complete that is still to come as no day at all", () => {
      showWeek([
        ...boardWeek.slice(0, 4),
        weekDay("2026-10-16", null, true),
        ...boardWeek.slice(5),
      ]);
      renderDashboard();

      expect(weekCard().getAttribute("aria-label")).toContain("2 of 4 days complete.");
      expect(markerNamed("Friday 16 October")).toBeTruthy();
    });

    it("should say the averages start tomorrow on a Monday, and 1 of 1 day complete", () => {
      vi.setSystemTime(new Date("2026-10-12T09:00:00Z"));
      showWeek([weekDay(MONDAY, [1500, 100, 150, 50], true), ...emptyWeek.slice(1)]);
      renderDashboard();

      expect(weekCard().getAttribute("aria-label")).toBe(
        "This week, open your weekly averages. Your averages start tomorrow. 1 of 1 day complete.",
      );
      const inside = within(weekCard());
      expect(inside.getByText("Your averages start tomorrow.")).toBeTruthy();
      expect(inside.getByText("1 of 1 day complete")).toBeTruthy();
      expect(inside.queryByRole("meter", { hidden: true })).toBeNull();
      expect(inside.queryByText(/with food logged/)).toBeNull();
    });

    it("should say from 1 day with food logged on a Tuesday after a logged Monday", () => {
      vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
      showWeek([weekDay(MONDAY, [1500, 100, 150, 50], true), ...emptyWeek.slice(1)]);
      renderDashboard();

      expect(weekCard().getAttribute("aria-label")).toBe(
        "This week, open your weekly averages. Average 1,500 of 2,200 kilocalories a day, from 1 day with food logged before today. 1 of 2 days complete.",
      );
      expect(within(weekCard()).getByText("From 1 day with food logged")).toBeTruthy();
    });
  });

  describe("a day whose calories nobody gave a value for", () => {
    it("should count it as a day of 0 kcal, as the Week view does", () => {
      const monday = weekDay(MONDAY, [0, 0, 0, 0]);
      showWeek([
        { ...monday, totals: monday.totals && { ...monday.totals, kcal: null } },
        ...boardWeek.slice(1),
      ]);
      renderDashboard();

      // Monday 0, Tuesday 2,260 and Wednesday 1,286 average 1,182.
      expect(weekCard().getAttribute("aria-label")).toContain("Average 1,182 of 2,200");
    });
  });

  describe("nothing logged", () => {
    beforeEach(() => {
      showWeek(emptyWeek);
    });

    it("should say nothing is logged before today in place of the average, the bar and the basis", () => {
      renderDashboard();

      const inside = within(weekCard());
      expect(inside.getByText("Nothing logged before today this week.")).toBeTruthy();
      expect(inside.queryByText("Average")).toBeNull();
      expect(inside.queryByRole("meter", { hidden: true })).toBeNull();
      expect(inside.queryByText(/with food logged/)).toBeNull();
    });

    it("should still count the days so far, none of them complete", () => {
      renderDashboard();

      expect(within(weekCard()).getByText("0 of 4 days complete")).toBeTruthy();
      expect(weekCard().getAttribute("aria-label")).toBe(
        "This week, open your weekly averages. Nothing logged before today this week. 0 of 4 days complete.",
      );
    });
  });

  describe("only today logged", () => {
    it("should say nothing is logged before today, since today's entries do not count yet", () => {
      // Thursday's 1,039 alone, with nothing on the days before it.
      showWeek([...emptyWeek.slice(0, 3), ...boardWeek.slice(3)]);
      renderDashboard();

      expect(within(weekCard()).getByText("Nothing logged before today this week.")).toBeTruthy();
      expect(within(weekCard()).queryByRole("meter", { hidden: true })).toBeNull();
      expect(weekCard().getAttribute("aria-label")).toBe(
        "This week, open your weekly averages. Nothing logged before today this week. 0 of 4 days complete.",
      );
    });
  });

  describe("no target", () => {
    beforeEach(() => {
      showTargets(noTargets);
    });

    it("should read the average as 1,895 kcal, with no bar", () => {
      renderDashboard();

      const inside = within(weekCard());
      expect(inside.getByText("1,895")).toBeTruthy();
      expect(inside.getByText("kcal")).toBeTruthy();
      expect(inside.queryByText(/\//)).toBeNull();
      expect(inside.queryByRole("meter", { hidden: true })).toBeNull();
    });

    it("should name the card without a target", () => {
      renderDashboard();

      expect(weekCard().getAttribute("aria-label")).toBe(
        "This week, open your weekly averages. Average 1,895 kilocalories a day, from 3 days with food logged before today. 2 of 4 days complete.",
      );
    });

    it("should put the one No target set banner above both cards", () => {
      renderDashboard();

      const banner = screen.getByRole("status");
      const following = Node.DOCUMENT_POSITION_FOLLOWING;
      expect(within(banner).getByText("No target set")).toBeTruthy();
      expect(banner.compareDocumentPosition(weekCard()) & following).toBeTruthy();
      expect(
        banner.compareDocumentPosition(screen.getByRole("link", { name: /^Today/ })) & following,
      ).toBeTruthy();
    });
  });

  describe("over target", () => {
    beforeEach(() => {
      showWeek(overTargetWeek);
    });

    it("should read 2,463 over 2,200 kcal with +263 kcal after it, from the days before today", () => {
      renderDashboard();

      // Monday 2,140, Tuesday 2,260 and Wednesday 2,988 average 2,463: today's 2,412 is left out.
      const inside = within(weekCard());
      expect(inside.getByText("2,463")).toBeTruthy();
      expect(inside.getByText("/ 2,200 kcal")).toBeTruthy();
      expect(inside.getByText("+263 kcal")).toBeTruthy();
      expect(weekCard().getAttribute("aria-label")).toContain("Average 2,463 of 2,200");
    });

    it("should draw the bar full with the brighter outline, and no warning colour", () => {
      renderDashboard();

      const bar = within(weekCard()).getByRole("meter", { name: "Average", hidden: true });

      expect(bar.getAttribute("aria-valuenow")).toBe("2200");
      expect(bar.getAttribute("aria-valuetext")).toBe("2,463 of 2,200 kilocalories, over target");
      expect(bar.className).toContain("box-shadow");
      expect(weekCard().innerHTML).not.toContain("warning");
      expect(weekCard().innerHTML).not.toContain("danger");
    });
  });

  describe("loading", () => {
    it("should show a skeleton named Loading this week while the week loads, and no link", () => {
      backend.weeks.clear();
      renderDashboard();

      expect(screen.getByRole("status", { name: "Loading this week" })).toBeTruthy();
      expect(screen.queryByRole("link", { name: /^This week/ })).toBeNull();
    });

    it("should wait for the targets as well", () => {
      backend.targets = { data: undefined, isError: false, refetch: refetchTargets };
      renderDashboard();

      expect(screen.getByRole("status", { name: "Loading this week" })).toBeTruthy();
    });

    it("should load on its own, so the Today card is already there", () => {
      backend.weeks.clear();
      renderDashboard();

      expect(screen.getByRole("link", { name: /^Today, open the diary\./ })).toBeTruthy();
    });

    it("should be a skeleton beside the Today skeleton while the time zone is unknown", () => {
      backend.timeZone = { data: undefined, isError: false, refetch: vi.fn() };
      renderDashboard();

      expect(screen.getByRole("status", { name: "Loading today's nutrition" })).toBeTruthy();
      expect(screen.getByRole("status", { name: "Loading this week" })).toBeTruthy();
      expect(backend.weekReads).toEqual([]);
    });
  });

  describe("error", () => {
    beforeEach(() => {
      backend.weeks.set(MONDAY, { data: undefined, isError: true, refetch: refetchWeek });
    });

    it("should say Couldn't load this week inside the card, under its title and caption", () => {
      renderDashboard();

      const region = screen.getByRole("region", { name: "This week" });
      expect(within(region).getByRole("heading", { level: 2, name: "This week" })).toBeTruthy();
      expect(within(region).getByText("Week of Mon 12 Oct")).toBeTruthy();
      const alert = within(region).getByRole("alert");
      expect(within(alert).getByText("Couldn't load this week")).toBeTruthy();
      expect(within(alert).getByText("Check your connection and try again.")).toBeTruthy();
    });

    it("should not be a link while it shows the error", () => {
      renderDashboard();

      expect(screen.queryByRole("link", { name: /^This week/ })).toBeNull();
    });

    it("should leave the Today card as it was", () => {
      renderDashboard();

      expect(screen.getByRole("link", { name: /^Today, open the diary\./ })).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "Couldn't load today's nutrition" })).toBeNull();
    });

    it("should refetch only the week when Try again is pressed", () => {
      renderDashboard();

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(refetchWeek).toHaveBeenCalledOnce();
      expect(refetchTargets).not.toHaveBeenCalled();
    });

    it("should refetch the targets when they were what failed", () => {
      showWeek(boardWeek);
      backend.targets = { data: undefined, isError: true, refetch: refetchTargets };
      renderDashboard();

      const region = screen.getByRole("region", { name: "This week" });
      fireEvent.click(within(region).getByRole("button", { name: "Try again" }));

      expect(refetchTargets).toHaveBeenCalledOnce();
      expect(refetchWeek).not.toHaveBeenCalled();
    });

    it("should keep the card when a refetch fails while the week is on screen", () => {
      backend.weeks.set(MONDAY, { ...settledWeek(boardWeek), isError: true });
      renderDashboard();

      expect(weekCard()).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("offline", () => {
    beforeEach(() => {
      onlineManager.setOnline(false);
    });

    it("should show the week it already has, with the one offline banner above both cards", () => {
      renderDashboard();

      expect(weekCard().getAttribute("aria-label")).toContain("Average 1,895 of 2,200");
      const banner = screen.getByRole("status");
      expect(within(banner).getByText("You're offline")).toBeTruthy();
      expect(
        banner.compareDocumentPosition(weekCard()) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("should still open the weekly averages page, which reads the same week from what it has", () => {
      const { push } = renderDashboard();

      fireEvent.click(weekCard());

      expect(push).toHaveBeenCalledExactlyOnceWith("/dashboard/week", expect.anything());
    });

    it("should say This week isn't available offline when no week is on hand", () => {
      backend.weeks.clear();
      renderDashboard();

      const region = screen.getByRole("region", { name: "This week" });
      expect(within(region).getByText("This week isn't available offline.")).toBeTruthy();
      expect(screen.queryByRole("status", { name: "Loading this week" })).toBeNull();
      expect(screen.queryByRole("link", { name: /^This week/ })).toBeNull();
      expect(within(region).queryByRole("button", { name: "Try again" })).toBeNull();
    });
  });

  describe("midnight", () => {
    it("should read the next week when Sunday turns into Monday, and never sum the old one for the new day", () => {
      vi.setSystemTime(new Date("2026-10-18T23:30:00Z"));
      renderDashboard();
      expect(weekCard().getAttribute("aria-label")).toContain("2 of 7 days complete.");

      act(() => {
        vi.setSystemTime(new Date("2026-10-19T00:01:00Z"));
        vi.advanceTimersByTime(60_000);
      });

      expect(backend.weekReads).toContain("2026-10-19");
      expect(screen.getByRole("status", { name: "Loading this week" })).toBeTruthy();
      expect(screen.queryByRole("link", { name: /^This week/ })).toBeNull();
    });

    it("should show the new week once it has loaded", () => {
      vi.setSystemTime(new Date("2026-10-18T23:30:00Z"));
      renderDashboard();
      const newMonday = "2026-10-19";
      const newWeek = [newMonday, "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"].map(
        (day) => weekDay(day, null),
      );
      backend.weeks.set(
        newMonday,
        settledWeek([
          weekDay(newMonday, [1500, 100, 150, 50]),
          ...newWeek.slice(1),
          weekDay("2026-10-24", null),
          weekDay("2026-10-25", null),
        ]),
      );

      act(() => {
        vi.setSystemTime(new Date("2026-10-19T00:01:00Z"));
        vi.advanceTimersByTime(60_000);
      });

      expect(weekCard().getAttribute("aria-label")).toBe(
        "This week, open your weekly averages. Your averages start tomorrow. 0 of 1 day complete.",
      );
      expect(within(weekCard()).getByText("Week of Mon 19 Oct")).toBeTruthy();
    });

    it("should move today within the week without leaving the card", () => {
      renderDashboard();

      act(() => {
        vi.setSystemTime(new Date("2026-10-16T00:01:00Z"));
        vi.advanceTimersByTime(60_000);
      });

      expect(markerNamed("Friday 16 October, today")).toBeTruthy();
      expect(weekCard().getAttribute("aria-label")).toContain("2 of 5 days complete.");
    });
  });

  describe("the time zone", () => {
    it("should count today in the profile's zone, the day the Today card counts", () => {
      backend.timeZone = { data: "Pacific/Auckland", isError: false, refetch: vi.fn() };
      showWeek(boardWeek);

      renderDashboard();

      // 11:20 UTC on the 15th is 00:20 on Friday the 16th in Auckland.
      expect(markerNamed("Friday 16 October, today")).toBeTruthy();
      expect(weekCard().getAttribute("aria-label")).toContain("2 of 5 days complete.");
    });
  });
});
