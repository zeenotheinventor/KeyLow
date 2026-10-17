import { WEEK_GRID } from "@keylow/core/copy";
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { boardWeek, diaryDay, noTargets, overTargetWeek, targets, weekDay } from "../diary/support";
import { renderWithRouter } from "../ui/appRouter";

import type { DiaryDay, DiaryWeekDay, Targets } from "@keylow/api-client";

import { DashboardScreen } from "@/components/dashboard";
import { DiaryScreen } from "@/components/diary";
import { ToastProvider } from "@/components/ui/Toast";

type Backend = {
  week: DiaryWeekDay[];
  targets: Targets;
  day: DiaryDay | undefined;
};

const backend = vi.hoisted((): Backend => ({
  week: [],
  targets: { kcal: null, protein_g: null, carbs_g: null, fat_g: null },
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

describe("the This week card and the diary's Week view, from one fixture", () => {
  it.each(cases)("should give the same figures for $name", ({ week, targets: weekTargets }) => {
    backend.week = week;
    backend.targets = weekTargets;

    renderWithRouter(
      <ToastProvider>
        <DiaryScreen date={undefined} view="week" />
      </ToastProvider>,
    );
    const averageCell = screen.getByRole("listitem", { name: WEEK_GRID.average });
    const diaryAverage = within(averageCell).getByText(/^[\d,]+$/).textContent;
    const diaryDaysComplete = screen.getAllByText(WEEK_GRID.complete).length;
    cleanup();

    renderWithRouter(<DashboardScreen />);
    const cardName = screen
      .getByRole("link", { name: /^This week, open the week\./ })
      .getAttribute("aria-label");

    expect(cardName).toContain(`Average ${diaryAverage} `);
    expect(cardName).toContain(`${diaryDaysComplete} of 4 days complete.`);
  });
});
