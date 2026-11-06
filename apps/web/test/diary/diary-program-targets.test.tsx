import { KeyLowProvider, keys } from "@keylow/api-client";
import { PROGRAM_TOAST } from "@keylow/core/copy";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { boardWeek, diaryDay, sampleDay } from "./support";
import { renderWithRouter } from "../ui/appRouter";

import type { Targets } from "@keylow/api-client";
import type { DayOfWeekKcal } from "@keylow/core/engine";
import type { ReactElement } from "react";

import { DashboardScreen } from "@/components/dashboard";
import { DiaryScreen } from "@/components/diary";
import { ToastProvider } from "@/components/ui/Toast";
import { announceNewTargets, takeNewTargets } from "@/lib/checkinToast";

const { push } = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@/lib/foodLogActions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/foodLogActions")>()),
  useFoodLogActions: () => ({
    openAddFood: vi.fn(),
    openEditEntry: vi.fn(),
    setViewedDate: vi.fn(),
    viewedDate: undefined,
  }),
}));

// The targets read is the real hook, over a cache that holds the programme's week. Only the reads that
// belong to other tickets' data are faked.
const days = vi.hoisted(() => new Map<string, unknown>());

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "UTC", isError: false, refetch: () => Promise.resolve() }),
  useDiaryDay: (date: string) =>
    days.get(date) ?? { data: undefined, isError: false, refetch: () => Promise.resolve() },
  useDiaryWeek: () => ({ data: boardWeek, isError: false, refetch: () => Promise.resolve() }),
  useCompleteDays: () => ({ data: [], isError: false, refetch: () => Promise.resolve() }),
  useDashboardBodyMap: () => ({
    data: undefined,
    isPending: true,
    isError: false,
    error: null,
    refetch: () => Promise.resolve(),
  }),
}));

// A programme whose week runs from 2,000 kcal on Monday to 2,600 on Sunday in steps of 100, with 2,350 as the
// week's figure, so no day's own figure is the week's.
const DAY_BY_DAY_KCAL: DayOfWeekKcal = [2000, 2100, 2200, 2300, 2400, 2500, 2600];
const PROGRAMME_TARGETS: Targets = {
  kcal: 2350,
  protein_g: 160,
  carbs_g: 220,
  fat_g: 70,
  source: "engine",
  dowCaloriesKcal: DAY_BY_DAY_KCAL,
};

// Thursday 15 October 2026, so today's figure is the fourth, and the Wednesday before is the third.
const TODAY = "2026-10-15";
const WEDNESDAY = "2026-10-14";

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});

function showDay(date: string) {
  days.set(date, {
    data: diaryDay(date, sampleDay(date)),
    isError: false,
    refetch: () => Promise.resolve(),
  });
}

function withTargets(ui: ReactElement, targets: Targets = PROGRAMME_TARGETS) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(keys.profiles.targets, targets);
  return (
    <KeyLowProvider client={client} queryClient={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </KeyLowProvider>
  );
}

const caloriesOf = (label: RegExp) =>
  screen.getByRole("button", { name: label }).getAttribute("aria-label");

beforeEach(() => {
  days.clear();
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date("2026-10-15T11:20:00Z"));
  Element.prototype.scrollIntoView = vi.fn();
  showDay(TODAY);
  showDay(WEDNESDAY);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  takeNewTargets();
  push.mockReset();
});

describe("a check-in's new targets on the Diary", () => {
  it("should show the toast on the Day view when a check-in has set a new target", () => {
    announceNewTargets();

    render(withTargets(<DiaryScreen date={undefined} view="day" />));

    expect(screen.getByText(PROGRAM_TOAST.message)).toBeTruthy();
  });

  it("should show the toast on the Week view too", () => {
    announceNewTargets();

    render(withTargets(<DiaryScreen date={undefined} view="week" />));

    expect(screen.getByText(PROGRAM_TOAST.message)).toBeTruthy();
  });

  it("should show it when the check-in lands while the Diary is open, and take See why to the Programme page", () => {
    render(withTargets(<DiaryScreen date={undefined} view="day" />));
    expect(screen.queryByText(PROGRAM_TOAST.message)).toBeNull();

    act(() => {
      announceNewTargets();
    });
    fireEvent.click(screen.getByRole("button", { name: PROGRAM_TOAST.actionLabel }));

    expect(push).toHaveBeenCalledExactlyOnceWith("/more/program");
  });

  it("should say nothing when no check-in set a new target", () => {
    render(withTargets(<DiaryScreen date={undefined} view="day" />));

    expect(screen.queryByText(PROGRAM_TOAST.message)).toBeNull();
  });
});

describe("each day's own calorie target", () => {
  describe("on the Diary", () => {
    it("should show today's weekday figure, not the week's", () => {
      render(withTargets(<DiaryScreen date={undefined} view="day" />));

      expect(caloriesOf(/^Targets\./)).toContain("Calories: 1,039 of 2,300 kilocalories");
    });

    it("should show the viewed day's own figure when another day is open, not today's", () => {
      render(withTargets(<DiaryScreen date={WEDNESDAY} view="day" />));

      expect(caloriesOf(/^Targets\./)).toContain("of 2,200 kilocalories");
    });

    it("should keep the figures on screen when the person steps to another day, with no loading in between", () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
      });
      queryClient.setQueryData(keys.profiles.targets, PROGRAMME_TARGETS);
      const tree = (date: string | undefined) => (
        <KeyLowProvider client={client} queryClient={queryClient}>
          <ToastProvider>
            <DiaryScreen date={date} view="day" />
          </ToastProvider>
        </KeyLowProvider>
      );
      const { rerender } = render(tree(undefined));
      expect(caloriesOf(/^Targets\./)).toContain("of 2,300 kilocalories");

      rerender(tree(WEDNESDAY));

      expect(caloriesOf(/^Targets\./)).toContain("of 2,200 kilocalories");
    });

    it("should show the one figure on every day for manual targets", () => {
      render(
        withTargets(<DiaryScreen date={WEDNESDAY} view="day" />, {
          kcal: 2150,
          protein_g: 160,
          carbs_g: 220,
          fat_g: 70,
          source: "manual",
        }),
      );

      expect(caloriesOf(/^Targets\./)).toContain("of 2,150 kilocalories");
    });
  });

  describe("on the Dashboard", () => {
    it("should show today's weekday figure, not the week's", () => {
      renderWithRouter(withTargets(<DashboardScreen />));

      expect(
        screen.getByRole("link", { name: /^Today, open the diary\./ }).getAttribute("aria-label"),
      ).toContain("remaining of 2,300.");
    });
  });
});
