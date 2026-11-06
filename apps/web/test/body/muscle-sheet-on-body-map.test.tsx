import { RESTING_HEAT } from "@keylow/api-client";
import { MUSCLE_SHEET, describeMuscleSheet } from "@keylow/core/copy";
import { BODY_ARTWORK } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render as renderIn,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActiveRoutine, BodyMap, BodyMapDay, TrainingReadResult } from "@keylow/api-client";
import type { MuscleSheetContext } from "@keylow/core/copy";
import type { MuscleDetail } from "@keylow/core/training";
import type { ReactElement } from "react";

import { BodyMapScreen } from "@/components/body/BodyMapScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

const reads = vi.hoisted(
  (): {
    byView: Record<string, unknown>;
    bodyMapAsked: unknown[];
    detailAsked: { muscle: string; options: Record<string, unknown> }[];
    routine: unknown;
  } => ({ byView: {}, bodyMapAsked: [], detailAsked: [], routine: null }),
);
const details = vi.hoisted((): { byMuscle: Record<string, unknown> } => ({ byMuscle: {} }));

const router = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "Europe/London" }),
  useStartSessionAction: () => ({ start: vi.fn(), isStarting: false }),
  useBodyMap: (options: { view: string }) => {
    reads.bodyMapAsked.push(options);
    return reads.byView[options.view];
  },
  useMuscleDetail: (muscle: string, options: Record<string, unknown>) => {
    reads.detailAsked.push({ muscle, options });
    return details.byMuscle[muscle];
  },
  useActiveRoutine: () => ({ data: reads.routine }),
  // The Muscles card has its own test file, so the list is never read here.
  useMuscleList: () => ({
    data: undefined,
    isPending: true,
    isError: false,
    error: null,
    refetch: () => Promise.resolve(),
  }),
  useMuscleScaleList: () => ({
    data: undefined,
    isPending: true,
    isError: false,
    error: null,
    refetch: () => Promise.resolve(),
  }),
}));

const render = (ui: ReactElement) => renderIn(ui, { wrapper: ToastProvider });

const refetch = vi.fn<() => Promise<unknown>>(() => Promise.resolve());
const read = <Data,>(data: Data): TrainingReadResult<Data> => ({
  data,
  isPending: false,
  isError: false,
  error: null,
  refetch,
});

// Thursday 15 October 2026 at 19:00 in London, the agreed golden week.
const THURSDAY_19_00 = "2026-10-15T18:00:00.000Z";

const dayOf = (date: string, status: BodyMapDay["status"], plannedDayName: string): BodyMapDay => ({
  date,
  at: `${date}T19:00:00.000Z`,
  isToday: date === "2026-10-15",
  status,
  plannedDayName,
  sessionDayName: status === "logged" ? plannedDayName : null,
  selectable: true,
});

// The routine's shoulder press works the side delts at half a set, which the weighting note names.
const routine: ActiveRoutine = {
  id: "routine-1",
  name: "Push Pull Legs",
  activatedAt: null,
  days: [
    {
      id: "day-1",
      name: "Push",
      position: 0,
      weekday: 0,
      exercises: [
        {
          id: "routine-exercise-1",
          position: 0,
          exercise_id: "military-press",
          target_sets: 3,
          target_rir: null,
          exercise: {
            id: "military-press",
            name: "Shoulder press",
            equipment: "barbell",
            mechanic: "compound",
          },
          muscles: [{ muscle_id: "delt_side", role: "secondary", weight: 0.5 }],
        },
      ],
    },
  ],
};
const bodyMap: BodyMap = {
  values: { ...RESTING_HEAT, hamstrings: 3, quads: 3 },
  computedAt: THURSDAY_19_00,
  days: [
    dayOf("2026-10-12", "logged", "Push"),
    dayOf("2026-10-15", "logged", "Legs"),
    dayOf("2026-10-17", "planned", "Push"),
  ],
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};

const sideDelts: MuscleDetail = {
  muscle: "delt_side",
  heatPercent: 3,
  heatStep: 0,
  readyInHours: 0,
  weeklySets: {
    actual: 5.5,
    planned: 11,
    bands: { growingFromSets: 4, productiveFromSets: 10, highAboveSets: 20 },
    actualStatus: "growing",
    plannedStatus: "productive",
    volumeStatus: "growing",
  },
  targeting: { targeted: true, routineTrains: true, goalRanks: false },
  lastTrained: {
    localDate: "2026-10-12",
    sessionId: "session-1",
    routineDayName: "Push",
    exercises: [{ exerciseId: "lateral-raise", name: "Side lateral raise", sets: 4 }],
  },
};
const hamstrings: MuscleDetail = {
  ...sideDelts,
  muscle: "hamstrings",
  heatPercent: 55,
  heatStep: 3,
  readyInHours: 31,
};
const abs: MuscleDetail = {
  ...sideDelts,
  muscle: "abs",
  weeklySets: {
    ...sideDelts.weeklySets,
    actual: 0,
    planned: 0,
    actualStatus: "not_trained",
    plannedStatus: "not_trained",
    volumeStatus: "not_trained",
  },
  targeting: { targeted: false, routineTrains: false, goalRanks: false },
  lastTrained: null,
};

