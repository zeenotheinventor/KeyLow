import { cleanup, render, screen, userEvent, act } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SetEntrySheet } from "../components/SetEntrySheet";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { EditSetOpening, EditSetSheetProps } from "../components/SetEntrySheet";
import type { TestInstance } from "test-renderer";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };

/** Tuesday's barbell curl set 3: 30 kg for 9, no RIR, at 18:51 in London. */
const barbellCurl: EditSetOpening = {
  exerciseName: "Barbell Curl",
  setType: "working",
  setNumber: 3,
  performedAt: "2026-10-13T18:51:00+01:00",
  tz: "Europe/London",
  loadKg: 30,
  reps: 9,
  rir: null,
};

type Handlers = Pick<EditSetSheetProps, "onClose" | "onSave" | "onDelete">;

const handlers = (): Handlers => ({
  onClose: jest.fn(),
  onSave: jest.fn(() => Promise.resolve(true)),
  onDelete: jest.fn(() => Promise.resolve(true)),
});

function sheetElement(
  props: Partial<EditSetSheetProps> & Handlers,
  entry: EditSetOpening = barbellCurl,
) {
  return (
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <ThemeProvider fixedPreference="dark">
        <SetEntrySheet entry={entry} mode="edit" open openingId={1} unit="kg" {...props} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

async function renderSheet(
  props: Partial<EditSetSheetProps> = {},
  entry: EditSetOpening = barbellCurl,
) {
  const given = { ...handlers(), ...props };
  const user = userEvent.setup();
  const view = await render(sheetElement(given, entry));
  return { ...given, user, view };
}

const loadField = (unit = "kg") => screen.getByLabelText(`Load, ${unit}`);
const repsField = () => screen.getByLabelText("Reps");
const saveChanges = () => screen.getByRole("button", { name: "Save changes" });
const deleteSet = () => screen.getByRole("button", { name: "Delete set" });

// Two presses before React has drawn anything between them, which two awaited presses never do. A press is
// the host element's click, so the same handler runs twice inside one act, as a double tap's would.
type ClickHandler = (event: { stopPropagation: () => void; nativeEvent: object }) => void;
const isClickHandler = (value: unknown): value is ClickHandler => typeof value === "function";

async function pressTwiceInTheSameMoment(button: TestInstance) {
  const { onClick } = button.props;
  if (!isClickHandler(onClick)) {
    throw new Error("The button has no click handler");
  }
  await act(() => {
    for (let press = 0; press < 2; press += 1) {
      onClick({ stopPropagation: () => undefined, nativeEvent: {} });
    }
  });
}

describe("the set entry sheet, editing a set of a past session", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SetEntrySheet"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("opening on Tuesday's barbell curl set 3", () => {
    it("should be a dialog named for the exercise and the set", async () => {
      await renderSheet();

      expect(screen.getByLabelText("Edit Barbell Curl, set 3")).toHaveProp("role", "dialog");
      expect(screen.getByRole("heading", { name: "Barbell Curl" })).toBeOnTheScreen();
    });

    it("should say which set it is and when it was done, in the person's zone", async () => {
      await renderSheet();

      expect(screen.getByText("Set 3 · Tue 13 Oct, 18:51")).toBeOnTheScreen();
    });

    it("should open with the stored 30 and 9 in the fields and no RIR chosen", async () => {
      await renderSheet();

      expect(loadField()).toHaveDisplayValue("30");
      expect(repsField()).toHaveDisplayValue("9");
      expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
    });

    it("should say a working set with no RIR counts as hard, and that the change reaches the heat", async () => {
      await renderSheet();

      expect(
        screen.getByText("Not entered, so this working set counts as hard."),
      ).toBeOnTheScreen();
      expect(
        screen.getByText("Changing a past set updates that day's heat and the week's sets."),
      ).toBeOnTheScreen();
    });

    it("should offer Delete set and Save changes, and neither Same again nor Log set", async () => {
      await renderSheet();

      expect(deleteSet()).toBeOnTheScreen();
      expect(saveChanges()).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Same again/ })).toBeNull();
      expect(screen.queryByRole("button", { name: "Log set" })).toBeNull();
    });

    it("should open with the stored RIR chosen, and drop the hint, for a set that has one", async () => {
      await renderSheet({}, { ...barbellCurl, rir: 2 });

      expect(screen.getByRole("radio", { name: "2" })).toBeChecked();
      expect(screen.queryByText("Not entered, so this working set counts as hard.")).toBeNull();
    });

    it("should not call a warm-up with no RIR a hard working set", async () => {
      await renderSheet({}, { ...barbellCurl, setType: "warmup" });

      expect(screen.getByText(/^Warm-up set/)).toBeOnTheScreen();
      expect(screen.queryByText("Not entered, so this working set counts as hard.")).toBeNull();
    });

    it("should open a bodyweight set with an empty load", async () => {
      await renderSheet({}, { ...barbellCurl, loadKg: null });

      expect(loadField()).toHaveDisplayValue("");
    });
  });

  describe("saving", () => {
    it("should send only the reps, and close, when only the reps changed", async () => {
      const { user, onSave, onClose } = await renderSheet();

      await user.clear(repsField());
      await user.type(repsField(), "10");
      await user.press(saveChanges());

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith({ reps: 10 });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should send the load in kilograms, to the gram, with the RIR chosen", async () => {
      const { user, onSave } = await renderSheet();

      await user.clear(loadField());
      await user.type(loadField(), "32.5");
      await user.press(screen.getByRole("radio", { name: "3" }));
      await user.press(saveChanges());

      expect(onSave).toHaveBeenCalledWith({ loadKg: 32.5, rir: 3 });
    });

    it("should send a cleared RIR as none", async () => {
      const { user, onSave } = await renderSheet({}, { ...barbellCurl, rir: 2 });

      await user.press(screen.getByRole("radio", { name: "2" }));
      await user.press(saveChanges());

      expect(onSave).toHaveBeenCalledWith({ rir: null });
    });

    it("should write nothing, and close, when nothing changed", async () => {
      const { user, onSave, onClose } = await renderSheet();

      await user.press(saveChanges());

      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should write nothing when a value is typed and then put back", async () => {
      const { user, onSave } = await renderSheet();

      await user.clear(repsField());
      await user.type(repsField(), "12");
      await user.clear(repsField());
      await user.type(repsField(), "9");
      await user.press(saveChanges());

      expect(onSave).not.toHaveBeenCalled();
    });

    it("should state the rule, dim Save changes and write nothing for 0 reps", async () => {
      const { user, onSave } = await renderSheet();

      await user.clear(repsField());
      await user.type(repsField(), "0");
      await user.press(saveChanges());

      expect(screen.getByText("Enter whole reps from 1 to 100.")).toBeOnTheScreen();
      expect(saveChanges()).toBeDisabled();
      expect(onSave).not.toHaveBeenCalled();
    });

    it("should stay open with the typed numbers when the save does not go through", async () => {
      const onSave = jest.fn(() => Promise.resolve(false));
      const { user, onClose } = await renderSheet({ onSave });

      await user.clear(repsField());
      await user.type(repsField(), "11");
      await user.press(saveChanges());

      expect(onClose).not.toHaveBeenCalled();
      expect(repsField()).toHaveDisplayValue("11");
      expect(saveChanges()).toBeEnabled();
    });

    it("should save once for two presses in the same moment", async () => {
      const { user, onSave } = await renderSheet();
      await user.clear(repsField());
      await user.type(repsField(), "10");

      await pressTwiceInTheSameMoment(saveChanges());

      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  describe("in pounds", () => {
    // 61.235 kg is 135 lb, as 135 lb is stored.
    const inPounds = { ...barbellCurl, loadKg: 61.235 };

    it("should open in pounds, labelled Load, lb", async () => {
      await renderSheet({ unit: "lb" }, inPounds);

      expect(loadField("lb")).toHaveDisplayValue("135");
    });

    it("should send the typed pounds as kilograms to the gram", async () => {
      const { user, onSave } = await renderSheet({ unit: "lb" }, inPounds);

      await user.clear(loadField("lb"));
      await user.type(loadField("lb"), "140");
      await user.press(saveChanges());

      expect(onSave).toHaveBeenCalledWith({ loadKg: 63.503 });
    });

    it("should leave the stored kilograms alone when only the reps change", async () => {
      const { user, onSave } = await renderSheet({ unit: "lb" }, { ...barbellCurl, loadKg: 60 });
      expect(loadField("lb")).toHaveDisplayValue("132.3");

      await user.clear(repsField());
      await user.type(repsField(), "10");
      await user.press(saveChanges());

      expect(onSave).toHaveBeenCalledWith({ reps: 10 });
    });
  });

  describe("deleting", () => {
    it("should ask for the delete and close", async () => {
      const { user, onDelete, onSave, onClose } = await renderSheet();

      await user.press(deleteSet());

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onSave).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should stay open when the delete does not go through", async () => {
      const onDelete = jest.fn(() => Promise.resolve(false));
      const { user, onClose } = await renderSheet({ onDelete });

      await user.press(deleteSet());

      expect(onClose).not.toHaveBeenCalled();
      expect(deleteSet()).toBeEnabled();
    });

    it("should delete once for two presses in the same moment", async () => {
      const { onDelete } = await renderSheet();

      await pressTwiceInTheSameMoment(deleteSet());

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("should do one thing for a Delete set and a Save changes in the same moment", async () => {
      const { user, onDelete, onSave } = await renderSheet();
      await user.clear(repsField());
      await user.type(repsField(), "10");
      const saveButton = saveChanges();
      const deleteButton = deleteSet();

      await act(() => {
        const click = { stopPropagation: () => undefined, nativeEvent: {} };
        for (const { props } of [deleteButton, saveButton]) {
          const { onClick } = props;
          if (isClickHandler(onClick)) {
            onClick(click);
          }
        }
      });

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe("opening a second time", () => {
    it("should start again from the next set's numbers when the opening changes", async () => {
      const { user, view } = await renderSheet();
      await user.clear(repsField());
      await user.type(repsField(), "12");

      await view.rerender(
        sheetElement({ ...handlers(), openingId: 2 }, { ...barbellCurl, setNumber: 4, reps: 7 }),
      );

      expect(repsField()).toHaveDisplayValue("7");
      expect(screen.getByText("Set 4 · Tue 13 Oct, 18:51")).toBeOnTheScreen();
    });
  });
});
