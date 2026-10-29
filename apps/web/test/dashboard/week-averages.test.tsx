import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { boardWeek, emptyWeek, noTargets, targets } from "../diary/support";
import { renderWithRouter } from "../ui/appRouter";

import type { DiaryWeekDay, Targets } from "@keylow/api-client";

import { WeekAveragesScreen } from "@/components/dashboard";

type Query<Data> = {
  data: Data | undefined;
  isError: boolean;
  refetch: () => Promise<unknown>;
};

const backend = vi.hoisted(
  (): {
    timeZone: Query<string | null>;
    targets: Query<Targets>;
    week: Query<DiaryWeekDay[]>;
    weekReads: string[];
  } => ({
    timeZone: { data: undefined, isError: false, refetch: () => Promise.resolve() },
    targets: { data: undefined, isError: false, refetch: () => Promise.resolve() },
    week: { data: undefined, isError: false, refetch: () => Promise.resolve() },
    weekReads: [],
  }),
);

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => backend.timeZone,
  useDiaryWeek: (weekStart: string) => {
    backend.weekReads.push(weekStart);
    return backend.week;
  },
  useTargets: () => backend.targets,
}));

const refetchWeek = vi.fn<() => Promise<unknown>>();

function show(week: DiaryWeekDay[], value: Targets = targets) {
  backend.week = { data: week, isError: false, refetch: refetchWeek };
  backend.targets = { data: value, isError: false, refetch: vi.fn() };
}

const rowsOf = (caption: string) =>
  within(screen.getByRole("table", { name: caption }))
    .getAllByRole("row")
    .map((row) => row.textContent);

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  // 11:20 on Thursday 15 October 2026, in the week of Monday 12 October.
  vi.setSystemTime(new Date("2026-10-15T11:20:00Z"));
  onlineManager.setOnline(true);
  backend.timeZone = { data: "UTC", isError: false, refetch: vi.fn() };
  backend.weekReads = [];
  show(boardWeek);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  onlineManager.setOnline(true);
});

describe("the weekly averages page", () => {
  it("should head the page and lead back to the Dashboard", () => {
    renderWithRouter(<WeekAveragesScreen />);

    expect(screen.getByRole("heading", { level: 1, name: "Weekly averages" })).toBeTruthy();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe(
      "/dashboard",
    );
    expect(screen.getByText("Week of Mon 12 Oct, Mon to today")).toBeTruthy();
  });

  it("should read the week that holds today", () => {
    renderWithRouter(<WeekAveragesScreen />);

    expect(new Set(backend.weekReads)).toEqual(new Set(["2026-10-12"]));
  });

  it("should list every nutrient's daily average against its target", () => {
    renderWithRouter(<WeekAveragesScreen />);

    expect(rowsOf("Daily average")).toEqual([
      "Energy1,681 / 2,200 kcal",
      "Protein126 / 160 g",
      "Carbohydrate176 / 220 g",
      "Fat49 / 70 g",
      "Fibrenot given",
      "Saturated fatnot given",
      "Sugarsnot given",
      "Saltnot given",
    ]);
  });

  it("should list the week so far as totals", () => {
    renderWithRouter(<WeekAveragesScreen />);

    expect(rowsOf("Week so far").slice(0, 4)).toEqual([
      "Energy6,725 kcal",
      "Protein504 g",
      "Carbohydrate703 g",
      "Fat194 g",
    ]);
  });

  it("should draw the calories average as the This week card does, over the days logged", () => {
    renderWithRouter(<WeekAveragesScreen />);

    expect(screen.getByRole("meter", { name: "Average" }).getAttribute("aria-valuetext")).toBe(
      "1,681 of 2,200 kilocalories",
    );
    expect(screen.getByText("From 4 days with food logged")).toBeTruthy();
  });

  it("should write the averages alone when no target is set", () => {
    show(boardWeek, noTargets);
    renderWithRouter(<WeekAveragesScreen />);

    expect(rowsOf("Daily average").slice(0, 2)).toEqual(["Energy1,681 kcal", "Protein126 g"]);
    expect(screen.queryByRole("meter", { name: "Average" })).toBeNull();
  });

  it("should say nothing is logged yet, with no tables, for an empty week", () => {
    show(emptyWeek);
    renderWithRouter(<WeekAveragesScreen />);

    expect(screen.getByText("Nothing logged this week yet.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("should link to the diary's week view for the days one by one", () => {
    const { push } = renderWithRouter(<WeekAveragesScreen />);

    fireEvent.click(screen.getByRole("link", { name: "See each day in the diary" }));

    expect(push).toHaveBeenCalledExactlyOnceWith("/diary?view=week", expect.anything());
  });

  it("should offer Try again when the week fails to load", () => {
    backend.week = { data: undefined, isError: true, refetch: refetchWeek };
    renderWithRouter(<WeekAveragesScreen />);

    expect(screen.getByText("Couldn't load this week")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(refetchWeek).toHaveBeenCalledOnce();
  });

  it("should say the week is not available offline when it has not arrived", () => {
    backend.week = { data: undefined, isError: false, refetch: refetchWeek };
    onlineManager.setOnline(false);
    renderWithRouter(<WeekAveragesScreen />);

    expect(screen.getByText("This week isn't available offline.")).toBeTruthy();
  });
});
