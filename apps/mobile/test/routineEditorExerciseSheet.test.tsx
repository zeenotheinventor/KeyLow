import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import {
  ROUTINE_EXERCISE_FORM,
  describeFormAndMusclesButton,
  describeFormVideoLink,
} from "@keylow/core/copy";
import { act, cleanup, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { openURL } from "expo-linking";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RoutineEditor } from "../components/RoutineEditor";
import { ToastProvider } from "../components/ui";
import { resetBodyFigureForTests } from "../lib/bodyFigure/testing";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetRouterMock } from "./support/expoRouterMock";
import {
  formMediaBackend,
  formMediaClient,
  resetFormMediaBackend,
} from "./support/formMediaBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resetTrainBackend } from "./support/trainBackend";
import { installVirtualClock } from "./support/virtualClock";

import type { ExerciseNames, RoutineDraft } from "@keylow/core/training";
import type { QueryClient } from "@tanstack/react-query";

// The exercise sheet from the routine editor: the name button and the menu item open it for the right
// exercise, and closing it, or coming back from YouTube, leaves the unsaved draft as it was.

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
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("./support/sheetScrollViewMock")
    .mockBottomSheet(),
);

setUpTests();

const ROW_ID = "0000000a-0000-4000-8000-0000000000aa";
const FACE_PULL_ID = "0000000a-0000-4000-8000-0000000000bb";
const draft: RoutineDraft = {
  name: "Pull",
  days: [
    {
      id: null,
      weekday: null,
      name: "Pull",
      exercises: [
        { exercise_id: ROW_ID, target_sets: 3, rep_min: 8, rep_max: 12, target_rir: 2 },
        { exercise_id: FACE_PULL_ID, target_sets: 3, rep_min: 12, rep_max: 15, target_rir: 1 },
      ],
    },
  ],
};
const exerciseNames: ExerciseNames = { [ROW_ID]: "Barbell row", [FACE_PULL_ID]: "Face pull" };
const videoRowOf = (title: string) => ({
  video_id: "abcdefghijk",
  video_title: title,
  video_channel: "Strength Basics",
  image_paths: null,
});
const rowVideoName = describeFormVideoLink("Barbell row, step by step", "Strength Basics");
const facePullVideoName = describeFormVideoLink("Face pull, step by step", "Strength Basics");

let queryClient: QueryClient;

async function showEditor() {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={formMediaClient} queryClient={queryClient}>
        <ToastProvider>
          <RoutineEditor exerciseNames={exerciseNames} initialDraft={draft} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  const [showButton] = screen.getAllByRole("button", { name: "Show Pull exercises" });
  if (showButton === undefined) {
    throw new Error("There is no Show button for Pull");
  }
  await user.press(showButton);
  return user;
}

describe("the exercise sheet in the routine editor", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RoutineEditor",
      "components/RoutineDayCard",
      "components/RoutineDayExercises",
      "components/RoutineExerciseRow",
      "components/ExerciseMusclesSheet",
      "components/ExerciseFormSection",
    ]);
  });

  beforeEach(() => {
    installVirtualClock();
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetTrainBackend();
    resetFormMediaBackend();
    resetBodyFigureForTests();
    formMediaBackend.rowsByExercise[ROW_ID] = videoRowOf("Barbell row, step by step");
    formMediaBackend.rowsByExercise[FACE_PULL_ID] = videoRowOf("Face pull, step by step");
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.mocked(openURL).mockResolvedValue(true);
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.restoreAllMocks();
    jest.mocked(openURL).mockReset();
    jest.useRealTimers();
  });

  it("should open the sheet for the exercise whose name is pressed", async () => {
    const user = await showEditor();

    await user.press(
      screen.getByRole("button", { name: describeFormAndMusclesButton("Face pull") }),
    );

    expect(await screen.findByRole("link", { name: facePullVideoName })).toBeOnTheScreen();
    expect(screen.queryByRole("link", { name: rowVideoName })).not.toBeOnTheScreen();
  });

  it("should open the sheet for the exercise whose menu item is pressed", async () => {
    const user = await showEditor();

    await user.press(screen.getByRole("button", { name: "Options for Face pull" }));
    await user.press(screen.getByRole("button", { name: ROUTINE_EXERCISE_FORM.menuAction }));

    expect(await screen.findByRole("link", { name: facePullVideoName })).toBeOnTheScreen();
    expect(screen.queryByRole("link", { name: rowVideoName })).not.toBeOnTheScreen();
  });

  it("should keep the name button from shrinking the three columns", async () => {
    await showEditor();

    // The name takes what the fixed columns leave, so they stay as wide as the column heads over them.
    expect(
      screen.getByRole("button", { name: describeFormAndMusclesButton("Barbell row") }),
    ).toHaveStyle({ flexGrow: 1, minWidth: 0 });
  });

  it("should leave the unsaved draft as it was after YouTube is opened and the sheet is closed", async () => {
    const user = await showEditor();
    await user.clear(screen.getByLabelText("Sets for Barbell row"));
    await user.type(screen.getByLabelText("Sets for Barbell row"), "5");

    await user.press(
      screen.getByRole("button", { name: describeFormAndMusclesButton("Barbell row") }),
    );
    await user.press(await screen.findByRole("link", { name: rowVideoName }));
    expect(openURL).toHaveBeenCalledWith("https://www.youtube.com/watch?v=abcdefghijk");
    const sheet = screen
      .getAllByLabelText("Barbell row")
      .find((element) => element.props.role === "dialog");
    if (sheet === undefined) {
      throw new Error("The exercise sheet is not on the screen.");
    }
    await fireEvent(sheet, "accessibilityEscape");
    await act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(screen.queryByRole("link", { name: rowVideoName })).not.toBeOnTheScreen();

    expect(screen.getByLabelText("Sets for Barbell row")).toHaveDisplayValue("5");
    expect(screen.getByLabelText("Reps for Face pull")).toHaveDisplayValue("12 to 15");
    expect(screen.getByLabelText("Name")).toHaveDisplayValue("Pull");
  });

  it("should read no form media until the sheet is opened", async () => {
    await showEditor();

    await act(() => Promise.resolve());

    expect(formMediaBackend.reads).toBe(0);
  });
});
