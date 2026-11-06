import { RESTING_HEAT } from "@keylow/api-client";
import { BODY_MAP } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render as renderIn, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goldenMuscleList } from "./muscleListGolden";

import type { BodyMap, BodyMapDay, TrainingReadResult } from "@keylow/api-client";
import type { MuscleDetail } from "@keylow/core/training";
import type { ReactElement } from "react";

import { BodyMapScreen } from "@/components/body/BodyMapScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

const reads = vi.hoisted((): { byView: Record<string, unknown> } => ({ byView: {} }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "Europe/London" }),
  useStartSessionAction: () => ({ start: vi.fn(), isStarting: false }),
  useBodyMap: (options: { view: string }) => reads.byView[options.view],
  useMuscleList: () => read(goldenMuscleList()),
  useMuscleScaleList: () => read<undefined>(undefined),
  useMuscleDetail: () => read(hamstringsDetail),
  useActiveRoutine: () => ({ data: null }),
}));

const render = (ui: ReactElement) => renderIn(ui, { wrapper: ToastProvider });

const read = <Data,>(data: Data | undefined): TrainingReadResult<Data> => ({
  data,
  isPending: data === undefined,
  isError: false,
  error: null,
  refetch: () => Promise.resolve(),
});

// Thursday 15 October 2026 at 19:00 in London, the agreed golden week.
const THURSDAY_19_00 = "2026-10-15T18:00:00.000Z";
const dayOf = (date: string, status: BodyMapDay["status"]): BodyMapDay => ({
  date,
  at: `${date}T19:00:00.000Z`,
  isToday: date === "2026-10-15",
  status,
  plannedDayName: "Push",
  sessionDayName: status === "logged" ? "Push" : null,
  selectable: true,
});
const bodyMap: BodyMap = {
  values: { ...RESTING_HEAT, hamstrings: 3, quads: 3 },
  computedAt: THURSDAY_19_00,
  days: [
    dayOf("2026-10-12", "logged"),
    dayOf("2026-10-15", "logged"),
    dayOf("2026-10-17", "planned"),
  ],
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};
const hamstringsDetail: MuscleDetail = {
  muscle: "hamstrings",
  heatPercent: 55,
  heatStep: 3,
  readyInHours: 31,
  weeklySets: {
    actual: 5.5,
    planned: 11,
    bands: { growingFromSets: 4, productiveFromSets: 10, highAboveSets: 20 },
    actualStatus: "growing",
    plannedStatus: "productive",
    volumeStatus: "growing",
  },
  targeting: { targeted: true, routineTrains: true, goalRanks: false },
  lastTrained: null,
};

const showBodyMap = (data: BodyMap) => {
  reads.byView = { actual: read(data), projected: read(data) };
};
const card = () => screen.getByRole("region", { name: BODY_MAP.title });
const gotIt = () => screen.queryByRole("button", { name: BODY_MAP.coachMark.dismiss });
const hint = () => within(card()).queryByText(BODY_MAP.coachMark.textWeb);
const openHamstringsSheet = () => {
  fireEvent.keyDown(screen.getByRole("button", { name: /^Hamstrings, [A-Za-z ]+$/ }), {
    key: "Enter",
  });
};

describe("the body map's first-open hint", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // The figure question was answered on an earlier visit, so only its own test sees it.
    window.localStorage.setItem("bodyMap.figure", "male");
    resetBodyFigureForTests();
    onlineManager.setOnline(true);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(THURSDAY_19_00));
    showBodyMap(bodyMap);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should show over the figures on the first open, with Got it", () => {
    render(<BodyMapScreen />);

    expect(hint()).toBeTruthy();
    expect(
      within(card())
        .getAllByRole("status")
        .map((status) => status.textContent),
    ).toContain(BODY_MAP.coachMark.textWeb);
    expect(gotIt()).toBeTruthy();
  });

  it("should go on Got it, and stay gone for good in this browser", () => {
    render(<BodyMapScreen />);

    fireEvent.click(screen.getByRole("button", { name: BODY_MAP.coachMark.dismiss }));

    expect(hint()).toBeNull();
    expect(gotIt()).toBeNull();
    expect(window.localStorage.getItem("bodyMap.hintSeen")).toBe("true");
    cleanup();
    render(<BodyMapScreen />);
    expect(hint()).toBeNull();
  });

  it("should show again in a second browser, which has nothing stored", () => {
    render(<BodyMapScreen />);
    fireEvent.click(screen.getByRole("button", { name: BODY_MAP.coachMark.dismiss }));
    cleanup();
    window.localStorage.removeItem("bodyMap.hintSeen");

    render(<BodyMapScreen />);

    expect(hint()).toBeTruthy();
  });

  it("should not show when it was dismissed on an earlier visit", () => {
    window.localStorage.setItem("bodyMap.hintSeen", "true");

    render(<BodyMapScreen />);

    expect(hint()).toBeNull();
  });

  it("should go when a muscle's sheet is opened from the figures", () => {
    render(<BodyMapScreen />);

    openHamstringsSheet();

    expect(screen.getByRole("dialog", { name: "Hamstrings" })).toBeTruthy();
    expect(hint()).toBeNull();
    expect(window.localStorage.getItem("bodyMap.hintSeen")).toBe("true");
  });

  it("should go when a muscle's sheet is opened from the Muscles card", () => {
    render(<BodyMapScreen />);

    fireEvent.click(
      within(screen.getByRole("region", { name: "Muscles" })).getByRole("button", {
        name: /^Hamstrings,/,
      }),
    );

    expect(screen.getByRole("dialog", { name: "Hamstrings" })).toBeTruthy();
    expect(hint()).toBeNull();
    expect(window.localStorage.getItem("bodyMap.hintSeen")).toBe("true");
  });

  it("should not go when the view is switched, so only the hint's own answers dismiss it", () => {
    render(<BodyMapScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Show projected" }));

    expect(hint()).toBeTruthy();
  });

  it("should wait for the figure question to be answered", () => {
    window.localStorage.removeItem("bodyMap.figure");
    resetBodyFigureForTests();
    render(<BodyMapScreen />);

    expect(hint()).toBeNull();
    fireEvent.click(
      within(screen.getByRole("dialog", { name: BODY_MAP.figureSetting.sheetTitle })).getByRole(
        "button",
        { name: BODY_MAP.figureSetting.done },
      ),
    );

    expect(hint()).toBeTruthy();
  });

  it("should not show in the nothing logged state, which has no figures to point at", () => {
    showBodyMap({ ...bodyMap, values: RESTING_HEAT, nothingLogged: true });

    render(<BodyMapScreen />);

    expect(hint()).toBeNull();
    expect(window.localStorage.getItem("bodyMap.hintSeen")).toBeNull();
  });

  it("should not show in the side by side view, and come back when it is turned off", () => {
    render(<BodyMapScreen />);

    fireEvent.click(screen.getByRole("button", { name: BODY_MAP.sideBySideName }));
    expect(hint()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: BODY_MAP.sideBySideName }));

    expect(hint()).toBeTruthy();
  });
});
