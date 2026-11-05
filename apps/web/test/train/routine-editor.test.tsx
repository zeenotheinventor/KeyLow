import {
  ADD_EXERCISE,
  CUSTOM_EXERCISE,
  ROUTINE_DAY_CONTROLS,
  ROUTINE_DISCARD,
  ROUTINE_EDITOR,
  ROUTINE_EDITOR_LOADING_LABEL,
  ROUTINE_SAVE_FAILED,
  describeExerciseFieldNames,
  describeProblemsBanner,
  describeRemoveDay,
  describeRoutineRule,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lateralRaiseResults } from "./addExerciseGolden";
import { goldenRoutine, renderWithTrain, resetTrainBackend, trainBackend } from "./support";

import { RoutineEditor } from "@/components/train/RoutineEditor";
import { RoutineEditorScreen } from "@/components/train/RoutineEditorScreen";
import { ToastProvider } from "@/components/ui/Toast";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const GOLDEN_ID = String(goldenRoutine["id"]);

const renderEditorScreen = (id = GOLDEN_ID) =>
  renderWithTrain(
    <ToastProvider>
      <RoutineEditorScreen id={id} />
    </ToastProvider>,
  );

const renderNewEditor = () =>
  renderWithTrain(
    <ToastProvider>
      <RoutineEditor />
    </ToastProvider>,
  );

const save = () => screen.getByRole("button", { name: ROUTINE_EDITOR.saveAction });

const dayCards = () =>
  screen.getAllByRole("region", { name: /, (Mon|Tue|Wed|Thu|Fri|Sat|Sun|Any)$/ });

/** A day's card by its name and weekday, which change with the day: "Legs, Thu". */
const dayCard = (name: string) => within(screen.getByRole("region", { name }));

async function replaceText(field: HTMLElement, text: string) {
  await userEvent.clear(field);
  if (text !== "") {
    await userEvent.type(field, text);
  }
}

async function openGoldenRoutine() {
  trainBackend.routine = goldenRoutine;
  renderEditorScreen();
  await screen.findByRole("textbox", { name: ROUTINE_EDITOR.nameLabel });
}

