import "react-native-gesture-handler/jestSetup";

import { KeyLowProvider } from "@keylow/api-client";
import {
  ADD_EXERCISE,
  ROUTINE_EDITOR,
  ROUTINE_MOVE,
  ROUTINES_EMPTY,
  ROUTINES_SCREEN,
  TRAIN_HOME,
  TRAIN_NO_ROUTINE,
} from "@keylow/core/copy";
import { QueryClient } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { ExpoRoot, Slot, router } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import TrainLayout from "../app/(tabs)/train/_layout";
import TrainRoute from "../app/(tabs)/train/index";
import RoutinesRoute from "../app/(tabs)/train/routines";
import EditRoutineRoute from "../app/(tabs)/train/routines/[id]";
import NewRoutineRoute from "../app/(tabs)/train/routines/new";
import { ToastProvider } from "../components/ui";
import { trainPath } from "../lib/routineRoutes";
import { ThemeProvider } from "../lib/theme";
import { resetDiaryBackend } from "./support/diaryBackend";
import { lateralRaiseExercises, SIDE_LATERAL_RAISE_ID } from "./support/exerciseCatalogue";
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
import { expectTextsInOrder } from "./support/textsInOrder";
import { loggedSession, resetTrainBackend, trainBackend } from "./support/trainBackend";

// The routine editor inside the real navigator, from the Train home to a saved routine on the routines list:
// the Routines link, Create routine on the no routine card and on the empty list, Edit routine on the list,
// and what a save does to the stack. The Train home, the routines list and the editor are the app's own.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
// 17:55 in London on Thursday 15 October 2026, which is BST.
jest.mock("../lib/useNow", () => ({ useNow: () => new Date("2026-10-15T16:55:00Z") }));
// The navigator's imports bring the library's mock of Reanimated with them, which the library's sheet cannot run
// on. A sheet that draws its content while it is open stands in for it: how the library drags and snaps one is on the device.
jest.mock("../components/ui/BottomSheet/BottomSheet", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    BottomSheet: ({
      open,
      title,
      label,
      children,
    }: {
      open: boolean;
      title?: string;
      label?: string;
      children: import("react").ReactNode;
    }) =>
      open ? (
        <View aria-label={title ?? label} role="dialog">
          {children}
        </View>
      ) : null,
  };
});

jest.mock("../components/ui/BottomSheet/SheetScrollView", () => ({
  SheetScrollView: jest.requireActual<typeof import("react-native")>("react-native").ScrollView,
}));

setUpTests();

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

let queryClient: QueryClient;

function Providers() {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={routineStoreClient} queryClient={queryClient}>
        <ToastProvider>
          <Slot />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>
  );
}

async function openTrain() {
  await render(
    <ExpoRoot
      context={getMockContext({
        _layout: Providers,
        "(tabs)/_layout": () => <Slot />,
        "(tabs)/train/_layout": TrainLayout,
        "(tabs)/train/index": TrainRoute,
        "(tabs)/train/routines": RoutinesRoute,
        "(tabs)/train/routines/archived": standIn("Archived routines"),
        "(tabs)/train/routines/new": NewRoutineRoute,
        "(tabs)/train/routines/[id]": EditRoutineRoute,
      })}
      location={trainPath()}
    />,
  );
}

// Lets the stack settle after a screen is pushed or popped.
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

const nameField = () => screen.findByLabelText(ROUTINE_EDITOR.nameLabel);

