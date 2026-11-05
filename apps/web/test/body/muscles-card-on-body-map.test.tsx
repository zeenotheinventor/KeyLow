import { RESTING_HEAT } from "@keylow/api-client";
import { BODY_MAP } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render as renderIn, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goldenMuscleList } from "./muscleListGolden";

import type { BodyMap, TrainingReadResult } from "@keylow/api-client";
import type { MuscleDetail, MuscleListGroup } from "@keylow/core/training";
import type { ReactElement } from "react";

import { BodyMapScreen } from "@/components/body/BodyMapScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

const reads = vi.hoisted(
  (): {
    byView: Record<string, unknown>;
    list: unknown;
    listAsked: Record<string, unknown>[];
  } => ({ byView: {}, list: undefined, listAsked: [] }),
);

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "Europe/London" }),
  useStartSessionAction: () => ({ start: vi.fn(), isStarting: false }),
  useBodyMap: (options: { view: string }) => reads.byView[options.view],
  useMuscleList: (options: Record<string, unknown>) => {
    reads.listAsked.push(options);
    return reads.list;
  },
  // Volume's and Gap's rows have their own test file.
  useMuscleScaleList: () => read<undefined>(undefined),
  useMuscleDetail: () => ({
    data: hamstringsDetail,
    isPending: false,
    isError: false,
    error: null,
    refetch: () => Promise.resolve(),
  }),
  useActiveRoutine: () => ({ data: null }),
}));

const render = (ui: ReactElement) => renderIn(ui, { wrapper: ToastProvider });

const read = <Data,>(data: Data | undefined, isError = false): TrainingReadResult<Data> => ({
  data,
  isPending: data === undefined && !isError,
  isError,
  error: null,
  refetch: () => Promise.resolve(),
});

// Thursday 15 October 2026 at 19:00 in London, the agreed golden week.
const THURSDAY_19_00 = "2026-10-15T18:00:00.000Z";
const bodyMap: BodyMap = {
  values: { ...RESTING_HEAT, hamstrings: 3, quads: 3 },
  computedAt: THURSDAY_19_00,
  days: [],
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

const showList = (groups: MuscleListGroup[] | undefined = goldenMuscleList()) => {
  reads.list = read(groups);
};
const musclesCard = () => screen.getByRole("region", { name: "Muscles" });
const rowNames = () =>
  within(musclesCard())
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? button.textContent);

describe("the Muscles card on the body map", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("bodyMap.figure", "male");
    resetBodyFigureForTests();
    onlineManager.setOnline(true);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(THURSDAY_19_00));
    reads.listAsked = [];
    reads.byView = { actual: read(bodyMap), projected: read(bodyMap) };
    showList();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should write the board's line over the muscles above rest", () => {
    render(<BodyMapScreen />);

    expect(within(musclesCard()).getByRole("heading", { name: "Muscles" })).toBeTruthy();
    expect(within(musclesCard()).getByText("Hottest first · 10 more at rest")).toBeTruthy();
  });

  it("should list the 12 muscles above rest, hottest first, named as the mobile list names them", () => {
    render(<BodyMapScreen />);

    expect(rowNames()).toStrictEqual([
      "Hamstrings, heat 55 percent, hot, ready in 31 hours, open details",
      "Quads, heat 50 percent, hot, ready in 27 hours, open details",
      "Glutes, heat 40 percent, hot, ready in 19 hours, open details",
      "Lats, heat 24 percent, ready, ready now, open details",
      "Lower back, heat 21 percent, ready, ready now, open details",
      "Calves, heat 20 percent, ready, ready now, open details",
      "Mid traps, heat 17 percent, ready, ready now, open details",
      "Biceps, heat 14 percent, ready, ready now, open details",
      "Rear delts, heat 9 percent, ready, ready now, open details",
      "Upper chest, heat 5 percent, ready, ready now, open details",
      "Lower chest, heat 5 percent, ready, ready now, open details",
      "Triceps, heat 5 percent, ready, ready now, open details",
    ]);
  });

  it("should show each row's status and percent as the board draws them", () => {
    render(<BodyMapScreen />);

    const hamstrings = within(musclesCard()).getByRole("button", { name: /^Hamstrings,/ });
    expect(within(hamstrings).getByText("Hot · ready in 31 h")).toBeTruthy();
    expect(within(hamstrings).getByText("55 %")).toBeTruthy();
  });

  it("should read the list for the view on screen and the moment the screen reads", () => {
    render(<BodyMapScreen />);
    expect(reads.listAsked.at(-1)).toMatchObject({
      view: "actual",
      weekStart: "2026-10-12",
      now: THURSDAY_19_00,
    });

    fireEvent.click(screen.getByRole("button", { name: "Show projected" }));

    expect(reads.listAsked.at(-1)).toMatchObject({ view: "projected" });
  });

  describe("opening a muscle", () => {
    it("should open that muscle's sheet on a click", () => {
      render(<BodyMapScreen />);

      fireEvent.click(within(musclesCard()).getByRole("button", { name: /^Hamstrings,/ }));

      expect(screen.getByRole("dialog", { name: "Hamstrings" })).toBeTruthy();
    });

    it("should open it on Enter", async () => {
      render(<BodyMapScreen />);
      within(musclesCard())
        .getByRole("button", { name: /^Quads,/ })
        .focus();

      await userEvent.keyboard("{Enter}");

      expect(screen.getByRole("dialog", { name: "Quads" })).toBeTruthy();
    });

    it("should return focus to the row when Escape closes the sheet, though a click did not focus it", () => {
      render(<BodyMapScreen />);
      const row = within(musclesCard()).getByRole("button", { name: /^Hamstrings,/ });

      // A click does not focus a button in every browser, so nothing here focuses the row first.
      fireEvent.click(row);
      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(row);
    });
  });

  describe("the Muscle list link", () => {
    it("should open the muscle list page, so every muscle is reachable without a gesture", () => {
      render(<BodyMapScreen />);

      expect(
        screen.getByRole("link", { name: BODY_MAP.muscleListButton }).getAttribute("href"),
      ).toBe("/body-map/muscles");
    });

    it("should be there before the list is read, and when reading it failed", () => {
      reads.list = read<MuscleListGroup[]>(undefined);
      const { unmount } = render(<BodyMapScreen />);
      expect(screen.getByRole("link", { name: BODY_MAP.muscleListButton })).toBeTruthy();
      expect(screen.queryByRole("region", { name: "Muscles" })).toBeNull();
      unmount();

      reads.list = read<MuscleListGroup[]>(undefined, true);
      render(<BodyMapScreen />);
      expect(screen.getByRole("link", { name: BODY_MAP.muscleListButton })).toBeTruthy();
    });
  });

  describe("when nothing is logged", () => {
    it("should leave out the card and the link, as the mobile screen does", () => {
      const empty = { ...bodyMap, nothingLogged: true };
      reads.byView = { actual: read(empty), projected: read(empty) };

      render(<BodyMapScreen />);

      expect(screen.queryByRole("region", { name: "Muscles" })).toBeNull();
      expect(screen.queryByRole("link", { name: BODY_MAP.muscleListButton })).toBeNull();
    });
  });
});
