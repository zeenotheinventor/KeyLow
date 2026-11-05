import { KeyLowProvider } from "@keylow/api-client";
import { ADD_EXERCISE, CUSTOM_EXERCISE, MUSCLE_GROUP_NAMES, MUSCLE_NAMES } from "@keylow/core/copy";
import { EQUIPMENT, MUSCLE_IDS } from "@keylow/core/training";
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
import { BackHandler } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { AddExerciseSheet } from "../components/AddExerciseSheet";
import { ThemeProvider } from "../lib/theme";
import {
  customExerciseBackend,
  customExerciseClient,
  resetCustomExerciseBackend,
  SAVED_EXERCISE_ID,
} from "./support/customExerciseBackend";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resetTrainBackend } from "./support/trainBackend";
import { installVirtualClock } from "./support/virtualClock";

import type { AddExerciseSheetProps } from "../components/AddExerciseSheet";
import type { QueryClient } from "@tanstack/react-query";
import type { TestInstance } from "test-renderer";

// The New exercise form inside the Add exercise sheet, opened by the Create row, over a fake database that
// answers `save_exercise` as the real one does.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

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

const SAVE_TO_LEGS = "Save and add to Legs";
const BOARD_NAME = "Lean-away cable raise";

let queryClient: QueryClient;

type SessionOverrides = {
  dayName?: string | null;
  onAddToSession?: jest.Mock;
  onClose?: jest.Mock;
};

const sessionProps = ({
  dayName = "Legs",
  onAddToSession = jest.fn(),
  onClose = jest.fn(),
}: SessionOverrides = {}): AddExerciseSheetProps => ({
  mode: "session",
  dayName,
  open: true,
  onAddToSession,
  onClose,
});

async function renderSheet(props: AddExerciseSheetProps) {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={customExerciseClient} queryClient={queryClient}>
        <AddExerciseSheet {...props} />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

/** Searches for the words and presses the Create row, which opens the form with them as the name. */
async function openForm(props: AddExerciseSheetProps, words = "lateral raise") {
  await renderSheet(props);
  const user = userEvent.setup();
  await user.type(await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }), words);
  await user.press(await screen.findByRole("button", { name: `Create "${words}"` }));
  await screen.findByRole("heading", { name: CUSTOM_EXERCISE.title });
  return user;
}

type User = Awaited<ReturnType<typeof openForm>>;

// The kit gives a text field a label and no role, and the role query does not resolve a radiogroup, so a field
// and a group are found by their label, as the other form tests do. What is in a group is found by role.
const nameField = () => screen.getByLabelText(CUSTOM_EXERCISE.nameLabel);
const group = (name: string) => screen.getByLabelText(name);
const saveButton = (name = SAVE_TO_LEGS) => screen.getByRole("button", { name });

async function chooseEquipment(user: User, label: string) {
  await user.press(
    within(group(CUSTOM_EXERCISE.equipmentLabel)).getByRole("radio", { name: label }),
  );
}

async function addMuscle(user: User, muscleName: string) {
  await user.press(screen.getByRole("button", { name: CUSTOM_EXERCISE.addMuscleAction }));
  await user.press(await screen.findByRole("button", { name: muscleName }));
  await screen.findByRole("heading", { name: CUSTOM_EXERCISE.title });
}

async function chooseRole(user: User, muscleName: string, role: string) {
  await user.press(
    within(group(`Role for ${muscleName}`)).getByRole("radio", {
      name: role,
    }),
  );
}

/** The board's example: the name, Cable, Side delts as primary and Upper traps as secondary. */
async function fillBoardExample(user: User) {
  await fireEvent.changeText(nameField(), BOARD_NAME);
  await chooseEquipment(user, "Cable");
  await addMuscle(user, MUSCLE_NAMES.delt_side);
  await addMuscle(user, MUSCLE_NAMES.traps_upper);
}

