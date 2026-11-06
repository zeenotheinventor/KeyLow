import { RESTING_HEAT } from "@keylow/api-client";
import { BODY_MAP } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render as renderIn, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goldenMuscleList } from "./muscleListGolden";

import type { BodyMap, TrainingReadResult } from "@keylow/api-client";
import type {
  GapMuscleRow,
  MuscleDetail,
  MuscleId,
  MusclesAgainstPlan,
  MusclesByVolume,
  VolumeMuscleRow,
} from "@keylow/core/training";
import type { ReactElement } from "react";

import { BodyMapScreen } from "@/components/body/BodyMapScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

const reads = vi.hoisted(
  (): {
    byView: Record<string, unknown>;
    scaleList: Record<string, unknown>;
    scaleAsked: Record<string, unknown>[];
    detailAsked: { muscle: string; view: string }[];
  } => ({ byView: {}, scaleList: {}, scaleAsked: [], detailAsked: [] }),
);

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "Europe/London" }),
  useStartSessionAction: () => ({ start: vi.fn(), isStarting: false }),
  useBodyMap: (options: { view: string }) => reads.byView[options.view],
  useMuscleList: () => read(goldenMuscleList()),
  useMuscleScaleList: (options: Record<string, unknown>) => {
    reads.scaleAsked.push(options);
    return reads.scaleList[String(options["scale"])];
  },
  useMuscleDetail: (muscle: string, { view }: { view: string }) => {
    reads.detailAsked.push({ muscle, view });
    return read(hamstringsDetail);
  },
  useActiveRoutine: () => ({ data: null }),
}));

const render = (ui: ReactElement) => renderIn(ui, { wrapper: ToastProvider });

function read<Data>(data: Data | undefined, isError = false): TrainingReadResult<Data> {
  return {
    data,
    isPending: data === undefined && !isError,
    isError,
    error: null,
    refetch: () => Promise.resolve(),
  };
}

// Sunday 18 October 2026 at 20:00 in London, the moment of the Volume and Gap boards.
const SUNDAY_20_00 = "2026-10-18T19:00:00.000Z";
const bodyMap: BodyMap = {
  values: { ...RESTING_HEAT },
  computedAt: SUNDAY_20_00,
  days: [],
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};
const hamstringsDetail: MuscleDetail = {
  muscle: "hamstrings",
  heatPercent: 0,
  heatStep: 0,
  readyInHours: 0,
  weeklySets: {
    actual: 5.5,
    planned: 5.5,
    bands: { growingFromSets: 4, productiveFromSets: 10, highAboveSets: 20 },
    actualStatus: "growing",
    plannedStatus: "growing",
    volumeStatus: "growing",
  },
  targeting: { targeted: true, routineTrains: true, goalRanks: false },
  lastTrained: null,
};

// What `web-body · volume` draws: the twelve muscles at Growing or above, in Projected, and who is left out.
const volumeRow = (
  muscle: MuscleId,
  weeklySets: number,
  status: VolumeMuscleRow["status"],
): VolumeMuscleRow => ({ muscle, weeklySets, status });
const goldenVolume: MusclesByVolume = {
  scale: "volume",
  rows: [
    volumeRow("triceps", 15, "productive"),
    volumeRow("delt_front", 12, "productive"),
    volumeRow("delt_side", 11, "productive"),
    volumeRow("lats", 11, "productive"),
    volumeRow("chest_upper", 9.6, "growing"),
    volumeRow("chest_lower", 9, "growing"),
    volumeRow("biceps", 8.5, "growing"),
    volumeRow("traps_mid", 7.75, "growing"),
    volumeRow("delt_rear", 5.5, "growing"),
    volumeRow("hamstrings", 5.5, "growing"),
    volumeRow("quads", 5, "growing"),
    volumeRow("glute_max", 4, "growing"),
  ],
  moreMaintaining: 3,
  notTrained: 7,
};