describe("the routine editor", () => {
  beforeEach(() => {
    resetTrainBackend();
    router.push.mockReset();
    router.replace.mockReset();
  });

  afterEach(() => {
    cleanup();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("opening a stored routine", () => {
    it("should show its name and a card for each day, with the weekday and the exercises", async () => {
      await openGoldenRoutine();

      expect(
        screen.getByRole<HTMLInputElement>("textbox", { name: ROUTINE_EDITOR.nameLabel }).value,
      ).toBe("Push Pull Legs");
      expect(dayCards().map((card) => card.getAttribute("aria-label"))).toEqual([
        "Push, Mon",
        "Pull, Tue",
        "Legs, Thu",
        "Push, Sat",
      ]);
      const legs = dayCard("Legs, Thu");
      expect(legs.getAllByRole("listitem")).toHaveLength(5);
      expect(
        legs.getByRole<HTMLInputElement>("textbox", {
          name: describeExerciseFieldNames("Leg Press").reps,
        }).value,
      ).toBe("10 to 12");
      expect(legs.getByRole("radio", { name: "Thu", checked: true })).toBeTruthy();
    });

    it("should save Push Pull Legs untouched with the same days and exercises", async () => {
      await openGoldenRoutine();

      await userEvent.click(save());

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith("/train/routines");
      });
      expect(router.push).not.toHaveBeenCalled();
      expect(trainBackend.savedRoutines).toHaveLength(1);
      const [body] = trainBackend.savedRoutines;
      expect(body?.["p_routine_id"]).toBe(GOLDEN_ID);
      expect(body?.["p_routine"]).toEqual({ name: "Push Pull Legs" });
      expect(body?.["p_days"]).toEqual([
        {
          id: "00000003-0000-4000-8000-000000000001",
          weekday: 0,
          name: "Push",
          exercises: [
            {
              exercise_id: "00000001-0000-4000-8000-000000000010",
              target_sets: 3,
              rep_min: 6,
              rep_max: 8,
              target_rir: 2,
            },
          ],
        },
        expect.objectContaining({ weekday: 1, name: "Pull" }),
        expect.objectContaining({
          weekday: 3,
          name: "Legs",
          exercises: [
            expect.objectContaining({ target_sets: 3, rep_min: 5, rep_max: 8, target_rir: 2 }),
            expect.objectContaining({ target_sets: 3, rep_min: 8, rep_max: 10, target_rir: 2 }),
            expect.objectContaining({ target_sets: 3, rep_min: 10, rep_max: 12, target_rir: 1 }),
            expect.objectContaining({ target_sets: 3, rep_min: 10, rep_max: 12, target_rir: 1 }),
            expect.objectContaining({ target_sets: 4, rep_min: 10, rep_max: 15, target_rir: 1 }),
          ],
        }),
        expect.objectContaining({ weekday: 5, name: "Push" }),
      ]);
    });
  });

  describe("a routine with problems", () => {
    // The `routines · invalid` board: no name, Legs on Tuesday beside Pull, and Leg press at 0 sets and 12 to 10 reps.
    async function breakTheRoutine() {
      await openGoldenRoutine();
      await replaceText(screen.getByRole("textbox", { name: ROUTINE_EDITOR.nameLabel }), "");
      await userEvent.click(dayCard("Legs, Thu").getByRole("radio", { name: "Tue" }));
      const legs = dayCard("Legs, Tue");
      await replaceText(
        legs.getByRole("textbox", { name: describeExerciseFieldNames("Leg Press").sets }),
        "0",
      );
      await replaceText(
        legs.getByRole("textbox", { name: describeExerciseFieldNames("Leg Press").reps }),
        "12 to 10",
      );
    }

    it("should count the three problems in the banner, mark each and save nothing", async () => {
      await breakTheRoutine();

      await userEvent.click(save());

      expect(await screen.findByText(describeProblemsBanner(3))).toBeTruthy();
      expect(screen.getByText(describeRoutineRule("routine_name_blank", null))).toBeTruthy();
      expect(screen.getByText(describeRoutineRule("weekday_repeated", 1))).toBeTruthy();
      expect(trainBackend.savedRoutines).toEqual([]);
    });

    it("should move focus to the first problem, the name", async () => {
      await breakTheRoutine();

      await userEvent.click(save());

      await waitFor(() => {
        expect(document.activeElement).toBe(
          screen.getByRole("textbox", { name: ROUTINE_EDITOR.nameLabel }),
        );
      });
    });

    it("should save once the three are fixed, the marks following the draft as it is fixed", async () => {
      await breakTheRoutine();
      await userEvent.click(save());
      await screen.findByText(describeProblemsBanner(3));

      await userEvent.type(screen.getByRole("textbox", { name: ROUTINE_EDITOR.nameLabel }), "PPL");
      expect(screen.getByText(describeProblemsBanner(2))).toBeTruthy();
      await userEvent.click(dayCard("Legs, Tue").getByRole("radio", { name: "Thu" }));
      const legs = dayCard("Legs, Thu");
      await replaceText(
        legs.getByRole("textbox", { name: describeExerciseFieldNames("Leg Press").sets }),
        "3",
      );
      await replaceText(
        legs.getByRole("textbox", { name: describeExerciseFieldNames("Leg Press").reps }),
        "10 to 12",
      );
      expect(screen.queryByText(/problems? marked below/)).toBeNull();
      await userEvent.click(save());

      await waitFor(() => {
        expect(trainBackend.savedRoutines).toHaveLength(1);
      });
      expect(trainBackend.savedRoutines[0]?.["p_routine"]).toEqual({ name: "PPL" });
    });
  });

  describe("a weekday clash alone", () => {
    it("should move focus to the clash message, which has no field to flag", async () => {
      await openGoldenRoutine();
      await userEvent.click(dayCard("Legs, Thu").getByRole("radio", { name: "Tue" }));

      await userEvent.click(save());

      const message = await screen.findByText(describeRoutineRule("weekday_repeated", 1));
      await waitFor(() => {
        expect(document.activeElement).toBe(message);
      });
    });
  });

  describe("the Save button while it works", () => {
    // A button that is loading is named by its loading label, and is disabled.
    const workingSave = () => screen.getByRole<HTMLButtonElement>("button", { name: "Loading" });

    it("should be disabled while the save is on its way", async () => {
      await openGoldenRoutine();
      trainBackend.saveRoutineGate = new Promise<void>(() => {});

      await userEvent.click(save());

      await waitFor(() => {
        expect(workingSave().disabled).toBe(true);
      });
    });

    it("should stay disabled after the save worked, until the route changes", async () => {
      await openGoldenRoutine();

      await userEvent.click(save());

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledTimes(1);
      });
      expect(workingSave().disabled).toBe(true);
    });
  });

  describe("pressing Save twice", () => {
    // Save is disabled while it works, and a disabled default button blocks Enter in a field too. A submit that
    // still reaches the form is defence only, so these tests send it straight to the form.
    const settle = () =>
      act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });
    const submit = () => {
      fireEvent.submit(screen.getByRole("textbox", { name: ROUTINE_EDITOR.nameLabel }));
    };

    it("should send one save while the first is on its way, though the draft changed meanwhile", async () => {
      await openGoldenRoutine();
      let openGate = () => {};
      trainBackend.saveRoutineGate = new Promise<void>((resolve) => {
        openGate = resolve;
      });

      submit();
      await waitFor(() => {
        expect(trainBackend.writes).toEqual(["save_routine"]);
      });
      // A different draft is a different save to the api-client, which would queue it after the first.
      await userEvent.type(screen.getByRole("textbox", { name: ROUTINE_EDITOR.nameLabel }), "!");
      submit();
      openGate();
      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledTimes(1);
      });
      await settle();

      expect(trainBackend.savedRoutines).toHaveLength(1);
    });

    it("should send nothing more once the first worked and the editor is leaving", async () => {
      await openGoldenRoutine();

      submit();
      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledTimes(1);
      });
      submit();
      await settle();

      expect(trainBackend.savedRoutines).toHaveLength(1);
    });
  });

  describe("changing the days", () => {
    it("should save a day moved to any weekday as a null weekday", async () => {
      await openGoldenRoutine();
      await userEvent.click(dayCard("Legs, Thu").getByRole("radio", { name: "Any" }));

      await userEvent.click(save());

      await waitFor(() => {
        expect(trainBackend.savedRoutines).toHaveLength(1);
      });
      const days = trainBackend.savedRoutines[0]?.["p_days"];
      expect(days).toEqual([
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ name: "Legs", weekday: null }),
        expect.anything(),
      ]);
    });

    it("should leave a removed day out of the save", async () => {
      await openGoldenRoutine();

      await userEvent.click(screen.getByRole("button", { name: describeRemoveDay("Pull") }));
      expect(screen.queryByRole("region", { name: "Pull, Tue" })).toBeNull();
      await userEvent.click(save());

      await waitFor(() => {
        expect(trainBackend.savedRoutines).toHaveLength(1);
      });
      const days = trainBackend.savedRoutines[0]?.["p_days"];
      expect(days).toEqual([
        expect.objectContaining({ name: "Push", weekday: 0 }),
        expect.objectContaining({ name: "Legs" }),
        expect.objectContaining({ name: "Push", weekday: 5 }),
      ]);
    });
  });

  describe("the browser's own prompt", () => {
    const closeTab = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    it("should ask when closing the tab with changes, and not with none", async () => {
      await openGoldenRoutine();
      expect(closeTab()).toBe(false);

      await userEvent.type(screen.getByRole("textbox", { name: ROUTINE_EDITOR.nameLabel }), "!");

      expect(closeTab()).toBe(true);
    });

    it("should not ask once the routine is saved", async () => {
      await openGoldenRoutine();
      await userEvent.type(screen.getByRole("textbox", { name: ROUTINE_EDITOR.nameLabel }), "!");
      expect(closeTab()).toBe(true);

      await userEvent.click(save());

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith("/train/routines");
      });
      expect(closeTab()).toBe(false);
    });
  });

  describe("a new routine", () => {
    it("should start with no name and no days, and create the routine from a day and an exercise", async () => {
      trainBackend.searchableExercises = lateralRaiseResults;
      trainBackend.routine = goldenRoutine;
      renderNewEditor();

      expect(screen.getByRole("heading", { name: ROUTINE_EDITOR.newTitle, level: 1 })).toBeTruthy();
      expect(screen.queryAllByRole("region", { name: /, Any$/ })).toEqual([]);
      await userEvent.type(screen.getByRole("textbox", { name: ROUTINE_EDITOR.nameLabel }), "Arms");
      await userEvent.click(
        screen.getByRole("button", { name: ROUTINE_DAY_CONTROLS.addDayAction }),
      );
      const day = within(screen.getByRole("region", { name: "Day 1, Any" }));
      await userEvent.click(day.getByRole("button", { name: /Add exercise/ }));
      await userEvent.type(
        await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }),
        "raise",
      );
      await userEvent.click(await screen.findByRole("button", { name: /^Add Side lateral raise/ }));
      expect(await day.findByText("Side lateral raise")).toBeTruthy();
      await userEvent.click(save());

      await waitFor(() => {
        expect(trainBackend.savedRoutines).toHaveLength(1);
      });
      const [body] = trainBackend.savedRoutines;
      expect(body?.["p_routine_id"]).toBeNull();
      expect(body?.["p_routine"]).toEqual({ name: "Arms" });
      expect(body?.["p_days"]).toEqual([
        {
          id: null,
          weekday: null,
          name: "Day 1",
          exercises: [
            {
              exercise_id: lateralRaiseResults[1]?.["id"],
              target_sets: 3,
              rep_min: 8,
              rep_max: 12,
              target_rir: 2,
            },
          ],
        },
      ]);
      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith("/train/routines");
      });
    }, 20000);
  });

  describe("creating an exercise from the search", () => {
    it("should word Save as Save and add, and put the saved exercise on the day it was opened for", async () => {
      trainBackend.searchableExercises = [];
      renderNewEditor();
      await userEvent.click(
        screen.getByRole("button", { name: ROUTINE_DAY_CONTROLS.addDayAction }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: ROUTINE_DAY_CONTROLS.addDayAction }),
      );
      const secondDay = within(screen.getByRole("region", { name: "Day 2, Any" }));
      await userEvent.click(secondDay.getByRole("button", { name: /Add exercise/ }));
      await userEvent.type(
        await screen.findByRole("searchbox", { name: ADD_EXERCISE.searchName }),
        "lean away",
      );
      await userEvent.click(await screen.findByRole("button", { name: 'Create "lean away"' }));
      const form = await screen.findByRole("dialog", { name: CUSTOM_EXERCISE.title });
      await userEvent.click(within(form).getByRole("radio", { name: "Cable" }));
      await userEvent.click(
        within(form).getByRole("button", { name: CUSTOM_EXERCISE.addMuscleAction }),
      );
      await userEvent.click(
        within(screen.getByRole("dialog", { name: CUSTOM_EXERCISE.addMuscleAction })).getByRole(
          "button",
          { name: "Side delts" },
        ),
      );

      await userEvent.click(within(form).getByRole("button", { name: "Save and add" }));

      expect(await secondDay.findByText("lean away")).toBeTruthy();
      expect(
        within(screen.getByRole("region", { name: "Day 1, Any" })).queryByText("lean away"),
      ).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(trainBackend.savedExercises).toHaveLength(1);
      // The dialog sits beside the form, so saving the exercise did not save the routine.
      expect(trainBackend.savedRoutines).toEqual([]);
    }, 30000);
  });

  describe("leaving", () => {
    it("should go straight back to the routines when nothing changed", async () => {
      await openGoldenRoutine();

      await userEvent.click(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelAction }));

      expect(router.replace).toHaveBeenCalledWith("/train/routines");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should ask before discarding changes, and keep the draft on Keep editing", async () => {
      await openGoldenRoutine();
      await userEvent.type(screen.getByRole("textbox", { name: ROUTINE_EDITOR.nameLabel }), "!");

      await userEvent.click(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelAction }));
      const dialog = await screen.findByRole("dialog", { name: ROUTINE_DISCARD.title });
      await userEvent.click(
        within(dialog).getByRole("button", { name: ROUTINE_DISCARD.keepEditingAction }),
      );

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(router.replace).not.toHaveBeenCalled();
      expect(
        screen.getByRole<HTMLInputElement>("textbox", { name: ROUTINE_EDITOR.nameLabel }).value,
      ).toBe("Push Pull Legs!");
    });

    it("should go back to the routines on Discard changes, saving nothing", async () => {
      await openGoldenRoutine();
      await userEvent.type(screen.getByRole("textbox", { name: ROUTINE_EDITOR.nameLabel }), "!");

      await userEvent.click(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelAction }));
      await userEvent.click(
        within(await screen.findByRole("dialog", { name: ROUTINE_DISCARD.title })).getByRole(
          "button",
          { name: ROUTINE_DISCARD.discardAction },
        ),
      );

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith("/train/routines");
      });
      expect(router.push).not.toHaveBeenCalled();
      expect(trainBackend.savedRoutines).toEqual([]);
    });
  });

  describe("when the save cannot be made", () => {
    it("should keep the draft and say so in a toast when the database refuses", async () => {
      await openGoldenRoutine();
      trainBackend.failingWrites = true;

      await userEvent.click(save());

      expect(await screen.findByText(ROUTINE_SAVE_FAILED)).toBeTruthy();
      expect(router.replace).not.toHaveBeenCalled();
      expect(screen.getByRole("heading", { name: ROUTINE_EDITOR.title })).toBeTruthy();
    });

    it("should say so in a toast at once, and send nothing, with no connection", async () => {
      await openGoldenRoutine();
      act(() => {
        onlineManager.setOnline(false);
      });

      await userEvent.click(save());

      expect(await screen.findByText(ROUTINE_SAVE_FAILED)).toBeTruthy();
      expect(trainBackend.writes).toEqual([]);
    });
  });

  describe("opening a routine that cannot be edited", () => {
    it("should go to the routines list when the address is not a routine's id", async () => {
      renderEditorScreen("not-an-id");

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith("/train/routines");
      });
    });

    it("should go to the routines list when the routine is not there", async () => {
      trainBackend.routine = null;
      renderEditorScreen();

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith("/train/routines");
      });
    });

    it("should say it could not be read, with no Try again, on a first visit with no connection", async () => {
      trainBackend.routine = goldenRoutine;
      act(() => {
        onlineManager.setOnline(false);
      });
      renderEditorScreen();

      expect(await screen.findByRole("alert")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
      expect(screen.queryByRole("status", { name: ROUTINE_EDITOR_LOADING_LABEL })).toBeNull();
    });
  });
});
