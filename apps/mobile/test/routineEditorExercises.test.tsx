import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import { ADD_EXERCISE, ROUTINE_EDITOR, ROUTINE_DISCARD } from "@keylow/core/copy";
import { MAX_EXERCISES_PER_ROUTINE_DAY } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { Keyboard } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RoutineEditor } from "../components/RoutineEditor";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { lateralRaiseExercises } from "./support/exerciseCatalogue";
import { resetRouterMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { pushPullLegsDraft } from "./support/routineEditorFixtures";
import { pushPullLegsExerciseNames } from "./support/routineExerciseFixtures";
import { expectTextsInOrder } from "./support/textsInOrder";
import { resetTrainBackend, trainBackend, trainClient } from "./support/trainBackend";
import { viewsDrawn } from "./support/viewsDrawn";

import type { ExerciseNames } from "../components/RoutineEditor";
import type { RoutineDraft } from "@keylow/core/training";
import type { QueryClient } from "@tanstack/react-query";

// The exercises of a day in the routine editor: the table the open day draws, adding from the picker,
// the three fields, and remove. The counts they move are the day's meta and the heading's sets a week.

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
jest.mock("expo-router/react-navigation", () => ({ usePreventRemove: () => undefined }));
// Jest does not turn the library's scroll handlers into worklets, so its scroll view cannot render here. The
// plain scroll view stands in for it. How the library drags a sheet with it is on the device.
jest.mock("@gorhom/bottom-sheet", () => {
  const { forwardRef } = jest.requireActual<typeof import("react")>("react");
  const { ScrollView } = jest.requireActual<typeof import("react-native")>("react-native");
  const actual = jest.requireActual<typeof import("@gorhom/bottom-sheet")>("@gorhom/bottom-sheet");
  return {
    __esModule: true,
    default: actual.default,
    BottomSheetView: actual.BottomSheetView,
    BottomSheetTextInput: actual.BottomSheetTextInput,
    BottomSheetBackdrop: actual.BottomSheetBackdrop,
    BottomSheetScrollView: forwardRef<never, object>(function FakeSheetScrollView(props, ref) {
      return <ScrollView ref={ref} {...props} />;
    }),
  };
});

setUpTests();

let queryClient: QueryClient;

async function showEditor(
  draft: RoutineDraft = pushPullLegsDraft,
  exerciseNames: ExerciseNames = pushPullLegsExerciseNames,
) {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainClient} queryClient={queryClient}>
        <ToastProvider>
          <RoutineEditor exerciseNames={exerciseNames} initialDraft={draft} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

async function openDay(user: Awaited<ReturnType<typeof showEditor>>, dayName: string) {
  const [button] = screen.getAllByRole("button", { name: `Show ${dayName} exercises` });
  if (button === undefined) {
    throw new Error(`There is no Show button for ${dayName}`);
  }
  await user.press(button);
}

// An exercise is taken out from its menu, which also moves it.
async function removeExercise(user: Awaited<ReturnType<typeof showEditor>>, exerciseName: string) {
  await user.press(screen.getByRole("button", { name: `Options for ${exerciseName}` }));
  await user.press(screen.getByRole("button", { name: `Remove ${exerciseName}` }));
}

const sets = (exerciseName: string) => screen.getByLabelText(`Sets for ${exerciseName}`);
const reps = (exerciseName: string) => screen.getByLabelText(`Reps for ${exerciseName}`);
const rir = (exerciseName: string) => screen.getByLabelText(`RIR for ${exerciseName}`);
const text = (words: string) => screen.getByText(words);

/** A day of one exercise, so the maths in a test is the maths of one row. */
const dayOfOne: RoutineDraft = {
  name: "One",
  days: [
    {
      id: null,
      weekday: null,
      name: "Pull",
      exercises: [
        {
          exercise_id: "0000000a-0000-4000-8000-0000000000aa",
          target_sets: 3,
          rep_min: 8,
          rep_max: 12,
          target_rir: 2,
        },
      ],
    },
  ],
};
const dayOfOneNames: ExerciseNames = { "0000000a-0000-4000-8000-0000000000aa": "Barbell row" };

describe("the exercises of a day in the routine editor", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RoutineEditor",
      "components/RoutineDayCard",
      "components/RoutineDayExercises",
      "components/RoutineExerciseRow",
      "components/AddExerciseSheet",
      "components/ExerciseRow",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetTrainBackend();
    trainBackend.exercises = lateralRaiseExercises;
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("an open day", () => {
    it("should list its exercises in order", async () => {
      const user = await showEditor();

      await openDay(user, "Legs");

      const names = [
        "Barbell squat",
        "Romanian deadlift",
        "Leg press",
        "Seated leg curl",
        "Standing calf raise",
      ];
      expectTextsInOrder(screen.getAllByText(new RegExp(`^(${names.join("|")})$`)), names);
    });

    it("should draw each exercise's sets, range of reps and RIR as the board does", async () => {
      const user = await showEditor();

      await openDay(user, "Legs");

      expect(sets("Barbell squat")).toHaveDisplayValue("3");
      expect(reps("Barbell squat")).toHaveDisplayValue("8 to 12");
      expect(rir("Barbell squat")).toHaveDisplayValue("2");
      expect(sets("Standing calf raise")).toHaveDisplayValue("4");
    });

    it("should name each field with its exercise, and draw the column heads for the eye only", async () => {
      const user = await showEditor();

      await openDay(user, "Legs");

      for (const head of ["Exercise", "Sets", "Reps", "RIR"]) {
        expect(screen.queryByText(head)).not.toBeOnTheScreen();
        expect(screen.getByText(head, { includeHiddenElements: true })).toBeOnTheScreen();
      }
    });

    it("should show no exercises while the day is closed", async () => {
      await showEditor();

      expect(screen.queryByLabelText("Sets for Barbell squat")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: ROUTINE_EDITOR.addExerciseAction })).toBeNull();
    });

    it("should draw a row 48 points high under a hairline, with fields 36 points high", async () => {
      const user = await showEditor();

      await openDay(user, "Legs");

      expect(viewsDrawn({ minHeight: 48, borderTopWidth: 1 })).toHaveLength(5);
      expect(viewsDrawn({ height: 36 }).length).toBeGreaterThanOrEqual(15);
    });

    it("should lay the three fields out in columns of 48, 84 and 48 points", async () => {
      const user = await showEditor();

      await openDay(user, "Legs");

      // Five rows and the column heads each draw the three columns.
      expect(viewsDrawn({ width: 48 })).toHaveLength(2 * 6);
      expect(viewsDrawn({ width: 84 })).toHaveLength(6);
    });

    it("should ask for the number pad for the sets and RIR, and for the punctuation keyboard for a range of reps", async () => {
      const user = await showEditor();

      await openDay(user, "Legs");

      expect(sets("Barbell squat")).toHaveProp("keyboardType", "number-pad");
      expect(rir("Barbell squat")).toHaveProp("keyboardType", "number-pad");
      expect(reps("Barbell squat")).toHaveProp("keyboardType", "numbers-and-punctuation");
    });

    it("should keep a long name to one line", async () => {
      const user = await showEditor();

      await openDay(user, "Legs");

      expect(screen.getByText("Barbell squat")).toHaveProp("numberOfLines", 1);
    });

    it("should draw Add exercise and an options button for every exercise", async () => {
      const user = await showEditor();

      await openDay(user, "Legs");

      expect(
        screen.getByRole("button", { name: ROUTINE_EDITOR.addExerciseAction }),
      ).toBeOnTheScreen();
      // The five exercises' buttons and the open day's own.
      expect(screen.getAllByRole("button", { name: /^Options for / })).toHaveLength(6);
      expect(screen.getByRole("button", { name: "Options for Barbell squat" })).toBeOnTheScreen();
    });
  });

  describe("adding an exercise", () => {
    async function addSideLateralRaiseToPull(user: Awaited<ReturnType<typeof showEditor>>) {
      await openDay(user, "Pull");
      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.addExerciseAction }));
      await user.type(
        await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }),
        "lateral raise",
      );
      await user.press(
        await screen.findByRole("button", { name: "Add Side lateral raise, Dumbbell" }),
      );
    }

    it("should open the picker for the day, and add nothing until an exercise is chosen", async () => {
      const user = await showEditor();
      await openDay(user, "Pull");

      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.addExerciseAction }));

      expect(
        await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }),
      ).toBeOnTheScreen();
      expect(text("5 exercises · 15 sets")).toBeOnTheScreen();
    });

    it("should put the keyboard away when the picker opens, as the other sheets do", async () => {
      const dismiss = jest.spyOn(Keyboard, "dismiss");
      const user = await showEditor();
      await openDay(user, "Pull");

      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.addExerciseAction }));

      expect(dismiss).toHaveBeenCalled();
      dismiss.mockRestore();
    });

    it("should append the chosen exercise last with 3 sets, 8 to 12 reps and RIR 2", async () => {
      const user = await showEditor();

      await addSideLateralRaiseToPull(user);

      expect(sets("Side lateral raise")).toHaveDisplayValue("3");
      expect(reps("Side lateral raise")).toHaveDisplayValue("8 to 12");
      expect(rir("Side lateral raise")).toHaveDisplayValue("2");
      // The picker slides away, and its row for the exercise goes with it.
      await waitFor(() => {
        expect(screen.queryByRole("searchbox", { name: ADD_EXERCISE.searchName })).toBeNull();
      });
      expectTextsInOrder(
        screen.getAllByText(
          /^(Barbell row|Lat pulldown|Seated cable row|Face pull|Dumbbell curl|Side lateral raise)$/,
        ),
        [
          "Barbell row",
          "Lat pulldown",
          "Seated cable row",
          "Face pull",
          "Dumbbell curl",
          "Side lateral raise",
        ],
      );
    });

    it("should count it in the day's exercises and sets and in the sets a week, and close the picker", async () => {
      const user = await showEditor();

      await addSideLateralRaiseToPull(user);

      expect(text("6 exercises · 18 sets")).toBeOnTheScreen();
      expect(text("4 of 7 · 66 sets a week")).toBeOnTheScreen();
      await waitFor(() => {
        expect(screen.queryByRole("searchbox", { name: ADD_EXERCISE.searchName })).toBeNull();
      });
    });

    it("should add nothing when the picker is closed without a choice", async () => {
      const user = await showEditor();
      await openDay(user, "Pull");
      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.addExerciseAction }));
      await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName });

      await user.press(screen.getByRole("button", { name: ADD_EXERCISE.closeName }));

      expect(text("5 exercises · 15 sets")).toBeOnTheScreen();
      expect(text("4 of 7 · 63 sets a week")).toBeOnTheScreen();
    });

    it("should add it to the day whose button was pressed and no other", async () => {
      const user = await showEditor();
      await openDay(user, "Legs");
      await openDay(user, "Pull");
      const [pullAdd] = screen.getAllByRole("button", { name: ROUTINE_EDITOR.addExerciseAction });
      if (pullAdd === undefined) {
        throw new Error("Pull has no Add exercise button");
      }
      await user.press(pullAdd);
      await user.type(
        await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }),
        "lateral raise",
      );

      await user.press(
        await screen.findByRole("button", { name: "Add Side lateral raise, Dumbbell" }),
      );

      expect(text("6 exercises · 18 sets")).toBeOnTheScreen();
      expect(screen.getAllByText("5 exercises · 16 sets")).toHaveLength(3);
    });

    it("should stop Add exercise on a day that holds the most it can", async () => {
      const exercises = Array.from({ length: MAX_EXERCISES_PER_ROUTINE_DAY }, (_, position) => ({
        exercise_id: `0000000a-0000-4000-8000-${String(position + 100).padStart(12, "0")}`,
        target_sets: 3,
        rep_min: 8,
        rep_max: 12,
        target_rir: 2,
      }));
      const user = await showEditor({
        name: "Full",
        days: [{ id: null, weekday: null, name: "Everything", exercises }],
      });

      await openDay(user, "Everything");

      expect(screen.getByRole("button", { name: ROUTINE_EDITOR.addExerciseAction })).toBeDisabled();
    });

    it("should count the editor as changed, so closing asks first", async () => {
      const user = await showEditor();
      await addSideLateralRaiseToPull(user);

      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));

      expect(screen.getByText(ROUTINE_DISCARD.title)).toBeOnTheScreen();
    });
  });

  describe("editing the fields", () => {
    it("should count the sets typed in the day and in the sets a week", async () => {
      const user = await showEditor();
      await openDay(user, "Legs");

      await fireEvent.changeText(sets("Barbell squat"), "4");

      expect(sets("Barbell squat")).toHaveDisplayValue("4");
      expect(text("5 exercises · 17 sets")).toBeOnTheScreen();
      expect(text("4 of 7 · 64 sets a week")).toBeOnTheScreen();
    });

    it("should take only digits in the sets and the RIR", async () => {
      const user = await showEditor();
      await openDay(user, "Legs");

      await fireEvent.changeText(sets("Barbell squat"), "4x.5");
      await fireEvent.changeText(rir("Barbell squat"), "-1e");

      expect(sets("Barbell squat")).toHaveDisplayValue("45");
      expect(rir("Barbell squat")).toHaveDisplayValue("1");
    });

    it("should take digits, spaces, hyphens and to in the reps", async () => {
      const user = await showEditor();
      await openDay(user, "Legs");

      await fireEvent.changeText(reps("Barbell squat"), "5 to 8!");
      expect(reps("Barbell squat")).toHaveDisplayValue("5 to 8");

      await fireEvent.changeText(reps("Barbell squat"), "5-8");
      expect(reps("Barbell squat")).toHaveDisplayValue("5-8");
    });

    it("should clamp nothing: a number past the bounds stays as typed and is counted", async () => {
      const user = await showEditor();
      await openDay(user, "Legs");

      await fireEvent.changeText(sets("Barbell squat"), "25");

      expect(sets("Barbell squat")).toHaveDisplayValue("25");
      expect(text("5 exercises · 38 sets")).toBeOnTheScreen();
    });

    it("should leave an emptied sets field empty and count it as no sets", async () => {
      const user = await showEditor();
      await openDay(user, "Legs");

      await fireEvent.changeText(sets("Barbell squat"), "");

      expect(sets("Barbell squat")).toHaveDisplayValue("");
      expect(text("5 exercises · 13 sets")).toBeOnTheScreen();
      expect(text("4 of 7 · 60 sets a week")).toBeOnTheScreen();
    });

    it("should leave the reps and RIR out of the counts", async () => {
      const user = await showEditor();
      await openDay(user, "Legs");

      await fireEvent.changeText(reps("Barbell squat"), "3 to 5");
      await fireEvent.changeText(rir("Barbell squat"), "");

      expect(text("4 of 7 · 63 sets a week")).toBeOnTheScreen();
      expect(rir("Barbell squat")).toHaveDisplayValue("");
    });

    it("should edit the sets of the exercise added and move the sets a week", async () => {
      const user = await showEditor();
      await openDay(user, "Pull");
      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.addExerciseAction }));
      await user.type(
        await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }),
        "lateral raise",
      );
      await user.press(
        await screen.findByRole("button", { name: "Add Side lateral raise, Dumbbell" }),
      );

      await fireEvent.changeText(sets("Side lateral raise"), "4");

      expect(text("6 exercises · 19 sets")).toBeOnTheScreen();
      expect(text("4 of 7 · 67 sets a week")).toBeOnTheScreen();
    });

    it("should keep the text typed in a day when the day is closed and opened again", async () => {
      const user = await showEditor();
      await openDay(user, "Legs");
      await fireEvent.changeText(reps("Barbell squat"), "5 to");

      await user.press(screen.getByRole("button", { name: "Hide Legs exercises" }));
      await openDay(user, "Legs");

      expect(reps("Barbell squat")).toHaveDisplayValue("5 to");
    });
  });

  describe("removing an exercise", () => {
    it("should take the exercise out of the day and out of the counts", async () => {
      const user = await showEditor();
      await openDay(user, "Legs");

      await removeExercise(user, "Barbell squat");

      expect(screen.queryByLabelText("Sets for Barbell squat")).not.toBeOnTheScreen();
      expect(sets("Romanian deadlift")).toBeOnTheScreen();
      expect(text("4 exercises · 13 sets")).toBeOnTheScreen();
      expect(text("4 of 7 · 60 sets a week")).toBeOnTheScreen();
    });

    it("should keep what was typed in the exercises that stay", async () => {
      const user = await showEditor();
      await openDay(user, "Legs");
      await fireEvent.changeText(sets("Leg press"), "5");

      await removeExercise(user, "Barbell squat");

      expect(sets("Leg press")).toHaveDisplayValue("5");
    });

    it("should leave a day with no exercises, still able to take one", async () => {
      const user = await showEditor(dayOfOne, dayOfOneNames);
      await user.press(screen.getByRole("button", { name: "Show Pull exercises" }));

      await removeExercise(user, "Barbell row");

      expect(text("0 exercises · 0 sets")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: ROUTINE_EDITOR.addExerciseAction })).toBeEnabled();
    });

    it("should count the editor as changed, so closing asks first", async () => {
      const user = await showEditor();
      await openDay(user, "Legs");
      await removeExercise(user, "Barbell squat");

      await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));

      expect(screen.getByText(ROUTINE_DISCARD.title)).toBeOnTheScreen();
    });
  });

  it("should not count the editor as changed by a text that reads as the same numbers", async () => {
    const user = await showEditor(dayOfOne, dayOfOneNames);
    await user.press(screen.getByRole("button", { name: "Show Pull exercises" }));

    await fireEvent.changeText(reps("Barbell row"), "8-12");
    await fireEvent.changeText(sets("Barbell row"), "03");
    await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelLabel }));

    expect(screen.queryByText(ROUTINE_DISCARD.title)).toBeNull();
  });
});
