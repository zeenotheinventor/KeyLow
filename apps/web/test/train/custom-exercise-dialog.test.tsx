import {
  ADD_EXERCISE,
  CUSTOM_EXERCISE,
  CUSTOM_EXERCISE_ROLES,
  SESSION_ACTIVE,
  describeCreateExerciseRow,
  describeCustomExerciseIssue,
  describeExerciseNameLength,
  describeSaveCustomExerciseAction,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lateralRaiseResults } from "./addExerciseGolden";
import { goldenLegsOpen, legsRoutine, previousThursday } from "./sessionGolden";
import { renderWithTrain, resetTrainBackend, trainBackend } from "./support";

import { SessionScreen } from "@/components/train";
import { CustomExerciseDialog } from "@/components/train/CustomExerciseDialog";
import { ToastProvider } from "@/components/ui/Toast";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const THURSDAY_1900 = new Date("2026-10-15T18:00:00Z");

const SAVE_FOR_LEGS = describeSaveCustomExerciseAction({ kind: "session", dayName: "Legs" });
const SAVE_FOR_NO_DAY = describeSaveCustomExerciseAction({ kind: "session", dayName: null });
const createRowName = describeCreateExerciseRow("lateral raise").title;

const card = (name: string) => screen.findByRole("region", { name });

const pickerDialog = () => screen.getByRole("dialog", { name: ADD_EXERCISE.title });
const formDialog = () => screen.getByRole("dialog", { name: CUSTOM_EXERCISE.title });
const muscleDialog = () => screen.getByRole("dialog", { name: CUSTOM_EXERCISE.addMuscleAction });

const nameField = () =>
  within(formDialog()).getByRole<HTMLInputElement>("textbox", { name: "Name" });
const saveButton = (label = SAVE_FOR_LEGS) =>
  within(formDialog()).getByRole<HTMLButtonElement>("button", { name: label });
const addMuscleButton = () =>
  within(formDialog()).getByRole("button", { name: CUSTOM_EXERCISE.addMuscleAction });
const alertsOfForm = () => within(formDialog()).queryAllByRole("alert");
const sentence = (rule: Parameters<typeof describeCustomExerciseIssue>[0]["rule"]) =>
  describeCustomExerciseIssue({ rule, field: "name" });

const openPicker = async () => {
  renderWithTrain(
    <ToastProvider>
      <SessionScreen />
    </ToastProvider>,
  );
  await card("Barbell squat");
  await userEvent.click(screen.getByRole("button", { name: SESSION_ACTIVE.addExerciseAction }));
  await userEvent.type(
    within(pickerDialog()).getByRole("searchbox", { name: ADD_EXERCISE.searchName }),
    "lateral raise",
  );
};

const openForm = async () => {
  await openPicker();
  await userEvent.click(await screen.findByRole("button", { name: createRowName }));
};

const chooseMuscle = async (name: string) => {
  await userEvent.click(addMuscleButton());
  await userEvent.click(within(muscleDialog()).getByRole("button", { name }));
};

/** The board's example: Lean-away cable raise, Cable, Side delts as primary and Upper traps as second. */
const fillBoardExample = async () => {
  await userEvent.clear(nameField());
  await userEvent.type(nameField(), "Lean-away cable raise");
  await userEvent.click(within(formDialog()).getByRole("radio", { name: "Cable" }));
  await chooseMuscle("Side delts");
  await chooseMuscle("Upper traps");
};

