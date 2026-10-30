import { GOAL_ERRORS, GOAL_SUMMARY } from "@keylow/core/copy";
import { BODY_ARTWORK, MUSCLE_IDS, VOLUME_STATUSES } from "@keylow/core/training";
import { act, cleanup, render, screen, userEvent, within } from "@testing-library/react-native";

import GoalSummaryRoute from "../../app/goal/summary";
import { GoalDraftProvider } from "../../components/GoalQuestionnaire";
import { ToastProvider } from "../../components/ui";
import { resetBodyFigureForTests } from "../../lib/bodyFigure/testing";
import { goalQuestionPath } from "../../lib/goalRoutes";
import { trainPath } from "../../lib/routineRoutes";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { fillsIn, volumeFill } from "../support/figureFills";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { pressTwiceInTheSameMoment } from "../support/sameTickPress";
import { viewsDrawn } from "../support/viewsDrawn";

import type { GoalDraftAnswers } from "../../components/GoalQuestionnaire";
import type { ActiveRoutine } from "@keylow/api-client";
import type { BodyArtworkFigure, GoalAnswers, MuscleId } from "@keylow/core/training";
import type { useState } from "react";

const mockStorageItems = new Map<string, string>();
// While set, the stored figure is never read, which is what leaves the body figure not ready.
let mockStorageNeverReads = false;
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) =>
      mockStorageNeverReads
        ? new Promise<null>(() => undefined)
        : Promise.resolve(mockStorageItems.get(key) ?? null),
    setItem: (key: string, value: string) => {
      mockStorageItems.set(key, value);
      return Promise.resolve();
    },
  },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

const mockSave = jest.fn<Promise<unknown>, [GoalAnswers]>();
let mockRoutine: ActiveRoutine | null = null;
// The routine read as the query hands it out: a pending read has no data, a failed one has no data and an error.
let mockRoutineStatus: "ready" | "pending" | "error" = "ready";
jest.mock("@keylow/api-client", () => {
  const { useState: useStateHook } = jest.requireActual<{ useState: typeof useState }>("react");
  return {
    useActiveRoutine: () =>
      mockRoutineStatus === "ready"
        ? { data: mockRoutine, isPending: false, isError: false }
        : {
            data: undefined,
            isPending: mockRoutineStatus === "pending",
            isError: mockRoutineStatus === "error",
          },
    useSaveTrainingGoals: () => {
      const [isPending, setIsPending] = useStateHook(false);
      return {
        isPending,
        mutateAsync: async (answers: GoalAnswers) => {
          setIsPending(true);
          try {
            return await mockSave(answers);
          } finally {
            setIsPending(false);
          }
        },
      };
    },
  };
});

