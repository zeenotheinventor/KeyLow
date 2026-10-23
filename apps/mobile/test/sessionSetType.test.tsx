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
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  goldenLegsOpen,
  legsRoutine,
  previousThursday,
  FRESH_SESSION_ID,
  freshLegsOpen,
  loggedSetRow,
} from "./support/sessionGoldenLegs";
import {
  resetTrainBackend,
  setsOfActiveSession,
  trainBackend,
  trainClient,
} from "./support/trainBackend";

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

// The clock stands still at 19:00 on the golden Thursday, so the header reads "30:00 · ...".
jest.mock("../lib/useNow", () => ({ useNow: () => new Date("2026-10-15T18:00:00Z") }));

setUpTests();

const SAVE_FAILED = "Your set did not save. Check your connection, then try again.";
const SET_2_TYPE = "Set type, leg press set 2";
const SET_2_LOGGED = "Set 2 logged, 180 kilograms, 11 reps, RIR 1, undo";

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
}

const exerciseCard = async (name: string) => within(await screen.findByLabelText(name));

const chooseType = async (user: ReturnType<typeof userEvent.setup>, type: RegExp) => {
  await user.press(await screen.findByRole("radio", { name: type }));
};

/** The type the leg press set 2 is stored with. */
const storedTypeOfLegPressSet2 = (): unknown =>
  setsOfActiveSession().find((row) => row["position"] === 10)?.["set_type"];

/** A session with a warm-up of the squat and then a working set of it. */
function openWithOneWarmUp() {
  trainBackend.activeSession = {
    ...freshLegsOpen("2026-10-15T18:30:00+01:00"),
    workout_sets: [
      loggedSetRow(FRESH_SESSION_ID, "squat", 1, {
        set_type: "warmup",
        load_kg: 60,
        reps: 8,
        rir: null,
      }),
      loggedSetRow(FRESH_SESSION_ID, "squat", 2, { load_kg: 100, reps: 8, rir: 2 }),
    ],
  };
}

