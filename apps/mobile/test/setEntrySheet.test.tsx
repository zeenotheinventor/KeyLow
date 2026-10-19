import { KeyLowProvider } from "@keylow/api-client";
import { cleanup, render, screen, userEvent, waitFor, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SetEntrySheet } from "../components/SetEntrySheet";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { exerciseIdOf, GOLDEN_SESSION_ID } from "./support/sessionGoldenLegs";
import { resetSetEntryBackend, setEntryBackend, setEntryClient } from "./support/setEntryBackend";
import { resetTrainBackend } from "./support/trainBackend";

import type { SetEntryOpening, SetEntrySheetProps } from "../components/SetEntrySheet";
import type { SetPrefill } from "@keylow/core/training";
import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };

const LEG_PRESS_ID = exerciseIdOf("legPress");

/** The golden leg press set 3: the session's last set was 180 × 11 at RIR 1, and last week's set 3 was 170 × 10. */
const goldenOpening: SetEntryOpening = {
  exerciseId: LEG_PRESS_ID,
  exerciseName: "Leg press",
  setType: "working",
  setNumber: 3,
  plan: { sets: 3, repMin: 10, repMax: 12, rir: 1 },
  prefill: { load_kg: 180, reps: 11, rir: 1, rpe: null, set_type: "working", source: "session" },
  lastWeek: { loadKg: 170, reps: 10 },
};

const highRirPrefill: SetPrefill = {
  load_kg: 180,
  reps: 11,
  rir: 8,
  rpe: null,
  set_type: "working",
  source: "session",
};

const nothingLogged: SetEntryOpening = {
  ...goldenOpening,
  prefill: { load_kg: null, reps: null, rir: null, rpe: null, set_type: "working", source: "none" },
  lastWeek: null,
};

let queryClient: QueryClient;