const context: MuscleSheetContext = {
  weekStart: "2026-10-12",
  upcomingSessions: [{ localDate: "2026-10-17", routineDayName: "Push" }],
  heatWindowDays: 14,
  weightingExample: { exerciseName: "shoulder press", weight: 0.5 },
};

const muscleButton = (name: string, value = "Rested") =>
  screen.getByRole("button", { name: `${name}, ${value}` });
const viewLabel = () =>
  within(screen.getByRole("region", { name: "Body map" })).getByRole("status");
const press = (element: Element, x = 50, y = 50) =>
  fireEvent.pointerDown(element, { clientX: x, clientY: y, button: 0, isPrimary: true });
const release = (element: Element, x = 50, y = 50) =>
  fireEvent.pointerUp(element, { clientX: x, clientY: y, button: 0, isPrimary: true });
const hold = (milliseconds: number) => {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
};

describe("the muscle sheet on the body map", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    vi.setSystemTime(new Date(THURSDAY_19_00));
    window.localStorage.clear();
    window.localStorage.setItem("bodyMap.figure", "male");
    // The first-open hint was dismissed on an earlier visit, so only its own tests see it.
    window.localStorage.setItem("bodyMap.hintSeen", "true");
    resetBodyFigureForTests();
    onlineManager.setOnline(true);
    reads.detailAsked = [];
    reads.bodyMapAsked = [];
    router.push.mockReset();
    reads.routine = routine;
    reads.byView = {
      actual: read(bodyMap),
      projected: read({ ...bodyMap, values: { ...bodyMap.values, quads: 4 } }),
    };
    details.byMuscle = {
      delt_side: read(sideDelts),
      hamstrings: read(hamstrings),
      abs: read(abs),
    };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("the two layers of figures", () => {
    it("should give only the shown view's figures muscle buttons, none in the hidden layer", () => {
      render(<BodyMapScreen />);

      const musclesDrawn = [BODY_ARTWORK.male.front, BODY_ARTWORK.male.back].reduce(
        (count, side) => count + Object.keys(side.muscles).length,
        0,
      );
      expect(
        screen.getAllByRole("button", { name: /, (Rested|Ready|Warm|Hot)$/, hidden: true }),
      ).toHaveLength(musclesDrawn);
    });

    it("should hand the buttons to the other layer when the view switches", () => {
      render(<BodyMapScreen />);

      fireEvent.click(screen.getByRole("button", { name: "Show projected" }));

      expect(muscleButton("Quads", "Very hot")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Quads, Hot", hidden: true })).toBeNull();
    });
  });

  describe("how it opens", () => {
    it("should open on a hold of 500 milliseconds, as a dialog named for the muscle, and not toggle the view", () => {
      render(<BodyMapScreen />);
      const sideDeltsButton = muscleButton("Side delts");

      press(sideDeltsButton);
      hold(499);
      expect(screen.queryByRole("dialog")).toBeNull();
      hold(1);
      release(sideDeltsButton);
      fireEvent.click(sideDeltsButton);

      expect(screen.getByRole("dialog", { name: "Side delts" })).toBeTruthy();
      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
    });

    it("should return focus to the muscle that a hold opened when Escape closes the sheet", () => {
      render(<BodyMapScreen />);
      const sideDeltsButton = muscleButton("Side delts");

      // A pointer does not focus a drawn muscle in every browser, so nothing here focuses it first.
      press(sideDeltsButton);
      hold(500);
      release(sideDeltsButton);
      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(sideDeltsButton);
    });

    it("should only toggle the view on a short click", () => {
      render(<BodyMapScreen />);
      const sideDeltsButton = muscleButton("Side delts");

      press(sideDeltsButton);
      release(sideDeltsButton);
      fireEvent.click(sideDeltsButton);
      hold(2000);

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(within(viewLabel()).getByText("Projected")).toBeTruthy();
    });

    it("should neither open nor toggle on a drag", () => {
      render(<BodyMapScreen />);
      const sideDeltsButton = muscleButton("Side delts");

      press(sideDeltsButton);
      fireEvent.pointerMove(sideDeltsButton, { clientX: 120, clientY: 50, isPrimary: true });
      hold(2000);
      release(sideDeltsButton, 120, 50);
      fireEvent.click(sideDeltsButton, { clientX: 120, clientY: 50 });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
    });

    it("should open on Enter and return focus to the muscle when Escape closes it", () => {
      render(<BodyMapScreen />);
      const sideDeltsButton = muscleButton("Side delts");
      sideDeltsButton.focus();

      fireEvent.keyDown(sideDeltsButton, { key: "Enter" });
      expect(screen.getByRole("dialog", { name: "Side delts" })).toBeTruthy();
      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(sideDeltsButton);
    });

    it("should close on its Close button", () => {
      render(<BodyMapScreen />);
      const sideDeltsButton = muscleButton("Side delts");
      sideDeltsButton.focus();
      fireEvent.keyDown(sideDeltsButton, { key: " " });

      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));

      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("while it is open", () => {
    it("should outline the muscle and fade the rest of the figure", () => {
      render(<BodyMapScreen />);
      const sideDeltsButton = muscleButton("Side delts");
      sideDeltsButton.focus();
      fireEvent.keyDown(sideDeltsButton, { key: "Enter" });

      expect(sideDeltsButton.getAttribute("class")).toContain("stroke-text-primary");
      expect(sideDeltsButton.getAttribute("opacity")).toBe("1");
      const quads = screen.getByRole("button", { name: "Quads, Hot", hidden: true });
      expect(quads.getAttribute("opacity")).toBe("0.4");
    });

    it("should leave the figure as it was when the sheet closes", () => {
      render(<BodyMapScreen />);
      const quads = muscleButton("Quads", "Hot");
      const sideDeltsButton = muscleButton("Side delts");
      sideDeltsButton.focus();
      fireEvent.keyDown(sideDeltsButton, { key: "Enter" });
      fireEvent.keyDown(document, { key: "Escape" });

      expect(quads.getAttribute("opacity")).toBe("1");
    });
  });

  describe("what it reads and shows", () => {
    it("should read the detail of the muscle for the view on screen", () => {
      window.localStorage.setItem("bodyMap.view", "projected");
      render(<BodyMapScreen />);
      const sideDeltsButton = muscleButton("Side delts");

      fireEvent.keyDown(sideDeltsButton, { key: "Enter" });

      const asked = reads.detailAsked.find(({ muscle }) => muscle === "delt_side");
      // The sheet reads for the view and the moment the screen reads, whole.
      const screenMoment = reads.bodyMapAsked.at(-1);
      expect(asked?.options).toMatchObject({
        view: "projected",
        weekStart: "2026-10-12",
        now: THURSDAY_19_00,
      });
      expect(screenMoment).toMatchObject({ weekStart: "2026-10-12", now: THURSDAY_19_00 });
    });

    it("should make no read of a muscle until a sheet is open", () => {
      render(<BodyMapScreen />);

      expect(reads.detailAsked).toHaveLength(0);
    });

    it("should write the sheet of a muscle with sets: the done figure with its band, the planned figure and the bar", () => {
      render(<BodyMapScreen />);

      fireEvent.keyDown(muscleButton("Side delts"), { key: "Enter" });

      const copy = describeMuscleSheet(sideDelts, context);
      if (copy.kind !== "trained") {
        throw new Error("The side delts have sets");
      }
      const dialog = within(screen.getByRole("dialog", { name: "Side delts" }));
      expect(dialog.getByText("5.5")).toBeTruthy();
      expect(dialog.getByText("done · Growing")).toBeTruthy();
      expect(dialog.getByText("11 planned")).toBeTruthy();
      expect(dialog.getByText(copy.subtitle)).toBeTruthy();
      expect(dialog.getByText(copy.weeklySets.position)).toBeTruthy();
      expect(dialog.getByText(copy.weightingNote)).toBeTruthy();
      expect(dialog.getByRole("img", { name: copy.weeklySets.barName })).toBeTruthy();
      for (const label of ["4", "10", "20"]) {
        expect(dialog.getByText(label)).toBeTruthy();
      }
    });

    it("should say when a muscle will be ready", () => {
      render(<BodyMapScreen />);

      fireEvent.keyDown(muscleButton("Hamstrings", "Hot"), { key: "Enter" });

      expect(within(screen.getByRole("dialog")).getByText("In 31 hours")).toBeTruthy();
    });

    it("should write the Not trained sheet: the two tiles, the explanation, last trained and the footnote", () => {
      render(<BodyMapScreen />);

      fireEvent.keyDown(muscleButton("Abs"), { key: "Enter" });

      const copy = describeMuscleSheet(abs, context);
      if (copy.kind !== "not_trained") {
        throw new Error("The abs have no sets");
      }
      const dialog = within(screen.getByRole("dialog", { name: "Abs" }));
      expect(dialog.getByText(copy.subtitle)).toBeTruthy();
      expect(dialog.getByText(copy.thisWeek.label)).toBeTruthy();
      expect(dialog.getByText(/Any working set for abs moves them to Maintaining\./)).toBeTruthy();
      expect(dialog.getByText(copy.lastTrained.value)).toBeTruthy();
      expect(dialog.getByText(copy.footnote)).toBeTruthy();
      expect(dialog.queryByRole("img")).toBeNull();
    });

    it("should keep the muscle's name as the heading while the detail is read, and say it is loading", () => {
      details.byMuscle.abs = {
        data: undefined,
        isPending: true,
        isError: false,
        error: null,
        refetch,
      };
      render(<BodyMapScreen />);

      fireEvent.keyDown(muscleButton("Abs"), { key: "Enter" });

      const dialog = within(screen.getByRole("dialog", { name: "Abs" }));
      expect(dialog.getByRole("heading", { name: "Abs" })).toBeTruthy();
      expect(dialog.getByRole("status")).toBeTruthy();
    });

    it("should offer Try again when the detail could not be read, and read it again", () => {
      details.byMuscle.abs = {
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error("read failed"),
        refetch,
      };
      render(<BodyMapScreen />);
      fireEvent.keyDown(muscleButton("Abs"), { key: "Enter" });

      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Try again" }),
      );

      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });
  describe("Edit routine on the Not trained sheet", () => {
    const openAbsSheet = () => {
      const absButton = muscleButton("Abs");
      absButton.focus();
      fireEvent.keyDown(absButton, { key: "Enter" });
      return absButton;
    };
    const editRoutineButton = () =>
      within(screen.getByRole("dialog", { name: "Abs" })).queryByRole("button", {
        name: MUSCLE_SHEET.editRoutine,
      });

    const pressEditRoutine = () => {
      const button = editRoutineButton();
      if (button === null) {
        throw new Error("The Not trained sheet has an Edit routine button");
      }
      fireEvent.click(button);
    };

    it("should sit between Last trained and the footnote, as the board draws it", () => {
      render(<BodyMapScreen />);

      openAbsSheet();

      const button = editRoutineButton();
      const copy = describeMuscleSheet(abs, context);
      if (button === null || copy.kind !== "not_trained") {
        throw new Error("The Not trained sheet has an Edit routine button");
      }
      const dialog = screen.getByRole("dialog", { name: "Abs" });
      const lastTrained = within(dialog).getByText(copy.lastTrained.value);
      const footnote = within(dialog).getByText(copy.footnote);
      expect(
        lastTrained.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        button.compareDocumentPosition(footnote) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("should close the sheet and open the active routine's editor", () => {
      render(<BodyMapScreen />);
      openAbsSheet();

      pressEditRoutine();

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(router.push).toHaveBeenCalledExactlyOnceWith("/train/routines/routine-1");
    });

    it("should open the create page when there is no active routine", () => {
      reads.routine = null;
      render(<BodyMapScreen />);
      openAbsSheet();

      pressEditRoutine();

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(router.push).toHaveBeenCalledExactlyOnceWith("/train/routines/new");
    });

    it("should draw no button until the routine read has answered, so a routine is never taken for none", () => {
      reads.routine = undefined;
      render(<BodyMapScreen />);

      openAbsSheet();

      expect(screen.getByRole("dialog", { name: "Abs" })).toBeTruthy();
      expect(editRoutineButton()).toBeNull();
    });

    it("should give focus back to the muscle as the sheet closes", () => {
      render(<BodyMapScreen />);
      const absButton = openAbsSheet();

      pressEditRoutine();

      expect(document.activeElement).toBe(absButton);
    });

    it("should not offer it on the sheet of a muscle with sets", () => {
      render(<BodyMapScreen />);

      fireEvent.keyDown(muscleButton("Side delts"), { key: "Enter" });

      expect(
        within(screen.getByRole("dialog", { name: "Side delts" })).queryByRole("button", {
          name: MUSCLE_SHEET.editRoutine,
        }),
      ).toBeNull();
    });
  });
});