describe("the New exercise form", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/AddExerciseSheet",
      "components/ExerciseRow",
      "app",
    ]);
  });

  beforeEach(() => {
    installVirtualClock();
    registerAppStyles(kitStyles);
    resetTrainBackend();
    resetCustomExerciseBackend();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.useRealTimers();
  });

  describe("opening", () => {
    it("should open from the Create row with the searched words as the name and their count", async () => {
      await openForm(sessionProps());

      expect(nameField()).toHaveDisplayValue("lateral raise");
      expect(screen.getByText("13 / 200")).toBeOnTheScreen();
      expect(
        screen.getByRole("heading", { name: CUSTOM_EXERCISE.musclesHeading }),
      ).toBeOnTheScreen();
      expect(screen.getByText(CUSTOM_EXERCISE.musclesHint)).toBeOnTheScreen();
      expect(screen.getByText(CUSTOM_EXERCISE.roleExplanation)).toBeOnTheScreen();
      expect(screen.getByText(CUSTOM_EXERCISE.privacyNote)).toBeOnTheScreen();
    });

    it("should leave the search behind and come back to it, with the words, from Back", async () => {
      const user = await openForm(sessionProps());
      expect(screen.queryByRole("searchbox", { name: ADD_EXERCISE.searchName })).toBeNull();

      await user.press(screen.getByRole("button", { name: CUSTOM_EXERCISE.backName }));

      expect(
        await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }),
      ).toHaveDisplayValue("lateral raise");
    });

    it("should offer all ten equipment values as radios, none chosen to start with", async () => {
      await openForm(sessionProps());

      const radios = within(group(CUSTOM_EXERCISE.equipmentLabel)).getAllByRole("radio");
      expect(radios).toHaveLength(EQUIPMENT.length);
      expect(EQUIPMENT).toHaveLength(10);
      for (const radio of radios) {
        expect(radio).not.toBeChecked();
      }
    });

    it("should check the equipment pressed and only that one", async () => {
      const user = await openForm(sessionProps());

      await chooseEquipment(user, "Cable");
      await chooseEquipment(user, "Machine");

      expect(screen.getByRole("radio", { name: "Machine" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Cable" })).not.toBeChecked();
    });
  });

  describe("the muscles", () => {
    it("should list all 22 muscles under their 7 groups, each one a button to press", async () => {
      const user = await openForm(sessionProps());

      await user.press(screen.getByRole("button", { name: CUSTOM_EXERCISE.addMuscleAction }));

      expect(
        await screen.findByRole("heading", { name: CUSTOM_EXERCISE.addMuscleAction }),
      ).toBeOnTheScreen();
      for (const groupName of Object.values(MUSCLE_GROUP_NAMES)) {
        expect(screen.getByRole("heading", { name: groupName })).toBeOnTheScreen();
      }
      for (const muscle of MUSCLE_IDS) {
        expect(screen.getByRole("button", { name: MUSCLE_NAMES[muscle] })).toBeOnTheScreen();
      }
      expect(MUSCLE_IDS).toHaveLength(22);
    });

    it("should add the first muscle as primary and later ones as secondary, with what each counts for", async () => {
      const user = await openForm(sessionProps());

      await addMuscle(user, MUSCLE_NAMES.delt_side);
      await addMuscle(user, MUSCLE_NAMES.traps_upper);

      expect(
        within(group("Role for Side delts")).getByRole("radio", {
          name: "Primary",
        }),
      ).toBeChecked();
      expect(
        within(group("Role for Upper traps")).getByRole("radio", {
          name: "Second",
        }),
      ).toBeChecked();
      expect(screen.getByText("Primary · counts 1 set")).toBeOnTheScreen();
      expect(screen.getByText("Secondary · counts half")).toBeOnTheScreen();
    });

    it("should change a muscle's role from its control and say what the role counts for", async () => {
      const user = await openForm(sessionProps());
      await addMuscle(user, MUSCLE_NAMES.delt_side);

      await chooseRole(user, "Side delts", "Assist");

      expect(screen.getByText("Assisting · counts a fifth")).toBeOnTheScreen();
      expect(screen.queryByText("Primary · counts 1 set")).toBeNull();
    });

    it("should not offer a muscle that is already in the exercise, and offer it again once removed", async () => {
      const user = await openForm(sessionProps());
      await addMuscle(user, MUSCLE_NAMES.delt_side);

      await user.press(screen.getByRole("button", { name: CUSTOM_EXERCISE.addMuscleAction }));
      await screen.findByRole("heading", { name: CUSTOM_EXERCISE.addMuscleAction });
      expect(screen.queryByRole("button", { name: MUSCLE_NAMES.delt_side })).toBeNull();
      await user.press(screen.getByRole("button", { name: CUSTOM_EXERCISE.muscleChooserBackName }));
      await user.press(screen.getByRole("button", { name: "Remove Side delts" }));
      await user.press(screen.getByRole("button", { name: CUSTOM_EXERCISE.addMuscleAction }));

      expect(await screen.findByRole("button", { name: MUSCLE_NAMES.delt_side })).toBeOnTheScreen();
    });

    it("should keep the draft when Back leaves the muscle list without a choice", async () => {
      const user = await openForm(sessionProps());
      await addMuscle(user, MUSCLE_NAMES.delt_side);
      await fireEvent.changeText(nameField(), BOARD_NAME);

      await user.press(screen.getByRole("button", { name: CUSTOM_EXERCISE.addMuscleAction }));
      await user.press(
        await screen.findByRole("button", { name: CUSTOM_EXERCISE.muscleChooserBackName }),
      );

      expect(nameField()).toHaveDisplayValue(BOARD_NAME);
      expect(group("Role for Side delts")).toBeOnTheScreen();
    });
  });

  describe("the Android Back button", () => {
    // The sheet registers its own listener when it opens, which closes the sheet. The form registers after it,
    // and the system asks the latest first, so the last listener is the one that answers.
    async function pressHardwareBack(
      addListener: jest.SpiedFunction<typeof BackHandler.addEventListener>,
    ) {
      const listener = addListener.mock.calls.at(-1)?.[1];
      if (typeof listener !== "function") {
        throw new Error("No Back listener is registered");
      }
      let handled: unknown;
      await act(() => {
        handled = listener({ type: "hardwareBackPress", timeStamp: 0 });
      });
      return handled;
    }

    it("should go back to the search from the form, with the sheet still open", async () => {
      const addListener = jest.spyOn(BackHandler, "addEventListener");
      const onClose = jest.fn();
      await openForm(sessionProps({ onClose }));

      const handled = await pressHardwareBack(addListener);

      expect(handled).toBe(true);
      expect(
        await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }),
      ).toBeOnTheScreen();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("should go back to the form from the muscle list, with the draft kept", async () => {
      const addListener = jest.spyOn(BackHandler, "addEventListener");
      const onClose = jest.fn();
      const user = await openForm(sessionProps({ onClose }));
      await addMuscle(user, MUSCLE_NAMES.delt_side);
      await user.press(screen.getByRole("button", { name: CUSTOM_EXERCISE.addMuscleAction }));
      await screen.findByRole("heading", { name: CUSTOM_EXERCISE.addMuscleAction });

      const handled = await pressHardwareBack(addListener);

      expect(handled).toBe(true);
      expect(await screen.findByRole("heading", { name: CUSTOM_EXERCISE.title })).toBeOnTheScreen();
      expect(group("Role for Side delts")).toBeOnTheScreen();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("the rules", () => {
    it("should keep Save off and announce nothing while the form is new", async () => {
      await openForm(sessionProps());

      expect(saveButton()).toBeDisabled();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByText("Pick the equipment it uses.")).toBeNull();
      expect(screen.queryByText("Add at least one muscle it works.")).toBeNull();
    });

    it("should say what is missing once the person has changed something, and keep Save off", async () => {
      const user = await openForm(sessionProps());

      await chooseEquipment(user, "Cable");

      expect(
        screen.getByRole("alert", { name: "Add at least one muscle it works." }),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("alert", { name: "Pick the equipment it uses." })).toBeNull();
      expect(saveButton()).toBeDisabled();
    });

    it("should say the equipment is missing once a muscle is added", async () => {
      const user = await openForm(sessionProps());

      await addMuscle(user, MUSCLE_NAMES.delt_side);

      expect(screen.getByRole("alert", { name: "Pick the equipment it uses." })).toBeOnTheScreen();
      expect(saveButton()).toBeDisabled();
    });

    it("should name a blank name and keep Save off", async () => {
      const user = await openForm(sessionProps());
      await fillBoardExample(user);

      await fireEvent.changeText(nameField(), "   ");

      expect(screen.getByText("Give the exercise a name.")).toBeOnTheScreen();
      expect(saveButton()).toBeDisabled();
    });

    it("should name a 201 character name, count it and keep Save off", async () => {
      const user = await openForm(sessionProps());
      await fillBoardExample(user);

      await fireEvent.changeText(nameField(), "a".repeat(201));

      expect(screen.getByText("201 / 200")).toBeOnTheScreen();
      expect(
        screen.getByText("Use 200 characters or fewer for the exercise name."),
      ).toBeOnTheScreen();
      expect(saveButton()).toBeDisabled();
    });

    it("should allow a 200 character name", async () => {
      const user = await openForm(sessionProps());
      await fillBoardExample(user);

      await fireEvent.changeText(nameField(), "a".repeat(200));

      expect(screen.getByText("200 / 200")).toBeOnTheScreen();
      expect(saveButton()).toBeEnabled();
    });

    it("should name a missing primary when every muscle is secondary and keep Save off", async () => {
      const user = await openForm(sessionProps());
      await fillBoardExample(user);

      await chooseRole(user, "Side delts", "Second");

      expect(
        screen.getByRole("alert", { name: "Mark at least one muscle as primary." }),
      ).toBeOnTheScreen();
      expect(saveButton()).toBeDisabled();
    });

    it("should name the missing muscle when the last one is removed", async () => {
      const user = await openForm(sessionProps());
      await fillBoardExample(user);

      await user.press(screen.getByRole("button", { name: "Remove Upper traps" }));
      await user.press(screen.getByRole("button", { name: "Remove Side delts" }));

      expect(
        screen.getByRole("alert", { name: "Add at least one muscle it works." }),
      ).toBeOnTheScreen();
      expect(saveButton()).toBeDisabled();
    });

    it("should turn Save on and show no rule once the board's example is filled in", async () => {
      const user = await openForm(sessionProps());

      await fillBoardExample(user);

      expect(saveButton()).toBeEnabled();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByText("21 / 200")).toBeOnTheScreen();
    });
  });

  describe("saving in a session", () => {
    it("should save the board's example with weights 1 and a half and add it to the session", async () => {
      const onAddToSession = jest.fn();
      const onClose = jest.fn();
      const user = await openForm(sessionProps({ onAddToSession, onClose }));
      await fillBoardExample(user);

      await user.press(saveButton());

      await waitFor(() => {
        expect(onAddToSession).toHaveBeenCalledTimes(1);
      });
      expect(customExerciseBackend.saves).toEqual([
        {
          p_exercise_id: null,
          p_exercise: { name: BOARD_NAME, equipment: "cable", mechanic: "isolation" },
          p_muscles: [
            { muscle_id: "delt_side", role: "primary", weight: 1 },
            { muscle_id: "traps_upper", role: "secondary", weight: 0.5 },
          ],
        },
      ]);
      expect(onAddToSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: SAVED_EXERCISE_ID,
          name: BOARD_NAME,
          equipment: "cable",
          primary_muscles: ["delt_side"],
          secondary_muscles: ["traps_upper"],
        }),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should list the saved exercise under Your exercises when the sheet is opened again", async () => {
      const user = await openForm(sessionProps());
      await fillBoardExample(user);
      await user.press(saveButton());
      await waitFor(() => {
        expect(customExerciseBackend.saves).toHaveLength(1);
      });
      await cleanup();

      await renderSheet(sessionProps());
      const search = userEvent.setup();
      await search.type(
        await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }),
        "lean-away",
      );

      expect(await screen.findByRole("heading", { name: "Your exercises · 1" })).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: `Add ${BOARD_NAME}, Cable, Custom` }),
      ).toBeOnTheScreen();
    });

    it("should say this session when the session follows no routine day", async () => {
      await openForm(sessionProps({ dayName: null }));

      expect(saveButton("Save and add to this session")).toBeOnTheScreen();
    });

    it("should save a primary with two assisting muscles as the compound the weights say", async () => {
      const user = await openForm(sessionProps());
      await fireEvent.changeText(nameField(), "Two primary");
      await chooseEquipment(user, "Barbell");
      await addMuscle(user, MUSCLE_NAMES.quads);
      await addMuscle(user, MUSCLE_NAMES.glute_max);
      await chooseRole(user, "Glutes", "Primary");

      await user.press(saveButton());

      await waitFor(() => {
        expect(customExerciseBackend.saves).toHaveLength(1);
      });
      expect(customExerciseBackend.saves[0]).toMatchObject({
        p_exercise: { mechanic: "compound" },
      });
    });

    it("should turn Save off while the save is on its way", async () => {
      let release: () => void = () => undefined;
      customExerciseBackend.hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      const onAddToSession = jest.fn();
      const user = await openForm(sessionProps({ onAddToSession }));
      await fillBoardExample(user);

      await user.press(saveButton());
      await waitFor(() => {
        expect(customExerciseBackend.saves).toHaveLength(1);
      });

      expect(saveButton()).toBeDisabled();
      await act(() => {
        release();
      });
      await waitFor(() => {
        expect(onAddToSession).toHaveBeenCalledTimes(1);
      });
    });

    it("should not add the exercise when the person goes back while it is saving", async () => {
      let release: () => void = () => undefined;
      customExerciseBackend.hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      const onAddToSession = jest.fn();
      const onClose = jest.fn();
      const user = await openForm(sessionProps({ onAddToSession, onClose }));
      await fillBoardExample(user);
      await user.press(saveButton());
      await waitFor(() => {
        expect(customExerciseBackend.saves).toHaveLength(1);
      });

      await user.press(screen.getByRole("button", { name: CUSTOM_EXERCISE.backName }));
      await act(() => {
        release();
      });

      expect(
        await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }),
      ).toBeOnTheScreen();
      expect(onAddToSession).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("should save once when Save is pressed twice in the same moment", async () => {
      const onAddToSession = jest.fn();
      const user = await openForm(sessionProps({ onAddToSession }));
      await fillBoardExample(user);

      await pressTwiceInTheSameMoment(saveButton());

      await waitFor(() => {
        expect(onAddToSession).toHaveBeenCalled();
      });
      expect(customExerciseBackend.saves).toHaveLength(1);
      expect(onAddToSession).toHaveBeenCalledTimes(1);
    });

    it("should not save a second time when Save is pressed again after the first one finished", async () => {
      const onAddToSession = jest.fn();
      const user = await openForm(sessionProps({ onAddToSession }));
      await fillBoardExample(user);
      const button = saveButton();

      await user.press(button);
      await waitFor(() => {
        expect(onAddToSession).toHaveBeenCalledTimes(1);
      });
      await pressTwiceInTheSameMoment(button);

      expect(customExerciseBackend.saves).toHaveLength(1);
    });
  });

  describe("saving in a routine", () => {
    const routineProps = (onChoose: jest.Mock, onClose: jest.Mock): AddExerciseSheetProps => ({
      mode: "routine",
      open: true,
      onChoose,
      onClose,
    });

    it("should say Save and add and hand the exercise back to the editor", async () => {
      const onChoose = jest.fn();
      const onClose = jest.fn();
      const user = await openForm(routineProps(onChoose, onClose));
      await fillBoardExample(user);

      await user.press(saveButton("Save and add"));

      await waitFor(() => {
        expect(onChoose).toHaveBeenCalledTimes(1);
      });
      expect(onChoose).toHaveBeenCalledWith(
        expect.objectContaining({ id: SAVED_EXERCISE_ID, name: BOARD_NAME }),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("a save that fails", () => {
    it("should keep the form, show the banner and let the person try again", async () => {
      customExerciseBackend.failing = true;
      const onAddToSession = jest.fn();
      const onClose = jest.fn();
      const user = await openForm(sessionProps({ onAddToSession, onClose }));
      await fillBoardExample(user);

      await user.press(saveButton());

      expect(await screen.findByText(CUSTOM_EXERCISE.saveFailed)).toBeOnTheScreen();
      expect(screen.queryByText("raw database text")).toBeNull();
      expect(nameField()).toHaveDisplayValue(BOARD_NAME);
      expect(screen.getByRole("radio", { name: "Cable" })).toBeChecked();
      expect(onAddToSession).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();

      customExerciseBackend.failing = false;
      await waitFor(() => {
        expect(saveButton()).toBeEnabled();
      });
      await user.press(saveButton());

      await waitFor(() => {
        expect(onAddToSession).toHaveBeenCalledTimes(1);
      });
    });

    it("should write nothing to the console", async () => {
      customExerciseBackend.failing = true;
      const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
        jest.spyOn(console, method).mockImplementation(() => undefined),
      );
      const user = await openForm(sessionProps());
      await fillBoardExample(user);

      await user.press(saveButton());
      await screen.findByText(CUSTOM_EXERCISE.saveFailed);

      expect(spies.flatMap((spy) => spy.mock.calls)).toStrictEqual([]);
    });
  });

  describe("offline", () => {
    it("should turn Save off with the offline line and send nothing", async () => {
      const user = await openForm(sessionProps());
      await fillBoardExample(user);

      await act(() => {
        onlineManager.setOnline(false);
      });
      await user.press(saveButton());

      expect(screen.getByText(CUSTOM_EXERCISE.saveOffline)).toBeOnTheScreen();
      expect(saveButton()).toBeDisabled();
      expect(customExerciseBackend.saves).toHaveLength(0);
    });

    it("should turn Save back on and drop the line when the connection returns", async () => {
      const user = await openForm(sessionProps());
      await fillBoardExample(user);
      await act(() => {
        onlineManager.setOnline(false);
      });

      await act(() => {
        onlineManager.setOnline(true);
      });

      expect(screen.queryByText(CUSTOM_EXERCISE.saveOffline)).toBeNull();
      expect(saveButton()).toBeEnabled();
    });
  });
});
