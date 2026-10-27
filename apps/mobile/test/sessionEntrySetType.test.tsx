import { KeyLowProvider } from "@keylow/api-client";
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
import { BackHandler, Keyboard } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { SessionScreen } from "../components/SessionScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  exerciseIdOf,
  GOLDEN_SESSION_ID,
  goldenLegsOpen,
  legsRoutine,
  loggedSetRow,
  previousThursday,
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

const SET_3_CELLS = "Leg press, set 3";
const NUMBER_OF_SET_3 = "Set type, leg press set 3";

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

type User = ReturnType<typeof userEvent.setup>;

const exerciseCard = async (name: string) => within(await screen.findByLabelText(name));

/** The Set type control of the set entry sheet: the radiogroup whose options are named for the types alone. */
const typeControl = () => within(screen.getByLabelText("Set type"));

/** The entry sheet's dialog, which shares its name with the row's cells and is hidden from role queries by the modal sheet over it. */
function entryDialog() {
  const dialog = screen
    .getAllByLabelText(SET_3_CELLS)
    .find((element) => element.props.role === "dialog");
  if (dialog === undefined) {
    throw new Error("The set entry dialog is not on the screen.");
  }
  return dialog;
}

async function openEntryForSet3(user: User) {
  await screen.findByText("30:00 · 8 of 16 sets");
  await user.press(await screen.findByRole("button", { name: SET_3_CELLS }));
  await screen.findByLabelText("Load, kg");
}

async function pressInTypeSheet(user: User, type: RegExp) {
  await user.press(await screen.findByRole("radio", { name: type }));
  await waitFor(() => {
    expect(screen.queryByRole("heading", { name: "Set type" })).not.toBeOnTheScreen();
  });
}

const storedTypeOfLastLegPressSet = (): unknown =>
  setsOfActiveSession()
    .filter((row) => row["exercise_id"] === exerciseIdOf("legPress"))
    .at(-1)?.["set_type"];