// The golden V-taper answers of the board: look better, V-taper, 4 days, 60 minutes, full gym, intermediate.
const goldenAnswers: GoalAnswers = {
  goal: "aesthetic",
  focus: ["v_taper"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: [
    "barbell",
    "dumbbell",
    "kettlebell",
    "cable",
    "machine",
    "smith_machine",
    "ez_bar",
    "band",
    "bodyweight",
  ],
  experience: "intermediate",
};

// A routine whose one exercise works the given muscles, which is what makes them kept up.
const routineTraining = (muscles: readonly MuscleId[]): ActiveRoutine => ({
  id: "routine",
  name: "Routine",
  activatedAt: null,
  days: [
    {
      id: "day",
      name: "Day",
      position: 0,
      weekday: null,
      exercises: [
        {
          id: "planned",
          position: 0,
          exercise_id: "exercise",
          target_sets: 3,
          target_rir: 2,
          exercise: {
            id: "exercise",
            name: "Everything",
            equipment: "cable",
            mechanic: "isolation",
          },
          muscles: muscles.map((muscle_id) => ({ muscle_id, role: "primary", weight: 1 })),
        },
      ],
    },
  ],
});

const summaryTree = (answers: GoalDraftAnswers) => (
  <ThemeProvider fixedPreference="dark">
    <ToastProvider>
      <GoalDraftProvider initialAnswers={answers}>
        <GoalSummaryRoute />
      </GoalDraftProvider>
    </ToastProvider>
  </ThemeProvider>
);

async function renderSummary(answers: GoalDraftAnswers = goldenAnswers) {
  await render(summaryTree(answers));
}

function drawnBody(figureName: string, side: "front" | "back"): BodyArtworkFigure | null {
  const [figure] = screen.queryAllByRole("img", { name: figureName });
  const drawn = (["male", "female"] as const).filter(
    (body) =>
      figure?.queryAll(
        (node) =>
          node.type === "RNSVGPath" &&
          Object.getOwnPropertyDescriptor(node.props, "d")?.value ===
            BODY_ARTWORK[body][side].outline,
      ).length === 1,
  );
  return drawn[0] ?? null;
}

describe("the priorities summary", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/GoalQuestionnaire"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetBodyFigureForTests();
    mockStorageItems.clear();
    mockSave.mockReset();
    mockSave.mockResolvedValue({});
    mockRoutine = null;
    mockRoutineStatus = "ready";
    mockStorageNeverReads = false;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should draw the board's title, answers line, rows and legend for the golden answers", async () => {
    // The golden week's routine works every muscle but the obliques, which is what leaves them out.
    mockRoutine = routineTraining(MUSCLE_IDS.filter((muscle) => muscle !== "obliques"));
    await renderSummary();

    expect(screen.getByRole("heading", { name: GOAL_SUMMARY.title })).toBeOnTheScreen();
    expect(
      screen.getByText(
        "From your answers: look better, V-taper, 4 days a week, 60 minutes, full gym, intermediate.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText("Side delts, lats and upper chest come first")).toBeOnTheScreen();
    expect(screen.getByText("Everything else in your routine is kept up")).toBeOnTheScreen();
    expect(screen.getByText("Obliques get no direct work")).toBeOnTheScreen();
    expect(screen.getByText("4 days a week, about 60 minutes, full gym")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Gold muscles come first, blue ones are kept up. Grey ones are not targeted.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: GOAL_SUMMARY.saveAction })).toBeOnTheScreen();
  });

  it("should count a muscle the routine trains as kept up and not as left out", async () => {
    mockRoutine = routineTraining(MUSCLE_IDS.filter((muscle) => muscle !== "obliques"));
    await renderSummary();
    expect(screen.getByText("Obliques get no direct work")).toBeOnTheScreen();
    await cleanup();

    mockRoutine = routineTraining(MUSCLE_IDS);
    await renderSummary();

    expect(screen.queryByText(/get no direct work/)).not.toBeOnTheScreen();
  });

  it("should leave out every muscle the goal and the routine both skip when there is no routine", async () => {
    await renderSummary();

    expect(
      screen.getByText(
        "Upper traps, abs, obliques, side glutes, adductors, shins and neck get no direct work",
      ),
    ).toBeOnTheScreen();
  });

  it("should name the Your priorities card as a region", async () => {
    await renderSummary();

    expect(screen.getByLabelText(GOAL_SUMMARY.prioritiesSectionName)).toHaveProp("role", "region");
  });

  describe("while the routine is being read", () => {
    beforeEach(() => {
      mockRoutineStatus = "pending";
    });

    it("should draw no rows and no figures, so no muscle shows as left out before the routine is known", async () => {
      await renderSummary();

      expect(
        screen.queryByText("Side delts, lats and upper chest come first"),
      ).not.toBeOnTheScreen();
      expect(screen.queryByText(/get no direct work/)).not.toBeOnTheScreen();
      expect(screen.queryByText(/is kept up/)).not.toBeOnTheScreen();
      expect(screen.queryByText("4 days a week, about 60 minutes, full gym")).not.toBeOnTheScreen();
      expect(
        screen.queryByRole("img", { name: GOAL_SUMMARY.bodyMapFrontName }),
      ).not.toBeOnTheScreen();
      expect(
        screen.queryByRole("img", { name: GOAL_SUMMARY.bodyMapBackName }),
      ).not.toBeOnTheScreen();
      // Their space is held, so the legend does not move when they arrive.
      expect(viewsDrawn({ width: 70, height: 154 })).toHaveLength(2);
    });

    it("should keep the answers line, the legend and Save goal live", async () => {
      await renderSummary();

      expect(
        screen.getByText(
          "From your answers: look better, V-taper, 4 days a week, 60 minutes, full gym, intermediate.",
        ),
      ).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Gold muscles come first, blue ones are kept up. Grey ones are not targeted.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: GOAL_SUMMARY.saveAction })).toBeEnabled();
      expect(screen.getByLabelText(GOAL_SUMMARY.prioritiesSectionName)).toBeOnTheScreen();
    });

    it("should save the answers without waiting for the routine", async () => {
      const user = userEvent.setup();
      await renderSummary();

      await user.press(screen.getByRole("button", { name: GOAL_SUMMARY.saveAction }));

      expect(mockSave).toHaveBeenCalledWith(goldenAnswers);
      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
    });

    it("should draw the rows and figures with the routine's kept-up result once it arrives", async () => {
      await renderSummary();
      expect(screen.queryByText(/get no direct work/)).not.toBeOnTheScreen();

      mockRoutine = routineTraining(MUSCLE_IDS);
      mockRoutineStatus = "ready";
      await screen.rerender(summaryTree(goldenAnswers));

      expect(screen.getByText("Side delts, lats and upper chest come first")).toBeOnTheScreen();
      expect(screen.getByText("Everything else in your routine is kept up")).toBeOnTheScreen();
      expect(screen.queryByText(/get no direct work/)).not.toBeOnTheScreen();
      expect(
        await screen.findByRole("img", { name: GOAL_SUMMARY.bodyMapFrontName }),
      ).toBeOnTheScreen();
    });
  });

  it("should draw the result for no routine when the routine cannot be read", async () => {
    mockRoutineStatus = "error";
    await renderSummary();

    expect(
      screen.getByText(
        "Upper traps, abs, obliques, side glutes, adductors, shins and neck get no direct work",
      ),
    ).toBeOnTheScreen();
    expect(
      await screen.findByRole("img", { name: GOAL_SUMMARY.bodyMapFrontName }),
    ).toBeOnTheScreen();
  });

  describe("the body figures", () => {
    it("should draw each figure 70 points wide", async () => {
      await renderSummary();

      await screen.findByRole("img", { name: GOAL_SUMMARY.bodyMapFrontName });

      // A figure's box is as wide as it is drawn and as tall as the 200 by 440 drawing makes it from that.
      const boxes = viewsDrawn({ width: 70, height: 154 });
      expect(boxes.map((box) => within(box).getAllByRole("img").length)).toStrictEqual([1, 1]);
    });

    it("should draw no figure while the stored figure is not read, and keep their 70 by 154 space", async () => {
      mockStorageNeverReads = true;
      await renderSummary();

      expect(
        screen.queryByRole("img", { name: GOAL_SUMMARY.bodyMapFrontName }),
      ).not.toBeOnTheScreen();
      expect(
        screen.queryByRole("img", { name: GOAL_SUMMARY.bodyMapBackName }),
      ).not.toBeOnTheScreen();
      expect(screen.getByText("Side delts, lats and upper chest come first")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Gold muscles come first, blue ones are kept up. Grey ones are not targeted.",
        ),
      ).toBeOnTheScreen();
      expect(viewsDrawn({ width: 70, height: 154 })).toHaveLength(2);
    });
  });

  it("should fill the two figures with the volume fills: productive, maintaining and not trained", async () => {
    await renderSummary();

    const front = await screen.findByRole("img", { name: GOAL_SUMMARY.bodyMapFrontName });
    const fills = fillsIn(front, "front");
    expect(fills.get("delt_side")).toStrictEqual(
      volumeFill("dark", VOLUME_STATUSES.indexOf("productive")),
    );
    expect(fills.get("chest_lower")).toStrictEqual(
      volumeFill("dark", VOLUME_STATUSES.indexOf("maintaining")),
    );
    expect(screen.getByRole("img", { name: GOAL_SUMMARY.bodyMapBackName })).toBeOnTheScreen();
  });

  it("should draw the female figure with the same fills when that is the setting", async () => {
    await renderSummary();
    const maleFront = await screen.findByRole("img", { name: GOAL_SUMMARY.bodyMapFrontName });
    const maleFills = fillsIn(maleFront, "front");
    await cleanup();
    resetBodyFigureForTests();
    mockStorageItems.set("bodyMap.figure", "female");

    await renderSummary();

    const femaleFront = await screen.findByRole("img", { name: GOAL_SUMMARY.bodyMapFrontName });
    expect(drawnBody(GOAL_SUMMARY.bodyMapFrontName, "front")).toBe("female");
    expect(fillsIn(femaleFront, "front", "female")).toStrictEqual(maleFills);
  });

  it("should send the answers once when Save goal is pressed twice at once, then leave the flow", async () => {
    await renderSummary();

    await pressTwiceInTheSameMoment(screen.getByRole("button", { name: GOAL_SUMMARY.saveAction }));

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(goldenAnswers);
    expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
  });

  it("should show busy while the save is pending and stop responding", async () => {
    let finish: (value: unknown) => void = () => undefined;
    mockSave.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const user = userEvent.setup();
    await renderSummary();

    await user.press(screen.getByRole("button", { name: GOAL_SUMMARY.saveAction }));

    const saving = await screen.findByRole("button", { busy: true });
    expect(within(saving).getByText(GOAL_SUMMARY.saveAction)).toBeOnTheScreen();
    expect(saving).toBeBusy();
    expect(routerMock.parentGoBack).not.toHaveBeenCalled();
    await act(() => {
      finish({});
    });
    expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
  });

  it("should stay on the summary and show the error toast when the save fails, then save again", async () => {
    mockSave.mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    await renderSummary();

    await user.press(screen.getByRole("button", { name: GOAL_SUMMARY.saveAction }));

    expect(await screen.findByText(GOAL_ERRORS.save)).toBeOnTheScreen();
    expect(routerMock.parentGoBack).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: GOAL_SUMMARY.title })).toBeOnTheScreen();

    await user.press(screen.getByRole("button", { name: GOAL_SUMMARY.saveAction }));
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
  });

  it("should go back to the questions with the back control", async () => {
    const user = userEvent.setup();
    await renderSummary();

    await user.press(screen.getByRole("button", { name: GOAL_SUMMARY.backLabel }));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });

  it("should send an incomplete draft to its first open question and save nothing", async () => {
    await renderSummary({ goal: "aesthetic", focus: [], days_per_week: 4 });

    expect(routerMock.redirect).toHaveBeenCalledWith(goalQuestionPath(4));
    expect(screen.queryByRole("button", { name: GOAL_SUMMARY.saveAction })).not.toBeOnTheScreen();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("should leave to the Train tab when the flow is the only screen there is", async () => {
    routerMock.hasParentNavigator = false;
    await renderSummary();

    await pressTwiceInTheSameMoment(screen.getByRole("button", { name: GOAL_SUMMARY.saveAction }));

    expect(routerMock.replace).toHaveBeenCalledWith(trainPath());
  });
});