describe("the New exercise dialog on the session page", () => {
  beforeEach(() => {
    resetTrainBackend();
    router.push.mockReset();
    router.replace.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(THURSDAY_1900);
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = goldenLegsOpen();
    trainBackend.lastPerformance = previousThursday;
    // The library only, so the exercise made here is the one of Your exercises.
    trainBackend.searchableExercises = lateralRaiseResults.filter(
      (exercise) => exercise["source"] !== "user",
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("opening from the Create row", () => {
    it("should start with the searched words as the name, counted, and focus in the name field", async () => {
      await openForm();

      expect(nameField().value).toBe("lateral raise");
      expect(
        within(formDialog()).getByText(describeExerciseNameLength("lateral raise")),
      ).toBeTruthy();
      expect(document.activeElement).toBe(nameField());
      const countId = nameField().getAttribute("aria-describedby") ?? "";
      expect(document.getElementById(countId)?.textContent).toBe("13 / 200");
    });

    it("should offer all ten equipment values as one choice, none chosen", async () => {
      await openForm();

      const group = within(formDialog()).getByRole("radiogroup", {
        name: CUSTOM_EXERCISE.equipmentLabel,
      });
      const radios = within(group).getAllByRole("radio");
      expect(radios).toHaveLength(10);
      expect(radios.some((radio) => radio.getAttribute("aria-checked") === "true")).toBe(false);
    });

    it("should keep Save off and announce nothing until something has changed", async () => {
      await openForm();

      expect(saveButton().disabled).toBe(true);
      expect(alertsOfForm()).toHaveLength(0);
    });

    it("should name the day in Save, and this session for a session that follows no day", async () => {
      trainBackend.activeSession = goldenLegsOpen(null);
      await openForm();

      expect(saveButton(SAVE_FOR_NO_DAY)).toBeTruthy();
    });
  });

  describe("the rules", () => {
    it("should announce the missing equipment and the missing muscle once something has changed, and keep Save off", async () => {
      await openForm();

      await userEvent.type(nameField(), "s");

      const alerts = alertsOfForm().map((alert) => alert.textContent);
      expect(alerts).toContain(sentence("equipment_invalid"));
      expect(alerts).toContain(sentence("muscles_none"));
      expect(saveButton().disabled).toBe(true);
    });

    it("should announce a blank name at once and keep Save off", async () => {
      await openForm();
      await fillBoardExample();
      expect(saveButton().disabled).toBe(false);

      await userEvent.clear(nameField());

      expect(within(formDialog()).getByRole("alert").textContent).toBe(sentence("name_blank"));
      expect(nameField().getAttribute("aria-invalid")).toBe("true");
      expect(saveButton().disabled).toBe(true);
    });

    it("should announce a name of 201 characters and keep Save off", async () => {
      await openForm();
      await fillBoardExample();

      await userEvent.clear(nameField());
      await userEvent.click(nameField());
      await userEvent.paste("a".repeat(201));

      expect(within(formDialog()).getByRole("alert").textContent).toBe(sentence("name_too_long"));
      expect(saveButton().disabled).toBe(true);
    });

    it("should announce an exercise with no primary muscle and keep Save off", async () => {
      await openForm();
      await fillBoardExample();

      const role = within(formDialog()).getByRole("radiogroup", { name: "Role for Side delts" });
      await userEvent.click(
        within(role).getByRole("radio", { name: CUSTOM_EXERCISE_ROLES.secondary.label }),
      );

      expect(within(formDialog()).getByRole("alert").textContent).toBe(sentence("primary_missing"));
      expect(saveButton().disabled).toBe(true);
    });

    it("should not offer a muscle the exercise already has, so none can be added twice", async () => {
      await openForm();
      await chooseMuscle("Side delts");

      await userEvent.click(addMuscleButton());

      expect(within(muscleDialog()).queryByRole("button", { name: "Side delts" })).toBeNull();
      expect(within(muscleDialog()).getByRole("button", { name: "Upper traps" })).toBeTruthy();
    });
  });

  describe("the muscles", () => {
    it("should change only the role of the muscle pressed", async () => {
      await openForm();
      await chooseMuscle("Side delts");
      await chooseMuscle("Upper traps");

      const trapsRole = within(formDialog()).getByRole("radiogroup", {
        name: "Role for Upper traps",
      });
      await userEvent.click(
        within(trapsRole).getByRole("radio", { name: CUSTOM_EXERCISE_ROLES.stabiliser.label }),
      );

      const checkedRole = (muscle: string) =>
        within(within(formDialog()).getByRole("radiogroup", { name: `Role for ${muscle}` }))
          .getAllByRole<HTMLInputElement>("radio")
          .filter((radio) => radio.checked)
          .map((radio) => radio.value);
      expect(checkedRole("Upper traps")).toEqual(["stabiliser"]);
      expect(checkedRole("Side delts")).toEqual(["primary"]);
    });

    it("should remove the muscle pressed, offer it again and apply the primary rule to what is left", async () => {
      await openForm();
      await userEvent.click(within(formDialog()).getByRole("radio", { name: "Cable" }));
      await chooseMuscle("Side delts");
      await chooseMuscle("Upper traps");

      await userEvent.click(
        within(formDialog()).getByRole("button", { name: "Remove Side delts" }),
      );

      expect(
        within(formDialog()).queryByRole("radiogroup", { name: "Role for Side delts" }),
      ).toBeNull();
      expect(
        within(formDialog()).getByRole("radiogroup", { name: "Role for Upper traps" }),
      ).toBeTruthy();
      expect(within(formDialog()).getByRole("alert").textContent).toBe(sentence("primary_missing"));
      await userEvent.click(addMuscleButton());
      expect(within(muscleDialog()).getByRole("button", { name: "Side delts" })).toBeTruthy();
      expect(within(muscleDialog()).queryByRole("button", { name: "Upper traps" })).toBeNull();
    });
  });

  describe("saving", () => {
    it("should save the board example with weights 1 and a half, and put its card on the session", async () => {
      await openForm();
      await fillBoardExample();

      await userEvent.click(saveButton());

      const added = await card("Lean-away cable raise");
      expect(within(added).getByRole("button", { name: "Log set 1" })).toBeTruthy();
      expect(trainBackend.savedExercises).toEqual([
        {
          p_exercise_id: null,
          p_exercise: { name: "Lean-away cable raise", equipment: "cable", mechanic: "isolation" },
          p_muscles: [
            { muscle_id: "delt_side", role: "primary", weight: 1 },
            { muscle_id: "traps_upper", role: "secondary", weight: 0.5 },
          ],
        },
      ]);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should list the saved exercise under Your exercises the next time it is searched", async () => {
      await openForm();
      await fillBoardExample();
      await userEvent.click(saveButton());
      await card("Lean-away cable raise");

      await userEvent.click(screen.getByRole("button", { name: SESSION_ACTIVE.addExerciseAction }));
      await userEvent.type(
        within(pickerDialog()).getByRole("searchbox", { name: ADD_EXERCISE.searchName }),
        "lean-away",
      );

      const yours = await screen.findByRole("region", { name: "Your exercises · 1" });
      expect(within(yours).getByRole("button", { name: "Add Lean-away cable raise" })).toBeTruthy();
    });

    it("should keep the form with a banner when the save fails, and save on the next press", async () => {
      await openForm();
      await fillBoardExample();
      trainBackend.failingExerciseSave = true;

      await userEvent.click(saveButton());

      expect((await within(formDialog()).findByRole("alert")).textContent).toContain(
        CUSTOM_EXERCISE.saveFailed,
      );
      const banner = within(formDialog()).getByRole("alert");
      expect(document.activeElement?.contains(banner)).toBe(true);
      expect(document.activeElement).not.toBe(formDialog());
      expect(nameField().value).toBe("Lean-away cable raise");
      expect(saveButton().disabled).toBe(false);
      expect(screen.queryByRole("region", { name: "Lean-away cable raise" })).toBeNull();

      trainBackend.failingExerciseSave = false;
      await userEvent.click(saveButton());

      expect(await card("Lean-away cable raise")).toBeTruthy();
    });

    it("should turn Save off and say so while offline", async () => {
      await openForm();
      await fillBoardExample();

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(within(formDialog()).getByRole("status").textContent).toContain(
        CUSTOM_EXERCISE.saveOffline,
      );
      expect(saveButton().disabled).toBe(true);
      expect(trainBackend.exerciseSaveCalls).toBe(0);
    });

    it("should show Save busy and off while the save is on its way", async () => {
      await openForm();
      await fillBoardExample();
      let open: () => void = () => undefined;
      trainBackend.exerciseSaveGate = new Promise<void>((resolve) => {
        open = resolve;
      });

      await userEvent.click(saveButton());
      await userEvent.click(saveButton());

      expect(saveButton().disabled).toBe(true);
      expect(saveButton().getAttribute("aria-busy")).toBe("true");
      open();
      await card("Lean-away cable raise");
      expect(trainBackend.exerciseSaveCalls).toBe(1);
    });

    it("should not add the exercise when the person steps back while it is saving", async () => {
      await openForm();
      await fillBoardExample();
      let open: () => void = () => undefined;
      trainBackend.exerciseSaveGate = new Promise<void>((resolve) => {
        open = resolve;
      });
      await userEvent.click(saveButton());

      await userEvent.keyboard("{Escape}");
      open();

      await waitFor(() => {
        expect(trainBackend.savedExercises).toHaveLength(1);
      });
      expect(screen.queryByRole("region", { name: "Lean-away cable raise" })).toBeNull();
      expect(pickerDialog()).toBeTruthy();
    });
  });

  describe("Escape and Close, one level at a time", () => {
    it("should step back from the muscle list to the form with the draft, then to the search with its words, then close", async () => {
      await openPicker();
      const create = await screen.findByRole("button", { name: createRowName });
      await userEvent.click(create);
      await userEvent.type(nameField(), " cable");
      await userEvent.click(addMuscleButton());
      expect(muscleDialog()).toBeTruthy();

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("dialog", { name: CUSTOM_EXERCISE.addMuscleAction })).toBeNull();
      expect(nameField().value).toBe("lateral raise cable");
      expect(document.activeElement).toBe(addMuscleButton());

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("dialog", { name: CUSTOM_EXERCISE.title })).toBeNull();
      expect(
        within(pickerDialog()).getByRole<HTMLInputElement>("searchbox", {
          name: ADD_EXERCISE.searchName,
        }).value,
      ).toBe("lateral raise");
      expect(document.activeElement).toBe(screen.getByRole("button", { name: createRowName }));

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: SESSION_ACTIVE.addExerciseAction }),
      );
    });

    it("should keep the muscles already chosen when the muscle list is left without a choice", async () => {
      await openForm();
      await chooseMuscle("Side delts");
      await userEvent.click(addMuscleButton());

      await userEvent.click(
        within(muscleDialog()).getByRole("button", { name: ADD_EXERCISE.closeName }),
      );

      expect(
        within(formDialog()).getByRole("radiogroup", { name: "Role for Side delts" }),
      ).toBeTruthy();
      expect(document.activeElement).toBe(addMuscleButton());
    });

    it("should step back to the search from the Close button of the form, not close the picker", async () => {
      await openForm();

      await userEvent.click(
        within(formDialog()).getByRole("button", { name: ADD_EXERCISE.closeName }),
      );

      expect(screen.queryByRole("dialog", { name: CUSTOM_EXERCISE.title })).toBeNull();
      expect(pickerDialog()).toBeTruthy();
    });

    it("should return focus to Add a muscle once a muscle is chosen", async () => {
      await openForm();

      await chooseMuscle("Side delts");

      expect(document.activeElement).toBe(addMuscleButton());
    });
  });
});

describe("the New exercise dialog for a routine", () => {
  beforeEach(() => {
    resetTrainBackend();
  });

  afterEach(() => {
    cleanup();
  });

  it("should word Save for a routine and hand the saved exercise back", async () => {
    const onSaved = vi.fn();
    renderWithTrain(
      <CustomExerciseDialog
        destination={{ kind: "routine" }}
        initialName="Lean-away cable raise"
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: CUSTOM_EXERCISE.title });
    await userEvent.click(within(dialog).getByRole("radio", { name: "Cable" }));
    await userEvent.click(
      within(dialog).getByRole("button", { name: CUSTOM_EXERCISE.addMuscleAction }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog", { name: CUSTOM_EXERCISE.addMuscleAction })).getByRole(
        "button",
        {
          name: "Side delts",
        },
      ),
    );

    await userEvent.click(within(dialog).getByRole("button", { name: "Save and add" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Lean-away cable raise",
        equipment: "cable",
        primary_muscles: ["delt_side"],
        secondary_muscles: [],
      }),
    );
  });
});
