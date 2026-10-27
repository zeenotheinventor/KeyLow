import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import {
  ROUTINE_DISCARD,
  ROUTINE_EDITOR,
  ROUTINE_MOVE,
  ROUTINE_SAVE_FAILED,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { View } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RoutineEditor } from "../components/RoutineEditor";
import { ToastProvider } from "../components/ui";
import { routinesPath } from "../lib/routineRoutes";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, resetDiaryBackend } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { stubScrollViewAt } from "./support/focusedField";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { pushPullLegsDraft } from "./support/routineEditorFixtures";
import { pushPullLegsExerciseNames } from "./support/routineExerciseFixtures";
import {
  resetRoutineStore,
  routineStore,
  routineStoreClient,
  seedRoutine,
} from "./support/routineStoreBackend";
import { resetTrainBackend } from "./support/trainBackend";

import type { RoutineDraft } from "@keylow/core/training";
import type { QueryClient } from "@tanstack/react-query";

// The routine editor's checks, reordering and Save, with the real hooks over a database that keeps what is saved.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
// What the navigator is told about holding the screen back, so a test can see whether it would hold.
const mockHold: { isHeld: boolean; onHeld: () => void } = {
  isHeld: false,
  onHeld: () => undefined,
};
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (isHeld: boolean, onHeld: () => void) => {
    mockHold.isHeld = isHeld;
    mockHold.onHeld = onHeld;
  },
}));

setUpTests();

let queryClient: QueryClient;
type User = ReturnType<typeof userEvent.setup>;

// A stored Push Pull Legs, so Save replaces it, and a routine with nothing in it, which Save creates.
function showEditor(options: { stored: boolean }) {
  queryClient = createDiaryQueryClient();
  const routineId = options.stored
    ? seedRoutine(pushPullLegsDraft, pushPullLegsExerciseNames)
    : undefined;
  const draft: RoutineDraft | undefined =
    routineId === undefined ? undefined : routineStore.routines.get(routineId)?.draft;
  const user = userEvent.setup();
  return render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={routineStoreClient} queryClient={queryClient}>
        <ToastProvider>
          <RoutineEditor
            exerciseNames={pushPullLegsExerciseNames}
            initialDraft={draft}
            routineId={routineId}
          />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  ).then(() => ({ user, routineId }));
}

const nameField = () => screen.getByLabelText(ROUTINE_EDITOR.nameLabel);
const saveButton = () => screen.getByRole("button", { name: ROUTINE_EDITOR.saveAction });
const sets = (exerciseName: string) => screen.getByLabelText(`Sets for ${exerciseName}`);
const reps = (exerciseName: string) => screen.getByLabelText(`Reps for ${exerciseName}`);
const rir = (exerciseName: string) => screen.getByLabelText(`RIR for ${exerciseName}`);

async function openDay(user: User, dayName: string) {
  const [button] = screen.getAllByRole("button", { name: `Show ${dayName} exercises` });
  if (button === undefined) {
    throw new Error(`There is no Show button for ${dayName}`);
  }
  await user.press(button);
}

/** The board's invalid routine: no name, Legs moved onto Tuesday with Pull, and the leg press with 0 sets and 12 to 10 reps. */
async function makeTheInvalidBoard(user: User) {
  await fireEvent.changeText(nameField(), "");
  await user.press(screen.getByRole("button", { name: "Weekday for Legs: Thursday" }));
  await user.press(screen.getByRole("radio", { name: "Tue" }));
  await openDay(user, "Legs");
  await fireEvent.changeText(sets("Leg press"), "0");
  await fireEvent.changeText(reps("Leg press"), "12 to 10");
}

const BANNER_OF_THREE = "Fix the 3 problems marked below to save this routine.";
const LEG_PRESS_LINE = "Enter sets from 1 to 20. The lowest reps cannot be above the highest.";