describe("the routine editor from the Train home to the routines list", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "app",
      "components/TrainScreen",
      "components/RoutinesScreen",
      "components/RoutinesView",
      "components/RoutineCard",
      "components/RoutineRow",
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
    resetDiaryBackend();
    resetTrainBackend();
    resetRoutineStore();
    trainBackend.exercises = lateralRaiseExercises;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("should take a person with no routine from the Train home to a saved routine in the list", async () => {
    trainBackend.sessions = [loggedSession];
    routineStore.exerciseNames.set(SIDE_LATERAL_RAISE_ID, "Side lateral raise");
    const user = userEvent.setup();
    await openTrain();

    await user.press(await screen.findByRole("button", { name: TRAIN_NO_ROUTINE.createAction }));
    await user.type(await nameField(), "Full body");
    await user.press(screen.getByRole("button", { name: "Add day" }));
    await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.addExerciseAction }));
    await user.type(
      await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }),
      "lateral raise",
    );
    await user.press(
      await screen.findByRole("button", { name: "Add Side lateral raise, Dumbbell" }),
    );
    await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.saveAction }));
    await settle();

    expect(await screen.findByRole("heading", { name: ROUTINES_SCREEN.title })).toBeOnTheScreen();
    expect(screen.getByText("Full body")).toBeOnTheScreen();
    expect(screen.getByText("1 day · 3 sets a week")).toBeOnTheScreen();
    expect(screen.queryByRole("heading", { name: ROUTINES_EMPTY.title })).not.toBeOnTheScreen();
    expect(routineStore.saves).toHaveLength(1);
    // The list is the one under the editor, so one step back is the Train home.
    await act(() => {
      router.back();
    });
    await settle();
    expect(screen.getByRole("heading", { name: TRAIN_HOME.title })).toBeOnTheScreen();
  });

  it("should open the routines list from the Routines link, and the editor from its Create routine", async () => {
    trainBackend.sessions = [loggedSession];
    const user = userEvent.setup();
    await openTrain();

    await user.press(await screen.findByRole("button", { name: TRAIN_HOME.routinesLink }));
    await user.press(await screen.findByRole("button", { name: ROUTINES_EMPTY.action }));

    expect(await screen.findByRole("heading", { name: ROUTINE_EDITOR.newTitle })).toBeOnTheScreen();
  });

  it("should open the routine's editor from the list, and show a moved exercise after a save and a reopen", async () => {
    seedRoutine(pushPullLegsDraft, pushPullLegsExerciseNames);
    trainBackend.sessions = [loggedSession];
    const user = userEvent.setup();
    await openTrain();
    await user.press(await screen.findByRole("button", { name: TRAIN_HOME.routinesLink }));

    await user.press(await screen.findByRole("button", { name: /^Push Pull Legs/ }));
    await user.press(await screen.findByRole("button", { name: "Show Legs exercises" }));
    await user.press(screen.getByRole("button", { name: "Options for Barbell squat" }));
    await user.press(screen.getByRole("button", { name: ROUTINE_MOVE.downAction }));
    await user.press(screen.getByRole("button", { name: ROUTINE_EDITOR.saveAction }));
    await settle();
    await user.press(await screen.findByRole("button", { name: /^Push Pull Legs/ }));
    await user.press(await screen.findByRole("button", { name: "Show Legs exercises" }));

    const names = [
      "Romanian deadlift",
      "Barbell squat",
      "Leg press",
      "Seated leg curl",
      "Standing calf raise",
    ];
    await waitFor(() => {
      expect(screen.getByLabelText("Sets for Barbell squat")).toBeOnTheScreen();
    });
    expectTextsInOrder(screen.getAllByText(new RegExp(`^(${names.join("|")})$`)), names);
  });

  describe("a second tap while a screen is sliding in", () => {
    const goBack = async () => {
      await act(() => {
        router.back();
      });
      await settle();
    };

    // Both taps arrive before the first screen has had a chance to render anything.
    const tapTwice = (button: ReturnType<typeof screen.getByRole>) =>
      act(() => {
        void fireEvent.press(button);
        void fireEvent.press(button);
      });

    it("should stack the list and the editor once for a double tap on Create routine", async () => {
      trainBackend.sessions = [loggedSession];
      await openTrain();

      await tapTwice(await screen.findByRole("button", { name: TRAIN_NO_ROUTINE.createAction }));
      await settle();
      await screen.findByRole("heading", { name: ROUTINE_EDITOR.newTitle });
      await goBack();
      expect(screen.getByRole("heading", { name: ROUTINES_SCREEN.title })).toBeOnTheScreen();
      await goBack();

      expect(screen.getByRole("heading", { name: TRAIN_HOME.title })).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: ROUTINES_SCREEN.title })).not.toBeOnTheScreen();
    });

    it("should stack the list once for a double tap on the Routines link", async () => {
      trainBackend.sessions = [loggedSession];
      await openTrain();

      await tapTwice(await screen.findByRole("button", { name: TRAIN_HOME.routinesLink }));
      await settle();
      await goBack();

      expect(screen.getByRole("heading", { name: TRAIN_HOME.title })).toBeOnTheScreen();
    });

    it("should stack the editor once for a double tap on Edit routine and on New routine", async () => {
      seedRoutine(pushPullLegsDraft, pushPullLegsExerciseNames);
      trainBackend.sessions = [loggedSession];
      await openTrain();
      const user = userEvent.setup();
      await user.press(await screen.findByRole("button", { name: TRAIN_HOME.routinesLink }));

      await tapTwice(await screen.findByRole("button", { name: /^Push Pull Legs/ }));
      await settle();
      await screen.findByRole("heading", { name: ROUTINE_EDITOR.title });
      await goBack();
      expect(screen.getByRole("heading", { name: ROUTINES_SCREEN.title })).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: ROUTINE_EDITOR.title })).not.toBeOnTheScreen();

      await tapTwice(screen.getByRole("button", { name: ROUTINES_SCREEN.newRoutineLabel }));
      await settle();
      await goBack();
      expect(screen.getByRole("heading", { name: ROUTINES_SCREEN.title })).toBeOnTheScreen();
      expect(
        screen.queryByRole("heading", { name: ROUTINE_EDITOR.newTitle }),
      ).not.toBeOnTheScreen();
    });
  });
});
