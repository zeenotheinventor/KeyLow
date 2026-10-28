import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { BackHandler } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { SessionScreen } from "../components/SessionScreen";
import { ToastProvider } from "../components/ui";
import { resetBodyFigureForTests } from "../lib/bodyFigure/testing";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  freshLegsOpen,
  goldenLegsOpen,
  legsRoutine,
  previousThursday,
} from "./support/sessionGoldenLegs";
import { resetTrainBackend, trainBackend, trainClient } from "./support/trainBackend";

import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// The clock stands still at 19:00 on the golden Thursday.
jest.mock("../lib/useNow", () => ({ useNow: () => new Date("2026-10-15T18:00:00Z") }));

setUpTests();

const LEG_PRESS_PRIMARY = { name: "Quads, Primary · counts 1 set" };
const LEG_PRESS_SECONDARY = { name: "Glutes, Hamstrings, Secondary · counts half" };
const LEG_PRESS_ASSISTING = { name: "Calves, Assisting · counts a fifth" };
const DEADLIFT_PRIMARY = { name: "Hamstrings, Primary · counts 1 set" };

let queryClient: QueryClient;

async function renderSession() {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainClient} queryClient={queryClient}>
        <ToastProvider>
          <SessionScreen onFinished={jest.fn()} onHide={jest.fn()} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return userEvent.setup();
}

const exerciseCard = async (name: string) => within(await screen.findByLabelText(name));

/** The sheet named for an exercise. The exercise's card carries the same name, so the dialog is told by its role. */
const sheetNamed = (name: string) =>
  screen.queryAllByLabelText(name).find((element) => element.props.role === "dialog");

/** Listens for the back button, and gives what presses it: how the phone closes the open sheet. */
function watchBackButton() {
  const addListener = jest.spyOn(BackHandler, "addEventListener");

  return async () => {
    const handler = addListener.mock.calls.at(-1)?.[1];
    await act(() => {
      handler?.({ type: "hardwareBackPress", timeStamp: 0 });
    });
  };
}

describe("the Muscles it works sheet on the active session screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/SessionScreen",
      "components/SessionClock",
      "components/SessionExerciseCard",
      "components/ExerciseCard",
      "components/ExerciseMusclesSheet",
      "components/SetRow",
      "components/ui",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetTrainBackend();
    resetBodyFigureForTests();
    trainBackend.routine = legsRoutine;
    trainBackend.lastPerformance = previousThursday;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("on the golden Thursday Legs, whose saved sets hold what each exercise works", () => {
    beforeEach(() => {
      trainBackend.activeSession = goldenLegsOpen(undefined, [], "legs");
    });

    it("should be shut until a card asks for it", async () => {
      await renderSession();
      await exerciseCard("Leg press");

      expect(sheetNamed("Leg press")).toBeUndefined();
    });

    it("should open for the leg press, with a row for each role it works, from its body icon button", async () => {
      const user = await renderSession();
      const legPress = await exerciseCard("Leg press");

      await user.press(legPress.getByRole("button", { name: "Muscles for Leg press" }));

      expect(sheetNamed("Leg press")).toBeDefined();
      expect(await screen.findByRole("listitem", LEG_PRESS_PRIMARY)).toBeOnTheScreen();
      expect(screen.getByRole("listitem", LEG_PRESS_SECONDARY)).toBeOnTheScreen();
      expect(screen.getByRole("listitem", LEG_PRESS_ASSISTING)).toBeOnTheScreen();
    });

    it("should open the same sheet from the exercise's name", async () => {
      const user = await renderSession();
      const legPress = await exerciseCard("Leg press");

      await user.press(legPress.getByRole("heading", { name: "Leg press" }));

      expect(sheetNamed("Leg press")).toBeDefined();
      expect(await screen.findByRole("listitem", LEG_PRESS_PRIMARY)).toBeOnTheScreen();
    });

    it("should be hidden once it is closed", async () => {
      const pressBack = watchBackButton();
      const user = await renderSession();
      const legPress = await exerciseCard("Leg press");
      await user.press(legPress.getByRole("button", { name: "Muscles for Leg press" }));
      await screen.findByRole("listitem", LEG_PRESS_PRIMARY);

      await pressBack();

      await waitFor(() => {
        expect(screen.queryByRole("listitem", LEG_PRESS_PRIMARY)).not.toBeOnTheScreen();
      });
      expect(sheetNamed("Leg press")).toBeUndefined();
    });

    it("should show the muscles of another exercise when its button is pressed after the first sheet closed", async () => {
      const pressBack = watchBackButton();
      const user = await renderSession();
      const legPress = await exerciseCard("Leg press");
      await user.press(legPress.getByRole("button", { name: "Muscles for Leg press" }));
      await screen.findByRole("listitem", LEG_PRESS_PRIMARY);
      await pressBack();
      await waitFor(() => {
        expect(sheetNamed("Leg press")).toBeUndefined();
      });
      const deadlift = await exerciseCard("Romanian deadlift");

      await user.press(deadlift.getByRole("button", { name: "Muscles for Romanian deadlift" }));

      expect(await screen.findByRole("listitem", DEADLIFT_PRIMARY)).toBeOnTheScreen();
      expect(sheetNamed("Romanian deadlift")).toBeDefined();
      expect(screen.queryByRole("listitem", LEG_PRESS_PRIMARY)).not.toBeOnTheScreen();
    });
  });

  describe("on a planned exercise with no set saved yet, with no connection", () => {
    it("should show the muscles of the active routine, which the phone already holds", async () => {
      trainBackend.activeSession = freshLegsOpen("2026-10-15T18:30:00+01:00");
      const user = await renderSession();
      const squat = await exerciseCard("Barbell squat");
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(squat.getByRole("button", { name: "Muscles for Barbell squat" }));

      expect(await screen.findByRole("listitem", { name: /^Quads, Primary/ })).toBeOnTheScreen();
    });
  });
});