describe("choosing the type of a set before it is logged", () => {
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

  describe("the Set type control", () => {
    it("should open on the slot's own type, Working", async () => {
      const user = userEvent.setup();
      await renderSession();

      await openEntryForSet3(user);

      expect(screen.getByLabelText("Set type")).toHaveProp("role", "radiogroup");
      expect(typeControl().getByRole("radio", { name: "Working" })).toBeChecked();
      expect(typeControl().getByRole("radio", { name: "Warm-up" })).not.toBeChecked();
    });

    it("should log a warm-up: the W mark, the header count unchanged and the row still to do kept", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await openEntryForSet3(user);

      await user.press(typeControl().getByRole("radio", { name: "Warm-up" }));
      await user.press(screen.getByRole("button", { name: "Log set" }));

      expect(await legPress.findByText("W")).toBeOnTheScreen();
      expect(storedTypeOfLastLegPressSet()).toBe("warmup");
      expect(screen.getByText("30:00 · 8 of 16 sets")).toBeOnTheScreen();
      expect(legPress.getByRole("button", { name: /^Log set 3/ })).toBeOnTheScreen();
    });

    it("should log a drop set: the D mark, counted as a working set", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await openEntryForSet3(user);

      await user.press(typeControl().getByRole("radio", { name: "Drop" }));
      await user.press(screen.getByRole("button", { name: "Log set" }));

      expect(await legPress.findByText("D")).toBeOnTheScreen();
      expect(storedTypeOfLastLegPressSet()).toBe("drop");
      expect(await screen.findByText("30:00 · 9 of 16 sets")).toBeOnTheScreen();
    });

    it("should leave the check of a row logging a working set", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await screen.findByText("30:00 · 8 of 16 sets");

      await user.press(await legPress.findByRole("button", { name: /^Log set 3/ }));

      await screen.findByText("30:00 · 9 of 16 sets");
      expect(storedTypeOfLastLegPressSet()).toBe("working");
    });

    it("should have Same again log the last set's numbers with the chosen type", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await openEntryForSet3(user);

      await user.press(typeControl().getByRole("radio", { name: "Failure" }));
      await user.press(screen.getByRole("button", { name: /^Same again/ }));

      expect(await legPress.findByText("F")).toBeOnTheScreen();
      expect(storedTypeOfLastLegPressSet()).toBe("failure");
    });

    it("should keep the typed load and reps when the type changes", async () => {
      const user = userEvent.setup();
      await renderSession();
      await openEntryForSet3(user);
      await user.clear(screen.getByLabelText("Load, kg"));
      await user.type(screen.getByLabelText("Load, kg"), "70");
      await user.clear(screen.getByLabelText("Reps"));
      await user.type(screen.getByLabelText("Reps"), "8");

      await user.press(typeControl().getByRole("radio", { name: "Warm-up" }));

      expect(screen.getByLabelText("Load, kg")).toHaveDisplayValue("70");
      expect(screen.getByLabelText("Reps")).toHaveDisplayValue("8");
      expect(screen.getByText("Warm-up set")).toBeOnTheScreen();
    });
  });

  describe("a row added with Add set", () => {
    it("should open the entry on the type the row shows, and log the type chosen in the control", async () => {
      trainBackend.activeSession = goldenLegsOpen(undefined, [
        loggedSetRow(GOLDEN_SESSION_ID, "legPress", 20, {
          position: 20,
          set_type: "drop",
          performed_at: "2026-10-15T18:58:00+01:00",
          load_kg: 150,
          reps: 9,
          rir: 0,
        }),
      ]);
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await user.press(legPress.getByRole("button", { name: "Add set" }));
      expect(
        legPress.getByRole("button", { name: "Log drop set, 150 kilograms, 9 reps" }),
      ).toBeOnTheScreen();

      await user.press(legPress.getByRole("button", { name: /^Leg press, drop set/ }));

      expect(await screen.findByLabelText("Load, kg")).toHaveDisplayValue("150");
      expect(screen.getByLabelText("Reps")).toHaveDisplayValue("9");
      expect(typeControl().getByRole("radio", { name: "Drop" })).toBeChecked();
      await user.press(typeControl().getByRole("radio", { name: "Failure" }));
      await user.press(screen.getByRole("button", { name: "Log set" }));
      expect(await legPress.findByText("F")).toBeOnTheScreen();
      expect(storedTypeOfLastLegPressSet()).toBe("failure");
    });
  });

  describe("the set number", () => {
    it("should open the set types sheet over the entry sheet, with the control's type checked", async () => {
      const user = userEvent.setup();
      await renderSession();
      await openEntryForSet3(user);

      await user.press(screen.getByRole("button", { name: NUMBER_OF_SET_3 }));

      expect(await screen.findByRole("heading", { name: "Set type" })).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: /^Working\./ })).toBeChecked();
      expect(screen.getByLabelText("Load, kg")).toBeOnTheScreen();
    });

    it("should put the keyboard away before the set types sheet opens over it", async () => {
      const dismiss = jest.spyOn(Keyboard, "dismiss");
      const user = userEvent.setup();
      await renderSession();
      await openEntryForSet3(user);

      await user.press(screen.getByRole("button", { name: NUMBER_OF_SET_3 }));

      expect(dismiss).toHaveBeenCalledTimes(1);
    });

    it("should change the control's type from the sheet and keep what was typed", async () => {
      const user = userEvent.setup();
      await renderSession();
      await openEntryForSet3(user);
      await user.clear(screen.getByLabelText("Load, kg"));
      await user.type(screen.getByLabelText("Load, kg"), "70");
      await user.press(screen.getByRole("button", { name: NUMBER_OF_SET_3 }));

      await pressInTypeSheet(user, /^Drop\./);

      expect(typeControl().getByRole("radio", { name: "Drop" })).toBeChecked();
      expect(screen.getByLabelText("Load, kg")).toHaveDisplayValue("70");
      expect(screen.getByText("Drop set · target 10 to 12 reps at RIR 1")).toBeOnTheScreen();
    });

    it("should log the type chosen through the sheet: the D mark", async () => {
      const user = userEvent.setup();
      await renderSession();
      const legPress = await exerciseCard("Leg press");
      await openEntryForSet3(user);
      await user.press(screen.getByRole("button", { name: NUMBER_OF_SET_3 }));
      await pressInTypeSheet(user, /^Drop\./);

      await user.press(screen.getByRole("button", { name: "Log set" }));

      expect(await legPress.findByText("D")).toBeOnTheScreen();
      expect(storedTypeOfLastLegPressSet()).toBe("drop");
    });

    it("should show the type chosen in the control when the sheet is opened after it", async () => {
      const user = userEvent.setup();
      await renderSession();
      await openEntryForSet3(user);
      await user.press(typeControl().getByRole("radio", { name: "Warm-up" }));

      await user.press(screen.getByRole("button", { name: "Set type, leg press warm-up set" }));

      expect(await screen.findByRole("radio", { name: /^Warm-up\./ })).toBeChecked();
      expect(screen.getByRole("radio", { name: /^Working\./ })).not.toBeChecked();
    });

    it("should close the set types sheet with the entry sheet, and not bring it back with the next opening", async () => {
      const user = userEvent.setup();
      await renderSession();
      await openEntryForSet3(user);
      await user.press(screen.getByRole("button", { name: NUMBER_OF_SET_3 }));
      await screen.findByRole("heading", { name: "Set type" });

      await fireEvent(entryDialog(), "accessibilityEscape");

      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: "Set type" })).not.toBeOnTheScreen();
      });
      await waitFor(() => {
        expect(screen.queryByLabelText("Load, kg")).not.toBeOnTheScreen();
      });
      await user.press(await screen.findByRole("button", { name: SET_3_CELLS }));
      expect(await screen.findByLabelText("Load, kg")).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Set type" })).not.toBeOnTheScreen();
    });

    it("should change nothing when the sheet is closed without a choice", async () => {
      const addListener = jest.spyOn(BackHandler, "addEventListener");
      const user = userEvent.setup();
      await renderSession();
      await openEntryForSet3(user);
      await user.press(screen.getByRole("button", { name: NUMBER_OF_SET_3 }));
      await screen.findByRole("heading", { name: "Set type" });

      const pressBack = addListener.mock.calls.at(-1)?.[1];
      await act(() => {
        pressBack?.({ type: "hardwareBackPress", timeStamp: 0 });
      });

      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: "Set type" })).not.toBeOnTheScreen();
      });
      expect(typeControl().getByRole("radio", { name: "Working" })).toBeChecked();
      expect(trainBackend.writes).toEqual([]);
    });
  });

  describe("the next set", () => {
    it("should open on the slot's own type again, not the one last chosen", async () => {
      const user = userEvent.setup();
      await renderSession();
      await openEntryForSet3(user);
      await user.press(typeControl().getByRole("radio", { name: "Warm-up" }));
      await user.press(screen.getByRole("button", { name: "Log set" }));
      await waitFor(() => {
        expect(screen.queryByLabelText("Load, kg")).not.toBeOnTheScreen();
      });

      await user.press(await screen.findByRole("button", { name: SET_3_CELLS }));

      expect(await screen.findByLabelText("Load, kg")).toBeOnTheScreen();
      expect(typeControl().getByRole("radio", { name: "Working" })).toBeChecked();
    });
  });
});