// What `web-body · gap` draws.
const gapRow = (
  muscle: MuscleId,
  done: number,
  planned: number,
  status: GapMuscleRow["status"],
): GapMuscleRow => ({ muscle, done, planned, status });
const goldenGap: MusclesAgainstPlan = {
  scale: "gap",
  rows: [
    gapRow("triceps", 7.5, 15, "behind"),
    gapRow("delt_front", 6, 12, "behind"),
    gapRow("delt_side", 5.5, 11, "behind"),
    gapRow("chest_upper", 4.8, 9.6, "behind"),
    gapRow("chest_lower", 4.5, 9, "behind"),
    gapRow("lats", 11, 11, "on_plan"),
    gapRow("biceps", 8.5, 8.5, "on_plan"),
    gapRow("traps_mid", 7.75, 7.75, "on_plan"),
    gapRow("delt_rear", 5.5, 5.5, "on_plan"),
    gapRow("hamstrings", 5.5, 5.5, "on_plan"),
    gapRow("quads", 5, 5, "on_plan"),
    gapRow("glute_max", 4, 4, "on_plan"),
  ],
  moreOnPlan: 3,
  notInPlan: 7,
};

const musclesCard = () => screen.getByRole("region", { name: "Muscles" });
const rowNames = () =>
  within(musclesCard())
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"));
const chooseScale = (name: string) => {
  fireEvent.click(
    within(screen.getByRole("radiogroup", { name: BODY_MAP.scaleSwitch.name })).getByRole("radio", {
      name,
    }),
  );
};