describe("changing the type of a logged set from the session screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/SessionScreen",
      "components/SessionClock",
      "components/SessionExerciseCard",
      "components/ExerciseCard",
      "components/SetRow",
      "components/SetEntrySheet",
      "components/SetTypeSheet",
      "components/ui",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetTrainBackend();
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = goldenLegsOpen();
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

  describe("the mark of a row", () => {
    it("should be a button on each logged set, named for the exercise and the set", async () => {
      await renderSession();
      const legPress = await exerciseCard("Leg press");

      expect(legPress.getByRole("button", { name: "Set type, leg press set 1" })).toBeOnTheScreen();
      expect(legPress.getByRole("button", { name: SET_2_TYPE })).toBeOnTheScreen();
    });

    it("should be a button on a logged warm-up, named by the warm-up", async () => {
      openWithOneWarmUp();
      await renderSession();
      const squat = await exerciseCard("Barbell squat");

      expect(
        squat.getByRole("button", { name: "Set type, barbell squat warm-up set" }),
      ).toBeOnTheScreen();
    });

    it("should stay text on a row to do", async () => {
      await renderSession();
      const legPress = await exerciseCard("Leg press");

      expect(legPress.getAllByRole("button", { name: /^Set type/ })).toHaveLength(2);
      expect(legPress.getByRole("button", { name: /^Log set 3/ })).toBeOnTheScreen();
      expect(legPress.getByText("3")).toBeOnTheScreen();
    });

    it("should do nothing for a set still being saved, until it is stored", async () => {
      let release: () => void = () => undefined;
      trainBackend.holdAddSet = new Promise<void>((resolve) => {
        release = resolve;
      });
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");

      await user.press(legPress.getByRole("button", { name: /^Log set 3/ }));

      expect(
        legPress.queryByRole("button", { name: "Set type, leg press set 3" }),
      ).not.toBeOnTheScreen();
      await act(() => {
        release();
      });
      expect(
        await legPress.findByRole("button", { name: "Set type, leg press set 3" }),
      ).toBeOnTheScreen();
    });
  });

  describe("the sheet", () => {
    it("should open for the pressed set with its type checked", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");

      await user.press(legPress.getByRole("button", { name: SET_2_TYPE }));

      expect(await screen.findByRole("heading", { name: "Set type" })).toBeOnTheScreen();
      expect(
        screen.getByText("Leg press · set 2 · tap the set number to change it"),
      ).toBeOnTheScreen();
      expect(screen.getByLabelText("Set type")).toHaveProp("role", "radiogroup");
      expect(screen.getByRole("radio", { name: /^Working\./ })).toBeChecked();
      expect(screen.getByRole("radio", { name: /^Warm-up\./ })).not.toBeChecked();
      expect(screen.getByRole("radio", { name: /^Drop\./ })).not.toBeChecked();
      expect(screen.getByRole("radio", { name: /^Failure\./ })).not.toBeChecked();
    });

    it("should open with Warm-up checked for a warm-up", async () => {
      openWithOneWarmUp();
      const user = userEvent.setup();
      await renderSession();
      const squat = await exerciseCard("Barbell squat");

      await user.press(squat.getByRole("button", { name: "Set type, barbell squat warm-up set" }));

      expect(await screen.findByRole("radio", { name: /^Warm-up\./ })).toBeChecked();
      expect(screen.getByRole("radio", { name: /^Working\./ })).not.toBeChecked();
    });

    it("should keep the type when it is closed any other way", async () => {
      const addListener = jest.spyOn(BackHandler, "addEventListener");
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await user.press(legPress.getByRole("button", { name: SET_2_TYPE }));
      await screen.findByRole("radio", { name: /^Working\./ });

      const pressBack = addListener.mock.calls.at(-1)?.[1];
      await act(() => {
        pressBack?.({ type: "hardwareBackPress", timeStamp: 0 });
      });

      await waitFor(() => {
        expect(screen.queryByRole("radio", { name: /^Working\./ })).not.toBeOnTheScreen();
      });
      expect(trainBackend.writes).toEqual([]);
      expect(legPress.getByLabelText(SET_2_LOGGED)).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 8 of 16 sets")).toBeOnTheScreen();
    });
  });

  describe("choosing a type", () => {
    it("should turn a working set into a warm-up: the mark W, the header one lower, the sheet closed", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await screen.findByText("30:00 · 8 of 16 sets");
      await user.press(legPress.getByRole("button", { name: SET_2_TYPE }));

      await chooseType(user, /^Warm-up\./);

      expect(
        await legPress.findByRole("button", { name: "Set type, leg press warm-up set" }),
      ).toBeOnTheScreen();
      expect(legPress.getByText("W")).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 7 of 16 sets")).toBeOnTheScreen();
      expect(trainBackend.writes).toEqual(["update_set"]);
      expect(storedTypeOfLegPressSet2()).toBe("warmup");
      await waitFor(() => {
        expect(screen.queryByRole("radio", { name: /^Warm-up\./ })).not.toBeOnTheScreen();
      });
    });

    it("should turn the warm-up back into the working set it was, with its number and the count back", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await user.press(legPress.getByRole("button", { name: SET_2_TYPE }));
      await chooseType(user, /^Warm-up\./);
      await screen.findByText("30:00 · 7 of 16 sets");
      await waitFor(() => {
        expect(screen.queryByRole("radio", { name: /^Warm-up\./ })).not.toBeOnTheScreen();
      });

      await user.press(legPress.getByRole("button", { name: "Set type, leg press warm-up set" }));
      // The Working row shows the number the set has again, not the board's 1.
      expect(
        within(await screen.findByRole("radio", { name: /^Working\./ })).getByText("2"),
      ).toBeOnTheScreen();
      await chooseType(user, /^Working\./);

      expect(await legPress.findByRole("button", { name: SET_2_TYPE })).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 8 of 16 sets")).toBeOnTheScreen();
      expect(storedTypeOfLegPressSet2()).toBe("working");
    });

    it("should show D for a drop set and leave the count where it is", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await user.press(legPress.getByRole("button", { name: SET_2_TYPE }));

      await chooseType(user, /^Drop\./);

      expect(
        await legPress.findByRole("button", { name: "Set type, leg press drop set" }),
      ).toBeOnTheScreen();
      expect(legPress.getByText("D")).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 8 of 16 sets")).toBeOnTheScreen();
      expect(storedTypeOfLegPressSet2()).toBe("drop");
    });

    it("should show F for a failure set", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await user.press(legPress.getByRole("button", { name: SET_2_TYPE }));

      await chooseType(user, /^Failure\./);

      expect(
        await legPress.findByRole("button", { name: "Set type, leg press failure set" }),
      ).toBeOnTheScreen();
      expect(legPress.getByText("F")).toBeOnTheScreen();
      expect(storedTypeOfLegPressSet2()).toBe("failure");
    });

    it("should write nothing and close the sheet when the checked type is chosen again", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await user.press(legPress.getByRole("button", { name: SET_2_TYPE }));

      await chooseType(user, /^Working\./);

      await waitFor(() => {
        expect(screen.queryByRole("radio", { name: /^Working\./ })).not.toBeOnTheScreen();
      });
      expect(trainBackend.writes).toEqual([]);
    });
  });

  describe("while a change is on its way", () => {
    it("should leave the mark inert until the write lands, then let the type change again", async () => {
      let release: () => void = () => undefined;
      trainBackend.holdUpdateSet = new Promise<void>((resolve) => {
        release = resolve;
      });
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await user.press(legPress.getByRole("button", { name: SET_2_TYPE }));

      await chooseType(user, /^Warm-up\./);

      await waitFor(() => {
        expect(screen.queryByRole("radio", { name: /^Warm-up\./ })).not.toBeOnTheScreen();
      });
      expect(trainBackend.writes).toEqual(["update_set"]);
      expect(legPress.queryByRole("button", { name: SET_2_TYPE })).not.toBeOnTheScreen();
      await act(() => {
        release();
      });
      await user.press(
        await legPress.findByRole("button", { name: "Set type, leg press warm-up set" }),
      );
      await chooseType(user, /^Drop\./);
      expect(
        await legPress.findByRole("button", { name: "Set type, leg press drop set" }),
      ).toBeOnTheScreen();
      expect(trainBackend.writes).toEqual(["update_set", "update_set"]);
      expect(storedTypeOfLegPressSet2()).toBe("drop");
    });
  });

  describe("a working set after a warm-up", () => {
    it("should be numbered 1, in its button's name and in its sheet's line", async () => {
      openWithOneWarmUp();
      const user = userEvent.setup();
      await renderSession();
      const squat = await exerciseCard("Barbell squat");

      await user.press(squat.getByRole("button", { name: "Set type, barbell squat set 1" }));

      expect(
        await screen.findByText("Barbell squat · set 1 · tap the set number to change it"),
      ).toBeOnTheScreen();
    });
  });

  describe("without a connection or when the write fails", () => {
    it("should change nothing, write nothing and say the set did not save when offline", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await screen.findByText("30:00 · 8 of 16 sets");
      await user.press(legPress.getByRole("button", { name: SET_2_TYPE }));
      await act(() => {
        onlineManager.setOnline(false);
      });

      await chooseType(user, /^Warm-up\./);

      expect(await screen.findByText(SAVE_FAILED)).toBeOnTheScreen();
      expect(trainBackend.writes).toEqual([]);
      expect(legPress.getByLabelText(SET_2_LOGGED)).toBeOnTheScreen();
      expect(legPress.getByRole("button", { name: SET_2_TYPE })).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 8 of 16 sets")).toBeOnTheScreen();
    });

    it("should change nothing and say the set did not save when the write fails", async () => {
      trainBackend.failingWrites = true;
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await screen.findByText("30:00 · 8 of 16 sets");
      await user.press(legPress.getByRole("button", { name: SET_2_TYPE }));

      await chooseType(user, /^Warm-up\./);

      expect(await screen.findByText(SAVE_FAILED)).toBeOnTheScreen();
      expect(legPress.getByLabelText(SET_2_LOGGED)).toBeOnTheScreen();
      expect(legPress.getByRole("button", { name: SET_2_TYPE })).toBeOnTheScreen();
      expect(screen.getByText("30:00 · 8 of 16 sets")).toBeOnTheScreen();
      expect(storedTypeOfLegPressSet2()).toBe("working");
    });
  });

  describe("a warm-up before the first working set", () => {
    it("should number the Working row by the sets before it, not by its own warm-up mark", async () => {
      openWithOneWarmUp();
      const user = userEvent.setup();
      await renderSession();
      const squat = await exerciseCard("Barbell squat");

      await user.press(squat.getByRole("button", { name: "Set type, barbell squat warm-up set" }));

      expect(
        within(await screen.findByRole("radio", { name: /^Working\./ })).getByText("1"),
      ).toBeOnTheScreen();
    });
  });
});