describe("saving a routine in the editor", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RoutineEditor",
      "components/RoutineDayCard",
      "components/RoutineDayExercises",
      "components/RoutineExerciseRow",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    resetTrainBackend();
    resetRoutineStore();
    mockHold.isHeld = false;
    mockHold.onHeld = () => undefined;
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("the problems of a routine", () => {
    it("should show none before Save is pressed, even for a routine with no name", async () => {
      const { user } = await showEditor({ stored: false });

      await user.press(screen.getByRole("button", { name: ROUTINE_DAY_ADD }));

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(saveButton()).toBeEnabled();
    });

    it("should mark the invalid board's three problems, count them in the banner, and save nothing", async () => {
      const { user } = await showEditor({ stored: true });
      await makeTheInvalidBoard(user);

      await user.press(saveButton());

      expect(screen.getByText(BANNER_OF_THREE)).toBeOnTheScreen();
      expect(screen.getByText("Give the routine a name.")).toBeOnTheScreen();
      expect(screen.getByText("Only one day can be on Tuesday.")).toBeOnTheScreen();
      expect(screen.getByText(LEG_PRESS_LINE)).toBeOnTheScreen();
      expect(routineStore.saves).toHaveLength(0);
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
    });

    it("should mark the fields that are wrong and not the others in the leg press row", async () => {
      const { user } = await showEditor({ stored: true });
      await makeTheInvalidBoard(user);

      await user.press(saveButton());

      expect(sets("Leg press").props.accessibilityHint).toContain("Enter sets from 1 to 20.");
      expect(reps("Leg press").props.accessibilityHint).toContain(
        "The lowest reps cannot be above the highest.",
      );
      expect(rir("Leg press").props.accessibilityHint).toBeUndefined();
    });

    it("should open a closed day that holds a problem, and show the weekday problem of a closed day", async () => {
      const { user } = await showEditor({ stored: true });
      await makeTheInvalidBoard(user);
      await user.press(screen.getByRole("button", { name: "Hide Legs exercises" }));
      expect(screen.queryByLabelText("Sets for Leg press")).not.toBeOnTheScreen();

      await user.press(saveButton());

      expect(screen.getByText("Only one day can be on Tuesday.")).toBeOnTheScreen();
      expect(sets("Leg press")).toBeOnTheScreen();
    });

    it("should clear each problem, and the count in the banner, as it is fixed", async () => {
      const { user } = await showEditor({ stored: true });
      await makeTheInvalidBoard(user);
      await user.press(saveButton());

      await fireEvent.changeText(nameField(), "Push Pull Legs");
      expect(screen.queryByText("Give the routine a name.")).not.toBeOnTheScreen();
      expect(
        screen.getByText("Fix the 2 problems marked below to save this routine."),
      ).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Weekday for Legs: Tuesday" }));
      await user.press(screen.getByRole("radio", { name: "Thu" }));
      expect(screen.queryByText("Only one day can be on Tuesday.")).not.toBeOnTheScreen();
      expect(
        screen.getByText("Fix the problem marked below to save this routine."),
      ).toBeOnTheScreen();

      await fireEvent.changeText(sets("Leg press"), "3");
      await fireEvent.changeText(reps("Leg press"), "10 to 12");
      expect(screen.queryByText(LEG_PRESS_LINE)).not.toBeOnTheScreen();
      expect(screen.queryByText(/problem/)).not.toBeOnTheScreen();
    });

    it("should save once every problem is fixed", async () => {
      const { user } = await showEditor({ stored: true });
      await makeTheInvalidBoard(user);
      await user.press(saveButton());
      await fireEvent.changeText(nameField(), "Push Pull Legs");
      await user.press(screen.getByRole("button", { name: "Weekday for Legs: Tuesday" }));
      await user.press(screen.getByRole("radio", { name: "Thu" }));
      await fireEvent.changeText(sets("Leg press"), "3");
      await fireEvent.changeText(reps("Leg press"), "10 to 12");

      await user.press(saveButton());

      await waitFor(() => {
        expect(routerMock.dismissTo).toHaveBeenCalledWith(routinesPath());
      });
      expect(routineStore.saves).toHaveLength(1);
    });

    it("should give an emptied Sets and an unfinished range the sentences of their rules", async () => {
      const { user } = await showEditor({ stored: true });
      await openDay(user, "Legs");
      await fireEvent.changeText(sets("Leg press"), "");
      await fireEvent.changeText(reps("Leg press"), "8 to");
      await fireEvent.changeText(rir("Leg press"), "11");

      await user.press(saveButton());

      expect(
        screen.getByText(
          "Enter sets from 1 to 20. Enter the highest reps from 1 to 100. Enter RIR from 0 to 10, or leave it empty.",
        ),
      ).toBeOnTheScreen();
      expect(
        screen.getByText("Fix the problem marked below to save this routine."),
      ).toBeOnTheScreen();
    });

    it("should mark a day with no name beside its name field", async () => {
      const { user } = await showEditor({ stored: true });
      await openDay(user, "Pull");
      await fireEvent.changeText(screen.getByLabelText("Day name for Pull"), "  ");

      await user.press(saveButton());

      expect(screen.getByText("Give the day a name.")).toBeOnTheScreen();
    });

    it("should scroll to the first problem, clear of the top of the screen", async () => {
      const { user } = await showEditor({ stored: true });
      await makeTheInvalidBoard(user);
      // The name is the first problem. The scroll view starts 100 down the window and the name is 340 down it.
      const scrollTo = stubScrollViewAt(100, 600);
      jest.spyOn(View.prototype, "measureInWindow").mockImplementation((answer) => {
        answer(0, 340, 390, 60);
      });

      await user.press(saveButton());

      await waitFor(() => {
        expect(scrollTo).toHaveBeenCalledWith({ y: 340 - 100 - 12, animated: true });
      });
    });
  });

  describe("moving days and exercises", () => {
    const savedDayNames = () => routineStore.saves[0]?.days.map((day) => day.name);
    const savedLegsExercises = () =>
      routineStore.saves[0]?.days
        .find((day) => day.name === "Legs")
        ?.exercises.map((exercise) => pushPullLegsExerciseNames[exercise.exercise_id]);

    it("should move a day up from its menu, and save the new order", async () => {
      const { user } = await showEditor({ stored: true });
      await openDay(user, "Pull");

      await user.press(screen.getByRole("button", { name: "Options for Pull" }));
      await user.press(screen.getByRole("button", { name: ROUTINE_MOVE.upAction }));
      await user.press(saveButton());

      await waitFor(() => {
        expect(routineStore.saves).toHaveLength(1);
      });
      expect(savedDayNames()).toStrictEqual(["Pull", "Push", "Legs", "Push"]);
    });

    it("should keep the moved day's id and weekday with it", async () => {
      const { user } = await showEditor({ stored: true });
      await openDay(user, "Pull");

      await user.press(screen.getByRole("button", { name: "Options for Pull" }));
      await user.press(screen.getByRole("button", { name: ROUTINE_MOVE.upAction }));
      await user.press(saveButton());

      await waitFor(() => {
        expect(routineStore.saves).toHaveLength(1);
      });
      expect(routineStore.saves[0]?.days[0]).toMatchObject({
        id: pushPullLegsDraft.days[1]?.id,
        weekday: 1,
      });
    });

    it("should dim Move up on the first day and Move down on the last", async () => {
      const { user } = await showEditor({ stored: true });
      await openDay(user, "Pull");
      await user.press(screen.getByRole("button", { name: "Options for Pull" }));
      await user.press(screen.getByRole("button", { name: ROUTINE_MOVE.upAction }));
      await user.press(screen.getByRole("button", { name: "Options for Pull" }));

      expect(screen.getByRole("button", { name: ROUTINE_MOVE.upAction })).toBeDisabled();
      expect(screen.getByRole("button", { name: ROUTINE_MOVE.downAction })).toBeEnabled();
    });

    it("should move an exercise down from its menu, and save the new order", async () => {
      const { user } = await showEditor({ stored: true });
      await openDay(user, "Legs");

      await user.press(screen.getByRole("button", { name: "Options for Barbell squat" }));
      await user.press(screen.getByRole("button", { name: ROUTINE_MOVE.downAction }));
      await user.press(saveButton());

      await waitFor(() => {
        expect(routineStore.saves).toHaveLength(1);
      });
      expect(savedLegsExercises()).toStrictEqual([
        "Romanian deadlift",
        "Barbell squat",
        "Leg press",
        "Seated leg curl",
        "Standing calf raise",
      ]);
    });

    it("should dim Move up on the first exercise and Move down on the last", async () => {
      const { user } = await showEditor({ stored: true });
      await openDay(user, "Legs");

      await user.press(screen.getByRole("button", { name: "Options for Barbell squat" }));
      expect(screen.getByRole("button", { name: ROUTINE_MOVE.upAction })).toBeDisabled();
      await user.press(screen.getByRole("button", { name: ROUTINE_MOVE.downAction }));
      await user.press(screen.getByRole("button", { name: "Options for Standing calf raise" }));

      expect(screen.getByRole("button", { name: ROUTINE_MOVE.downAction })).toBeDisabled();
    });

    it("should take an exercise out from its menu", async () => {
      const { user } = await showEditor({ stored: true });
      await openDay(user, "Legs");

      await user.press(screen.getByRole("button", { name: "Options for Leg press" }));
      await user.press(screen.getByRole("button", { name: "Remove Leg press" }));

      expect(screen.queryByLabelText("Sets for Leg press")).not.toBeOnTheScreen();
    });
  });

  describe("Save", () => {
    it("should save the routine under its id with the names trimmed, and leave for the routines list", async () => {
      const { user, routineId } = await showEditor({ stored: true });
      await fireEvent.changeText(nameField(), "  Push Pull Legs 2  ");

      await user.press(saveButton());

      await waitFor(() => {
        expect(routerMock.dismissTo).toHaveBeenCalledWith(routinesPath());
      });
      expect(routineStore.saves).toHaveLength(1);
      expect(routineStore.saves[0]).toMatchObject({ routineId, name: "Push Pull Legs 2" });
      expect(routineStore.saves[0]?.days).toHaveLength(4);
    });

    // The press that crashed on Android (KEY-733): Save on a routine nothing was changed in. The Save label's
    // row must stay a view of its own through the press, the wait and the answer, or the label changes parent.
    it("should leave an unchanged routine for the routines list once, with the Save label's row a view of its own throughout", async () => {
      jest.useFakeTimers();
      let answerSave: () => void = () => undefined;
      routineStore.holdSave = new Promise<void>((resolve) => {
        answerSave = resolve;
      });
      await showEditor({ stored: true });
      expect(within(saveButton()).getByTestId("button-row")).toHaveProp("collapsable", false);

      await fireEvent.press(saveButton());
      await act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(screen.getByRole("progressbar", { name: "Loading" })).toBeOnTheScreen();
      const busySave = screen.getByRole("button", {
        name: new RegExp(ROUTINE_EDITOR.saveAction),
        busy: true,
      });
      expect(within(busySave).getByTestId("button-row")).toHaveProp("collapsable", false);

      answerSave();
      await act(() => {
        jest.advanceTimersByTime(1);
      });
      await waitFor(() => {
        expect(routerMock.dismissTo).toHaveBeenCalledTimes(1);
      });

      expect(routerMock.dismissTo).toHaveBeenCalledWith(routinesPath());
      expect(screen.queryByRole("progressbar", { name: "Loading" })).not.toBeOnTheScreen();
      expect(within(saveButton()).getByTestId("button-row")).toHaveProp("collapsable", false);
      expect(routineStore.saves).toHaveLength(1);
      jest.useRealTimers();
    });

    it("should create a routine, with no id, from the new routine editor", async () => {
      const { user } = await showEditor({ stored: false });
      await fireEvent.changeText(nameField(), "Full body");

      await user.press(saveButton());

      await waitFor(() => {
        expect(routineStore.saves).toHaveLength(1);
      });
      expect(routineStore.saves[0]).toMatchObject({ routineId: null, name: "Full body", days: [] });
    });

    it("should not hold the screen back once the routine is saved, though the draft changed", async () => {
      const { user } = await showEditor({ stored: true });
      await fireEvent.changeText(nameField(), "Push Pull Legs 2");
      expect(mockHold.isHeld).toBe(true);

      await user.press(saveButton());

      await waitFor(() => {
        expect(routerMock.dismissTo).toHaveBeenCalledTimes(1);
      });
      expect(mockHold.isHeld).toBe(false);
    });

    it("should keep the draft, say the routine did not save, and leave nothing, when the save fails", async () => {
      routineStore.failsSave = true;
      const { user } = await showEditor({ stored: true });
      await fireEvent.changeText(nameField(), "Push Pull Legs 2");

      await user.press(saveButton());

      expect(await screen.findByText(ROUTINE_SAVE_FAILED)).toBeOnTheScreen();
      expect(nameField()).toHaveDisplayValue("Push Pull Legs 2");
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
      expect(mockHold.isHeld).toBe(true);
    });

    it("should save on the next press after a failure", async () => {
      routineStore.failsSave = true;
      const { user } = await showEditor({ stored: true });
      await user.press(saveButton());
      await screen.findByText(ROUTINE_SAVE_FAILED);
      routineStore.failsSave = false;

      await user.press(saveButton());

      await waitFor(() => {
        expect(routerMock.dismissTo).toHaveBeenCalledWith(routinesPath());
      });
    });

    it("should say it did not save, and send nothing, when there is no connection", async () => {
      const { user } = await showEditor({ stored: true });
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(saveButton());

      expect(await screen.findByText(ROUTINE_SAVE_FAILED)).toBeOnTheScreen();
      expect(routineStore.saves).toHaveLength(0);
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
    });

    it("should ignore Cancel and the back gesture, and hold the screen, while the save is on its way", async () => {
      let release: () => void = () => undefined;
      routineStore.holdSave = new Promise<void>((resolve) => {
        release = resolve;
      });
      const { user } = await showEditor({ stored: true });
      await fireEvent.changeText(nameField(), "Push Pull Legs 2");
      await user.press(saveButton());

      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));
      await act(() => {
        mockHold.onHeld();
      });

      expect(mockHold.isHeld).toBe(true);
      expect(screen.queryByText(ROUTINE_DISCARD.title)).not.toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
      await act(() => {
        release();
      });
      await waitFor(() => {
        expect(routerMock.dismissTo).toHaveBeenCalledTimes(1);
      });
    });

    it("should let the person leave a save that never answers, asking about the changes as usual", async () => {
      jest.useFakeTimers();
      routineStore.holdSave = new Promise<void>(() => undefined);
      await showEditor({ stored: true });
      await fireEvent.changeText(nameField(), "Push Pull Legs 2");
      await fireEvent.press(saveButton());
      // The query library tells the screen of the save on the next timer.
      await act(() => {
        jest.advanceTimersByTime(1);
      });

      await act(() => {
        jest.advanceTimersByTime(11998);
      });
      expect(mockHold.isHeld).toBe(true);
      await fireEvent.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));
      expect(screen.queryByText(ROUTINE_DISCARD.title)).not.toBeOnTheScreen();

      await act(() => {
        jest.advanceTimersByTime(1);
      });
      await fireEvent.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));

      expect(screen.getByText(ROUTINE_DISCARD.title)).toBeOnTheScreen();
      // The changes are still in the draft, so the screen is held to ask, and no longer for the save.
      expect(mockHold.isHeld).toBe(true);
      jest.useRealTimers();
    });

    it("should stop holding an unchanged routine's screen once a save has gone unanswered for too long", async () => {
      jest.useFakeTimers();
      routineStore.holdSave = new Promise<void>(() => undefined);
      await showEditor({ stored: true });
      await fireEvent.press(saveButton());
      await act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(mockHold.isHeld).toBe(true);

      await act(() => {
        jest.advanceTimersByTime(12000);
      });

      expect(mockHold.isHeld).toBe(false);
      jest.useRealTimers();
    });

    it("should hold the screen while an unchanged routine saves, and not ask to discard", async () => {
      let release: () => void = () => undefined;
      routineStore.holdSave = new Promise<void>((resolve) => {
        release = resolve;
      });
      const { user } = await showEditor({ stored: true });
      expect(mockHold.isHeld).toBe(false);

      await user.press(saveButton());
      expect(mockHold.isHeld).toBe(true);
      await act(() => {
        mockHold.onHeld();
      });

      expect(screen.queryByText(ROUTINE_DISCARD.title)).not.toBeOnTheScreen();
      await act(() => {
        release();
      });
      await waitFor(() => {
        expect(routerMock.dismissTo).toHaveBeenCalledTimes(1);
      });
    });

    it("should save once when Save is pressed twice while the first is on its way", async () => {
      let release: () => void = () => undefined;
      routineStore.holdSave = new Promise<void>((resolve) => {
        release = resolve;
      });
      await showEditor({ stored: true });
      await fireEvent.changeText(nameField(), "Push Pull Legs 2");

      // The button is busy while the save is on its way, so it is held by what it was. Both presses come
      // before the busy state is drawn, and the save is sent once all the same.
      const button = saveButton();
      await act(() => {
        void fireEvent.press(button);
        void fireEvent.press(button);
      });
      await act(() => {
        release();
      });

      await waitFor(() => {
        expect(routerMock.dismissTo).toHaveBeenCalledTimes(1);
      });
      expect(routineStore.saves).toHaveLength(1);
    });
  });
});

const ROUTINE_DAY_ADD = "Add day";