describe("the Muscles card on Volume and Gap", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("bodyMap.figure", "male");
    // The first-open hint was dismissed on an earlier visit, so only its own tests see it.
    window.localStorage.setItem("bodyMap.hintSeen", "true");
    resetBodyFigureForTests();
    onlineManager.setOnline(true);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(SUNDAY_20_00));
    reads.scaleAsked = [];
    reads.detailAsked = [];
    reads.byView = { actual: read(bodyMap), projected: read(bodyMap) };
    reads.scaleList = { volume: read(goldenVolume), gap: read(goldenGap) };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Volume", () => {
    it("should write the board's line over the muscles at Growing or above", () => {
      render(<BodyMapScreen initialScale="volume" />);

      expect(within(musclesCard()).getByRole("heading", { name: "Muscles" })).toBeTruthy();
      expect(
        within(musclesCard()).getByText("Most sets first · 3 more maintaining, 7 not trained"),
      ).toBeTruthy();
    });

    it("should list the twelve rows of the board, most sets first, each named with its status in words", () => {
      render(<BodyMapScreen initialScale="volume" />);

      expect(rowNames()).toStrictEqual([
        "Triceps, 15 sets so far this week, productive, open details",
        "Front delts, 12 sets so far this week, productive, open details",
        "Side delts, 11 sets so far this week, productive, open details",
        "Lats, 11 sets so far this week, productive, open details",
        "Upper chest, 9.6 sets so far this week, growing, open details",
        "Lower chest, 9 sets so far this week, growing, open details",
        "Biceps, 8.5 sets so far this week, growing, open details",
        "Mid traps, 7.75 sets so far this week, growing, open details",
        "Rear delts, 5.5 sets so far this week, growing, open details",
        "Hamstrings, 5.5 sets so far this week, growing, open details",
        "Quads, 5 sets so far this week, growing, open details",
        "Glutes, 4 sets so far this week, growing, open details",
      ]);
    });

    it("should write the sets by Sunday in Projected, as the board does", () => {
      window.localStorage.setItem("bodyMap.view", "projected");
      render(<BodyMapScreen initialScale="volume" />);

      expect(rowNames()[0]).toBe("Triceps, 15 sets by Sunday, productive, open details");
    });

    it("should show each row's status and sets as the board draws them", () => {
      render(<BodyMapScreen initialScale="volume" />);

      const triceps = within(musclesCard()).getByRole("button", { name: /^Triceps,/ });
      expect(within(triceps).getByText("Productive")).toBeTruthy();
      expect(within(triceps).getByText("15")).toBeTruthy();
    });

    it("should read the list for the view on screen and the week and moment the screen reads", () => {
      render(<BodyMapScreen initialScale="volume" />);
      expect(reads.scaleAsked.at(-1)).toMatchObject({
        scale: "volume",
        view: "actual",
        weekStart: "2026-10-12",
        now: SUNDAY_20_00,
      });

      fireEvent.click(screen.getByRole("button", { name: "Show projected" }));

      expect(reads.scaleAsked.at(-1)).toMatchObject({ scale: "volume", view: "projected" });
    });
  });

  describe("Gap", () => {
    it("should write the board's line over the muscles behind or on plan", () => {
      render(<BodyMapScreen />);
      chooseScale("Gap");

      expect(
        within(musclesCard()).getByText("Furthest behind first · 3 more on plan, 7 not in plan"),
      ).toBeTruthy();
    });

    it("should list the twelve rows of the board, furthest behind first, each naming its status and figures", () => {
      render(<BodyMapScreen />);
      chooseScale("Gap");

      expect(rowNames()).toStrictEqual([
        "Triceps, 7.5 of 15 planned sets, behind, open details",
        "Front delts, 6 of 12 planned sets, behind, open details",
        "Side delts, 5.5 of 11 planned sets, behind, open details",
        "Upper chest, 4.8 of 9.6 planned sets, behind, open details",
        "Lower chest, 4.5 of 9 planned sets, behind, open details",
        "Lats, 11 of 11 planned sets, on plan, open details",
        "Biceps, 8.5 of 8.5 planned sets, on plan, open details",
        "Mid traps, 7.75 of 7.75 planned sets, on plan, open details",
        "Rear delts, 5.5 of 5.5 planned sets, on plan, open details",
        "Hamstrings, 5.5 of 5.5 planned sets, on plan, open details",
        "Quads, 5 of 5 planned sets, on plan, open details",
        "Glutes, 4 of 4 planned sets, on plan, open details",
      ]);
    });

    it("should show each row's status, sets and gap as the board draws them", () => {
      render(<BodyMapScreen />);
      chooseScale("Gap");

      const triceps = within(musclesCard()).getByRole("button", { name: /^Triceps,/ });
      expect(within(triceps).getByText("Behind · 7.5 of 15 sets")).toBeTruthy();
      expect(within(triceps).getByText("−7.5")).toBeTruthy();
      const lats = within(musclesCard()).getByRole("button", { name: /^Lats,/ });
      expect(within(lats).getByText("On plan · 11 of 11 sets")).toBeTruthy();
      expect(within(lats).getByText("0")).toBeTruthy();
    });

    it("should never write a muscle that has no plan as behind", () => {
      reads.scaleList["gap"] = read<MusclesAgainstPlan>({
        scale: "gap",
        rows: [gapRow("lats", 11, 11, "on_plan")],
        moreOnPlan: 0,
        notInPlan: 21,
      });
      render(<BodyMapScreen />);
      chooseScale("Gap");

      expect(rowNames()).toStrictEqual(["Lats, 11 of 11 planned sets, on plan, open details"]);
      expect(within(musclesCard()).queryByText(/^Behind ·/)).toBeNull();
    });

    it("should read the list from the plan so far, whatever view is saved", () => {
      window.localStorage.setItem("bodyMap.view", "projected");
      render(<BodyMapScreen />);
      chooseScale("Gap");

      expect(reads.scaleAsked.at(-1)).toMatchObject({ scale: "gap" });
    });
  });

  describe("switching scale", () => {
    it("should change the rows and the line with no new request and no skeleton", () => {
      render(<BodyMapScreen />);
      const loading = () =>
        screen.queryByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel });
      expect(within(musclesCard()).getByText("Hottest first · 10 more at rest")).toBeTruthy();

      chooseScale("Volume");
      expect(within(musclesCard()).getByText(/^Most sets first/)).toBeTruthy();
      expect(rowNames()[0]).toMatch(/^Triceps, 15 sets/);
      chooseScale("Gap");
      expect(within(musclesCard()).getByText(/^Furthest behind first/)).toBeTruthy();
      expect(rowNames()[0]).toMatch(/^Triceps, 7.5 of 15/);
      chooseScale("Heat");
      expect(within(musclesCard()).getByText("Hottest first · 10 more at rest")).toBeTruthy();

      expect(loading()).toBeNull();
      // The read is never switched off, so it stays on the rows the figures hold and asks for nothing new.
      expect(reads.scaleAsked.every(({ enabled }) => enabled !== false)).toBe(true);
    });
  });

  describe("opening a muscle", () => {
    it("should open that muscle's sheet on a click and on Enter", async () => {
      render(<BodyMapScreen initialScale="volume" />);

      fireEvent.click(within(musclesCard()).getByRole("button", { name: /^Triceps,/ }));
      expect(screen.getByRole("dialog", { name: "Triceps" })).toBeTruthy();
      fireEvent.keyDown(document, { key: "Escape" });
      within(musclesCard())
        .getByRole("button", { name: /^Quads,/ })
        .focus();
      await userEvent.keyboard("{Enter}");

      expect(screen.getByRole("dialog", { name: "Quads" })).toBeTruthy();
    });

    it("should read Actual in the sheet on Gap, though clicks on the figures are off there", () => {
      window.localStorage.setItem("bodyMap.view", "projected");
      render(<BodyMapScreen />);
      chooseScale("Gap");

      fireEvent.click(within(musclesCard()).getByRole("button", { name: /^Lats,/ }));

      expect(screen.getByRole("dialog", { name: "Lats" })).toBeTruthy();
      expect(reads.detailAsked.at(-1)).toStrictEqual({ muscle: "lats", view: "actual" });
    });

    it.each([["Volume"], ["Gap"]])(
      "should return focus to the row when Escape closes the sheet on %s",
      (scale) => {
        render(<BodyMapScreen />);
        chooseScale(scale);
        const row = within(musclesCard()).getByRole("button", { name: /^Hamstrings,/ });

        fireEvent.click(row);
        fireEvent.keyDown(document, { key: "Escape" });

        expect(screen.queryByRole("dialog")).toBeNull();
        expect(document.activeElement).toBe(row);
      },
    );
  });

  describe("the Muscle list link", () => {
    it.each([["Volume"], ["Gap"]])("should stay on %s and open the muscle list page", (scale) => {
      render(<BodyMapScreen />);
      chooseScale(scale);

      expect(
        screen.getByRole("link", { name: BODY_MAP.muscleListButton }).getAttribute("href"),
      ).toBe("/body-map/muscles");
    });
  });

  describe("while the list is not read", () => {
    it.each([["Volume"], ["Gap"]])(
      "should keep the figures and the link on %s, and wait for nothing",
      (scale) => {
        reads.scaleList = {
          volume: read<MusclesByVolume>(undefined),
          gap: read<MusclesAgainstPlan>(undefined),
        };
        render(<BodyMapScreen />);
        chooseScale(scale);

        expect(screen.queryByRole("region", { name: "Muscles" })).toBeNull();
        expect(screen.getByRole("link", { name: BODY_MAP.muscleListButton })).toBeTruthy();
        expect(
          screen.queryByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
        ).toBeNull();
      },
    );

    it("should keep the link when reading the rows fails", () => {
      reads.scaleList = { volume: read<MusclesByVolume>(undefined, true), gap: read(goldenGap) };
      render(<BodyMapScreen initialScale="volume" />);
      expect(screen.queryByRole("region", { name: "Muscles" })).toBeNull();
      expect(screen.getByRole("link", { name: BODY_MAP.muscleListButton })).toBeTruthy();
    });
  });

  describe("when nothing is logged", () => {
    it("should still draw the card on Volume, since a week with nothing logged is a plan to compare with", () => {
      const empty = { ...bodyMap, nothingLogged: true };
      reads.byView = { actual: read(empty), projected: read(empty) };
      reads.scaleList["volume"] = read<MusclesByVolume>({
        scale: "volume",
        rows: [],
        moreMaintaining: 0,
        notTrained: 22,
      });

      render(<BodyMapScreen initialScale="volume" />);

      expect(within(musclesCard()).getByText("Most sets first · 22 not trained")).toBeTruthy();
      expect(screen.getByRole("link", { name: BODY_MAP.muscleListButton })).toBeTruthy();
    });
  });
});
