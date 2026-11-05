import { RESTING_HEAT } from "@keylow/api-client";
import { BODY_MAP } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goldenMuscleList } from "./muscleListGolden";

import type { BodyMap, BodyMapDay, TrainingReadResult } from "@keylow/api-client";

import MuscleListPage from "@/app/(dashboard)/body-map/muscles/page";

const asked = vi.hoisted((): { list: { at?: string }[] } => ({ list: [] }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "Europe/London" }),
  useBodyMap: () => read(bodyMap),
  useMuscleList: (options: { at?: string }) => {
    asked.list.push(options);
    return read(goldenMuscleList());
  },
}));

const read = <Data,>(data: Data): TrainingReadResult<Data> => ({
  data,
  isPending: false,
  isError: false,
  error: null,
  refetch: () => Promise.resolve(),
});

// Thursday 15 October 2026 at 19:00 in London, the agreed golden week.
const THURSDAY_19_00 = "2026-10-15T18:00:00.000Z";
const days: BodyMapDay[] = ["12", "13", "14", "15", "16", "17", "18"].map((day) => ({
  date: `2026-10-${day}`,
  at: `2026-10-${day}T19:00:00.000Z`,
  isToday: day === "15",
  status: "rest",
  plannedDayName: null,
  sessionDayName: null,
  selectable: true,
}));
const bodyMap: BodyMap = {
  values: { ...RESTING_HEAT },
  computedAt: THURSDAY_19_00,
  days,
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};

const renderPage = async (parameters: Record<string, string | string[] | undefined>) =>
  render(await MuscleListPage({ searchParams: Promise.resolve(parameters) }));

describe("the muscle list page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    onlineManager.setOnline(true);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(THURSDAY_19_00));
    asked.list = [];
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("should show the muscle list under the title Muscles", async () => {
    await renderPage({});

    expect(screen.getByRole("heading", { level: 1, name: BODY_MAP.listTitle })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /, open details$/ })).toHaveLength(22);
  });

  it("should hand the day in the address to the list", async () => {
    await renderPage({ at: "2026-10-14" });

    expect(asked.list.at(-1)?.at).toBe("2026-10-14");
  });

  it("should read an address that holds more than one day as today", async () => {
    await renderPage({ at: ["2026-10-14", "2026-10-13"] });

    expect(asked.list.at(-1)?.at).toBeUndefined();
  });
});