function sheetElement(props: Partial<SetEntrySheetProps> = {}, opening = goldenOpening) {
  return (
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={setEntryClient} queryClient={queryClient}>
          <SetEntrySheet
            entry={opening}
            open
            openingId={1}
            sessionId={GOLDEN_SESSION_ID}
            unit="kg"
            onClose={jest.fn()}
            {...props}
          />
        </KeyLowProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

async function renderSheet(props: Partial<SetEntrySheetProps> = {}, opening = goldenOpening) {
  const onClose = props.onClose ?? jest.fn();
  const view = await render(sheetElement({ ...props, onClose }, opening));
  return { onClose, view };
}

const loadField = () => screen.getByLabelText("Load, kg");
const repsField = () => screen.getByLabelText("Reps");
const logSet = () => screen.getByRole("button", { name: "Log set" });

describe("the set entry sheet", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SetEntrySheet"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetTrainBackend();
    resetSetEntryBackend();
    setEntryBackend.exercise = {
      id: LEG_PRESS_ID,
      name: "Leg press",
      equipment: "machine",
      mechanic: "compound",
      exercise_muscles: [{ muscle_id: "quads", role: "primary", weight: 1 }],
    };
    setEntryBackend.liveSets = 2;
    queryClient = createDiaryQueryClient();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    queryClient.clear();
  });

  describe("opening on the golden leg press set 3", () => {
    it("should be a dialog named for the exercise and the set", async () => {
      await renderSheet();

      expect(screen.getByLabelText("Leg press, set 3")).toHaveProp("role", "dialog");
      expect(screen.getByRole("heading", { name: "Leg press" })).toBeOnTheScreen();
      expect(screen.getByText("Set 3 of 3 · target 10 to 12 reps at RIR 1")).toBeOnTheScreen();
    });

    it("should open with 180 and 11 in the fields and RIR 1 chosen", async () => {
      await renderSheet();

      expect(loadField()).toHaveDisplayValue("180");
      expect(repsField()).toHaveDisplayValue("11");
      expect(screen.getByRole("radio", { name: "1" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "2" })).not.toBeChecked();
    });

    it("should ask for the decimal keyboard for the load and the number keyboard for the reps", async () => {
      await renderSheet();

      expect(loadField()).toHaveProp("keyboardType", "decimal-pad");
      expect(repsField()).toHaveProp("keyboardType", "number-pad");
    });

    it("should draw the load and the reps as 32 point numbers, as the boards do", async () => {
      await renderSheet();

      expect(loadField()).toHaveStyle({ fontSize: 32, lineHeight: 40 });
      expect(repsField()).toHaveStyle({ fontSize: 32, lineHeight: 40 });
    });

    it("should draw the RIR chips 44 points high in one row of equal columns", async () => {
      await renderSheet();

      expect(screen.getByLabelText("RIR, reps in reserve")).toHaveStyle({
        flexDirection: "row",
        columnGap: 6,
      });
      expect(screen.getByRole("radio", { name: "0" })).toHaveStyle({ height: 44 });
    });

    it("should say where the numbers came from, with last week's set", async () => {
      await renderSheet();

      expect(
        screen.getByText(
          "Filled from your last set: 180 kg × 11 at RIR 1. Last week: 170 kg × 10.",
        ),
      ).toBeOnTheScreen();
    });

    it("should say the numbers came from last time when the session has no set of the exercise yet", async () => {
      await renderSheet(
        {},
        {
          ...goldenOpening,
          setNumber: 1,
          prefill: {
            load_kg: 170,
            reps: 12,
            rir: 2,
            rpe: null,
            set_type: "working",
            source: "last_time",
          },
          lastWeek: null,
        },
      );

      expect(screen.getByText("Filled from last time: 170 kg × 12 at RIR 2.")).toBeOnTheScreen();
    });

    it("should say there is nothing to fill from, and open blank, for an exercise never logged", async () => {
      await renderSheet({}, nothingLogged);

      expect(screen.getByText("Nothing logged for this exercise yet.")).toBeOnTheScreen();
      expect(loadField()).toHaveDisplayValue("");
      expect(repsField()).toHaveDisplayValue("");
      expect(screen.queryByRole("radio", { checked: true })).not.toBeOnTheScreen();
    });

    it("should offer RIR from 0 to 6+ as a radio group with its help line", async () => {
      await renderSheet();
      const chips = screen.getByLabelText("RIR, reps in reserve");
      const group = within(chips);

      expect(chips).toHaveProp("role", "radiogroup");

      expect(group.getAllByRole("radio")).toHaveLength(7);
      for (const label of ["0", "1", "2", "3", "4", "5", "6+"]) {
        expect(group.getByRole("radio", { name: label })).toBeOnTheScreen();
      }
      expect(
        screen.getByText("Optional. Left blank, a working set counts as hard."),
      ).toBeOnTheScreen();
    });

    it("should name Same again for the numbers it repeats", async () => {
      await renderSheet();

      expect(
        screen.getByRole("button", { name: "Same again, 180 kilograms, 11 reps, RIR 1" }),
      ).toBeOnTheScreen();
    });

    it("should offer no Same again when there is nothing to repeat", async () => {
      await renderSheet({}, nothingLogged);

      expect(screen.queryByRole("button", { name: /^Same again/ })).not.toBeOnTheScreen();
    });
  });

  describe("the set number", () => {
    it("should not be a button while no screen handles it", async () => {
      await renderSheet();

      expect(screen.queryByRole("button", { name: /^Set type/ })).not.toBeOnTheScreen();
    });

    it("should be a button once a screen handles it", async () => {
      const onPressSetNumber = jest.fn();
      const user = userEvent.setup();
      await renderSheet({ onPressSetNumber });

      await user.press(screen.getByRole("button", { name: "Set type, leg press set 3" }));

      expect(onPressSetNumber).toHaveBeenCalledTimes(1);
    });
  });

  describe("Log set", () => {
    it("should store the filled numbers as a working set at the next place, and close", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderSheet();

      await user.press(logSet());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(setEntryBackend.inserts).toMatchObject([
        {
          session_id: GOLDEN_SESSION_ID,
          exercise_id: LEG_PRESS_ID,
          set_type: "working",
          load_kg: 180,
          reps: 11,
          rir: 1,
          rpe: null,
          position: 2,
        },
      ]);
    });

    it("should store what was typed and chosen instead of what was filled", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderSheet();

      await user.clear(loadField());
      await user.type(loadField(), "182.5");
      await user.clear(repsField());
      await user.type(repsField(), "10");
      await user.press(screen.getByRole("radio", { name: "3" }));
      await user.press(logSet());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(setEntryBackend.inserts).toMatchObject([{ load_kg: 182.5, reps: 10, rir: 3 }]);
    });

    it("should store 6 for the 6+ chip", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderSheet();

      await user.press(screen.getByRole("radio", { name: "6+" }));
      await user.press(logSet());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(setEntryBackend.inserts).toMatchObject([{ rir: 6 }]);
    });

    it("should store a set with no load for a blank load field, and with no RIR when none is filled", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderSheet(
        {},
        {
          ...nothingLogged,
          prefill: {
            load_kg: null,
            reps: 12,
            rir: null,
            rpe: null,
            set_type: "working",
            source: "last_time",
          },
        },
      );

      expect(screen.queryByText(/^Enter/)).not.toBeOnTheScreen();
      await user.press(logSet());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(setEntryBackend.inserts).toMatchObject([{ load_kg: null, reps: 12, rir: null }]);
    });
  });

  describe("Same again", () => {
    it("should log, in one tap, a set identical to the one the sheet was filled from, and close", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderSheet();

      await user.press(screen.getByRole("button", { name: /^Same again/ }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(setEntryBackend.inserts).toMatchObject([
        { set_type: "working", load_kg: 180, reps: 11, rir: 1 },
      ]);
    });

    it("should log the set it names, not what has been typed since", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderSheet();

      await user.clear(loadField());
      await user.type(loadField(), "200");
      await user.press(screen.getByRole("radio", { name: "4" }));
      await user.press(screen.getByRole("button", { name: /^Same again/ }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(setEntryBackend.inserts).toMatchObject([{ load_kg: 180, reps: 11, rir: 1 }]);
    });

    it("should log a fourth set identical to the third that Log set stored", async () => {
      const user = userEvent.setup();
      const { onClose, view } = await renderSheet();
      await user.press(logSet());
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      const [third] = setEntryBackend.inserts;

      await view.unmount();
      await render(
        sheetElement(
          { onClose },
          {
            ...goldenOpening,
            setNumber: 4,
            plan: { sets: 3, repMin: 10, repMax: 12, rir: 1 },
            prefill: {
              load_kg: Number(third?.["load_kg"]),
              reps: Number(third?.["reps"]),
              rir: Number(third?.["rir"]),
              rpe: null,
              set_type: "working",
              source: "session",
            },
            lastWeek: null,
          },
        ),
      );
      await user.press(screen.getByRole("button", { name: /^Same again/ }));

      await waitFor(() => {
        expect(setEntryBackend.inserts).toHaveLength(2);
      });
      expect(setEntryBackend.inserts[1]).toMatchObject({
        set_type: third?.["set_type"],
        load_kg: third?.["load_kg"],
        reps: third?.["reps"],
        rir: third?.["rir"],
        position: 3,
      });
      expect(screen.getByText("Set 4 · target 10 to 12 reps at RIR 1")).toBeOnTheScreen();
    });
  });

  describe("validation", () => {
    it("should state both rules, dim Log set and write nothing for a load of 1800 and 11.5 reps", async () => {
      const user = userEvent.setup();
      await renderSheet();

      await user.clear(loadField());
      await user.type(loadField(), "1800");
      await user.clear(repsField());
      await user.type(repsField(), "11.5");
      await user.press(logSet());

      expect(screen.getByText("Enter a load from 0 to 1,000 kg.")).toBeOnTheScreen();
      expect(screen.getByText("Enter whole reps from 1 to 100.")).toBeOnTheScreen();
      expect(screen.getAllByRole("alert")).toHaveLength(2);
      expect(logSet()).toBeDisabled();
      expect(setEntryBackend.inserts).toHaveLength(0);
    });

    it("should leave the filled line out while a field shows its error, and bring it back when the values are right", async () => {
      const user = userEvent.setup();
      await renderSheet();
      const filledLine = /^Filled from your last set/;

      await user.clear(repsField());
      await user.type(repsField(), "11.5");
      expect(screen.queryByText(filledLine)).not.toBeOnTheScreen();

      await user.clear(repsField());
      await user.type(repsField(), "9");
      expect(screen.getByText(filledLine)).toBeOnTheScreen();
      expect(logSet()).toBeEnabled();
    });

    it("should refuse a thousands separator with its own sentence", async () => {
      const user = userEvent.setup();
      await renderSheet();

      await user.clear(loadField());
      await user.type(loadField(), "1,000");

      expect(
        screen.getByText(
          "Enter the load without a thousands separator, such as 1000, or with a decimal, such as 52.5.",
        ),
      ).toBeOnTheScreen();
      expect(logSet()).toBeDisabled();
    });

    it("should keep Log set off, with no error shown, for the reps an untouched blank sheet lacks", async () => {
      await renderSheet({}, nothingLogged);

      expect(logSet()).toBeDisabled();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should keep Same again for the numbers it names while the typed values are wrong", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderSheet();

      await user.clear(repsField());
      await user.type(repsField(), "0");
      await user.press(screen.getByRole("button", { name: /^Same again/ }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(setEntryBackend.inserts).toMatchObject([{ reps: 11 }]);
    });
  });

  describe("in pounds", () => {
    // 225 lb is 102.058 kg, to the gram.
    const poundsOpening: SetEntryOpening = {
      ...goldenOpening,
      prefill: {
        load_kg: 102.058,
        reps: 11,
        rir: 1,
        rpe: null,
        set_type: "working",
        source: "session",
      },
      lastWeek: { loadKg: 77.111, reps: 10 },
    };

    it("should name the load field in pounds and show the stored kilograms as 225", async () => {
      await renderSheet({ unit: "lb" }, poundsOpening);

      expect(screen.getByLabelText("Load, lb")).toHaveDisplayValue("225");
      expect(
        screen.getByText(
          "Filled from your last set: 225 lb × 11 at RIR 1. Last week: 170 lb × 10.",
        ),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Same again, 225 pounds, 11 reps, RIR 1" }),
      ).toBeOnTheScreen();
    });

    it("should store 225 typed in pounds as 102,058 grams", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderSheet({ unit: "lb" }, nothingLogged);

      await user.type(screen.getByLabelText("Load, lb"), "225");
      await user.type(repsField(), "11");
      await user.press(logSet());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(setEntryBackend.inserts).toMatchObject([{ load_kg: 102.058, reps: 11 }]);
    });

    it("should word the load rule in pounds", async () => {
      const user = userEvent.setup();
      await renderSheet({ unit: "lb" }, poundsOpening);

      await user.clear(screen.getByLabelText("Load, lb"));
      await user.type(screen.getByLabelText("Load, lb"), "2300");

      expect(screen.getByText("Enter a load from 0 to 2,204 lb.")).toBeOnTheScreen();
    });

    it("should show 225 again when the stored set is opened again", async () => {
      const user = userEvent.setup();
      const { onClose, view } = await renderSheet({ unit: "lb" }, nothingLogged);
      await user.type(screen.getByLabelText("Load, lb"), "225");
      await user.type(repsField(), "11");
      await user.press(logSet());
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      const [stored] = setEntryBackend.inserts;

      await view.unmount();
      await render(
        sheetElement(
          { unit: "lb" },
          {
            ...goldenOpening,
            prefill: {
              load_kg: Number(stored?.["load_kg"]),
              reps: 11,
              rir: null,
              rpe: null,
              set_type: "working",
              source: "session",
            },
          },
        ),
      );

      expect(screen.getByLabelText("Load, lb")).toHaveDisplayValue("225");
    });

    it("should log Same again to the gram, though 102.058 looks like a thousands separator typed", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderSheet({ unit: "lb" }, poundsOpening);

      await user.press(screen.getByRole("button", { name: /^Same again/ }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(setEntryBackend.inserts).toMatchObject([{ load_kg: 102.058, reps: 11, rir: 1 }]);
    });
  });

  describe("RIR", () => {
    it("should clear the choice when the chosen chip is pressed again, and store the set with no RIR", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderSheet();

      await user.press(screen.getByRole("radio", { name: "1" }));

      expect(screen.queryByRole("radio", { checked: true })).not.toBeOnTheScreen();
      await user.press(logSet());
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(setEntryBackend.inserts).toMatchObject([{ load_kg: 180, reps: 11, rir: null }]);
    });

    it("should show the 6+ chip chosen for a prefilled RIR above 6 and store the prefilled value unchanged", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderSheet({}, { ...goldenOpening, prefill: highRirPrefill });

      expect(screen.getByRole("radio", { name: "6+" })).toBeChecked();
      await user.press(logSet());
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(setEntryBackend.inserts).toMatchObject([{ rir: 8 }]);
    });

    it("should store the chip's number once another chip is picked over a prefilled RIR above 6", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderSheet({}, { ...goldenOpening, prefill: highRirPrefill });

      await user.press(screen.getByRole("radio", { name: "2" }));
      await user.press(logSet());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(setEntryBackend.inserts).toMatchObject([{ rir: 2 }]);
    });
  });

  describe("a load left as it was filled", () => {
    const halfKilogramOpening: SetEntryOpening = {
      ...goldenOpening,
      prefill: {
        load_kg: 97.5,
        reps: 11,
        rir: 1,
        rpe: null,
        set_type: "working",
        source: "session",
      },
    };

    it("should store the exact kilograms of the prefill for a pound user, not the value rounded through pounds", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderSheet({ unit: "lb" }, halfKilogramOpening);
      expect(screen.getByLabelText("Load, lb")).toHaveDisplayValue("215");

      await user.press(logSet());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(setEntryBackend.inserts).toMatchObject([{ load_kg: 97.5, reps: 11, rir: 1 }]);
    });

    it("should store the load typed once the field is edited, in pounds", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderSheet({ unit: "lb" }, halfKilogramOpening);

      await user.clear(screen.getByLabelText("Load, lb"));
      await user.type(screen.getByLabelText("Load, lb"), "215");
      await user.press(logSet());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(setEntryBackend.inserts).toMatchObject([{ load_kg: 97.522 }]);
    });

    it("should leave a changed reps count out of it: the load is still the prefill's exact kilograms", async () => {
      const user = userEvent.setup();
      const { onClose } = await renderSheet({ unit: "lb" }, halfKilogramOpening);

      await user.clear(repsField());
      await user.type(repsField(), "9");
      await user.press(logSet());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(setEntryBackend.inserts).toMatchObject([{ load_kg: 97.5, reps: 9 }]);
    });
  });

  describe("one opening after another", () => {
    const legCurlOpening: SetEntryOpening = {
      ...goldenOpening,
      exerciseId: exerciseIdOf("legCurl"),
      exerciseName: "Seated leg curl",
      setNumber: 1,
      prefill: {
        load_kg: 45,
        reps: 12,
        rir: 2,
        rpe: null,
        set_type: "working",
        source: "last_time",
      },
      lastWeek: null,
    };

    it("should start the next opening from its own numbers when it comes while the last form is still on its way out", async () => {
      const user = userEvent.setup();
      const { onClose, view } = await renderSheet();
      await user.clear(loadField());
      await user.type(loadField(), "190");
      await user.press(logSet());
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });

      await view.rerender(sheetElement({ open: false, openingId: 1, onClose }));
      await view.rerender(sheetElement({ open: true, openingId: 2, onClose }, legCurlOpening));

      expect(screen.getByLabelText("Seated leg curl, set 1")).toHaveProp("role", "dialog");
      expect(loadField()).toHaveDisplayValue("45");
      expect(repsField()).toHaveDisplayValue("12");
      expect(screen.getByRole("radio", { name: "2" })).toBeChecked();
    });
  });

  describe("a write that has not answered", () => {
    it("should keep Log set busy and inert, Same again off, and ask for no second insert", async () => {
      // A busy Log set hides its label behind the spinner, so it is found by being busy.
      const loggingSet = () => screen.getByRole("button", { busy: true });
      setEntryBackend.hangInserts = true;
      const user = userEvent.setup();
      const { onClose } = await renderSheet();

      await user.press(logSet());
      await waitFor(() => {
        expect(setEntryBackend.insertAttempts).toBe(1);
      });

      expect(loggingSet()).toBeBusy();
      expect(screen.getByRole("button", { name: /^Same again/ })).toBeDisabled();
      await user.press(loggingSet());
      await user.press(screen.getByRole("button", { name: /^Same again/ }));
      expect(setEntryBackend.insertAttempts).toBe(1);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("a failed write", () => {
    it("should keep the typed values, stay open and let Log set be pressed again", async () => {
      setEntryBackend.failInserts = true;
      const user = userEvent.setup();
      const { onClose } = await renderSheet();
      await user.clear(loadField());
      await user.type(loadField(), "185");
      await user.press(screen.getByRole("radio", { name: "2" }));

      await user.press(logSet());
      await waitFor(() => {
        expect(logSet()).toBeEnabled();
      });

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Your set did not save. Check your connection, then try again.",
      );
      expect(loadField()).toHaveDisplayValue("185");
      expect(repsField()).toHaveDisplayValue("11");
      expect(screen.getByRole("radio", { name: "2" })).toBeChecked();

      setEntryBackend.failInserts = false;
      await user.press(logSet());
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(setEntryBackend.inserts).toMatchObject([{ load_kg: 185, reps: 11, rir: 2 }]);
    });
  });

  describe("health data", () => {
    it("should write nothing to the console while a set is typed, logged and refused", async () => {
      setEntryBackend.failInserts = true;
      const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
        jest.spyOn(console, method).mockImplementation(() => undefined),
      );
      const user = userEvent.setup();
      await renderSheet();

      await user.clear(loadField());
      await user.type(loadField(), "1800");
      await user.clear(loadField());
      await user.type(loadField(), "185");
      await user.press(logSet());
      await waitFor(() => {
        expect(logSet()).toBeEnabled();
      });

      expect(spies.flatMap((spy) => spy.mock.calls)).toStrictEqual([]);
    });
  });
});
