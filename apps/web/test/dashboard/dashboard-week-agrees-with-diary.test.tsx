import { WEEK_GRID } from "@keylow/core/copy";
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goldenThursdayBodyMap } from "./bodyMapFixtures";
import { boardWeek, diaryDay, noTargets, overTargetWeek, targets, weekDay } from "../diary/support";
import { renderWithRouter } from "../ui/appRouter";

import type { DiaryDay, DiaryWeekDay, Targets } from "@keylow/api-client";

import { DashboardScreen, WeekAveragesScreen } from "@/components/dashboard";
import { DiaryScreen } from "@/components/diary";
import { ToastProvider } from "@/components/ui/Toast";

type Backend = {
  week: DiaryWeekDay[];
  targets: Targets;
  day: DiaryDay | undefined;
};

const backend = vi.hoisted((): Backend => ({
  week: [],
  targets: { kcal: null, protein_g: null, carbs_g: null, fat_g: null, source: "manual" },
  day: undefined,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("@/lib/foodLogActions", () => ({
  useFoodLogActions: () => ({
    openAddFood: vi.fn(),
    openEditEntry: vi.fn(),
    setViewedDate: vi.fn(),
    viewedDate: undefined,
  }),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "UTC", isError: false, refetch: vi.fn() }),
  useDiaryDay: () => ({ data: backend.day, isError: false, isSuccess: true, refetch: vi.fn() }),
  useDiaryWeek: () => ({ data: backend.week, isError: false, isSuccess: true, refetch: vi.fn() }),
  useTargets: () => ({ data: backend.targets, isError: false, isSuccess: true, refetch: vi.fn() }),
  useCompleteDays: () => ({ data: [], isError: false, isSuccess: true, refetch: vi.fn() }),
  useCopyDay: () => ({ mutate: vi.fn(), isPending: false }),
  useUndoCopyDay: () => ({ mutate: vi.fn(), isPending: false }),
  // This file is about the week, so the body map card beside it is settled and quiet.
  useDashboardBodyMap: () => ({
    data: goldenThursdayBodyMap,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

// A Wednesday with one day marked complete that is still to come, to show the card leaves it out.
const weekWithCompleteFutureDay = [
  ...boardWeek.slice(0, 4),
  weekDay("2026-10-16", null, true),
  ...boardWeek.slice(5),
];

const cases: { name: string; week: DiaryWeekDay[]; targets: Targets }[] = [
  { name: "the sample week", week: boardWeek, targets },
  { name: "the over-target week", week: overTargetWeek, targets },
  { name: "the sample week with no target", week: boardWeek, targets: noTargets },
  {
    name: "a week with a complete day still to come",
    week: weekWithCompleteFutureDay,
    targets,
  },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T11:20:00Z"));
  backend.day = diaryDay("2026-10-15", []);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const weekCard = () =>
  screen.getByRole("link", { name: /^This week, open your weekly averages\./ });

/** What the calories bar shows inside a container: the caption, the basis, the overshoot and the meter, as text. */
const barOf = (container: HTMLElement) => {
  const inside = within(container);
  const meter = inside.queryByRole("meter", { name: WEEK_GRID.average, hidden: true });

  return {
    caption: inside.getByText(/^\s*· /).textContent.trim(),
    basis: inside.getByText(/with food logged$/).textContent,
    overshoot: inside.queryByText(/^\+[\d,]+ kcal$/)?.textContent ?? null,
    meter:
      meter === null
        ? null
        : {
            valueNow: meter.getAttribute("aria-valuenow"),
            valueText: meter.getAttribute("aria-valuetext"),
            outlined: meter.className.includes("box-shadow"),
          },
  };
};

describe("the This week card and the weekly averages page, from one fixture", () => {
  it.each(cases)(
    "should give the same average, basis and bar for $name",
    ({ week, targets: weekTargets }) => {
      backend.week = week;
      backend.targets = weekTargets;

      renderWithRouter(<WeekAveragesScreen />);
      const energy = within(screen.getByRole("table", { name: "Daily average" }))
        .getAllByRole("row")[0]
        ?.textContent.match(/^Energy([\d,]+)/)?.[1];
      const page = barOf(screen.getByRole("region", { name: "Daily average" }));
      cleanup();

      renderWithRouter(<DashboardScreen />);
      const card = barOf(weekCard());

      expect(energy).toBeDefined();
      expect(weekCard().getAttribute("aria-label")).toContain(`Average ${energy ?? ""} `);
      expect(card).toEqual(page);
      expect(card.caption).toBe("· Mon to yesterday");
    },
  );
});

describe("the This week card and the diary's Week view, from one fixture", () => {
  it.each(cases)(
    "should count the same days complete for $name",
    ({ week, targets: weekTargets }) => {
      backend.week = week;
      backend.targets = weekTargets;

      renderWithRouter(
        <ToastProvider>
          <DiaryScreen date={undefined} view="week" />
        </ToastProvider>,
      );
      const diaryDaysComplete = screen.getAllByText(WEEK_GRID.complete).length;
      cleanup();

      renderWithRouter(<DashboardScreen />);

      expect(weekCard().getAttribute("aria-label")).toContain(
        `${diaryDaysComplete} of 4 days complete.`,
      );
    },
  );
});
