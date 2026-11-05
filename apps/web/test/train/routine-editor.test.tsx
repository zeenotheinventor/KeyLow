import {
  ADD_EXERCISE,
  CUSTOM_EXERCISE,
  ROUTINE_DAY_CONTROLS,
  ROUTINE_DISCARD,
  ROUTINE_EDITOR,
  ROUTINE_EDITOR_LOADING_LABEL,
  ROUTINE_SAVE_FAILED,
  describeExerciseFieldNames,
  describeMoveDay,
  describeMoveExercise,
  describeMovedPosition,
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

  describe("reordering the days and the exercises", () => {
    const legsExerciseIds = (position: number) =>
      `00000001-0000-4000-8000-${String(30 + position).padStart(12, "0")}`;

    /** The names of the cards, in the order they are drawn: "Push, Mon", "Pull, Tue". */
    const cardNames = () => dayCards().map((card) => card.getAttribute("aria-label"));

    const moveDay = (cardName: string, dayName: string, direction: "up" | "down") =>
      dayCard(cardName).getByRole("button", { name: describeMoveDay(dayName, direction) });
    const moveExercise = (exerciseName: string, direction: "up" | "down") =>
      dayCard("Legs, Thu").getByRole("button", {
        name: describeMoveExercise(exerciseName, direction),
      });

    // The toast region is a status too, so the announcement is the one inside the editor's form.
    const announcementRegion = () => {
      const region = screen.getAllByRole("status").find((candidate) => candidate.closest("form"));
      if (region === undefined) {
        throw new Error("The editor has no live region");
      }
      return region;
    };

    /** Presses a button the way the keyboard does, from its focus. */
    async function pressWithKeyboard(button: HTMLElement) {
      button.focus();
      await userEvent.keyboard("{Enter}");
    }

    it("should save Legs above Pull and Leg Press above Romanian Deadlift in that order", async () => {
      await openGoldenRoutine();

      await userEvent.click(moveDay("Legs, Thu", "Legs", "up"));
      await userEvent.click(moveExercise("Leg Press", "up"));
      await userEvent.click(save());

      await waitFor(() => {
        expect(trainBackend.savedRoutines).toHaveLength(1);
      });
      expect(trainBackend.savedRoutines[0]?.["p_days"]).toEqual([
        expect.objectContaining({ name: "Push", weekday: 0 }),
        expect.objectContaining({
          name: "Legs",
          exercises: [
            expect.objectContaining({ exercise_id: legsExerciseIds(0) }),
            expect.objectContaining({ exercise_id: legsExerciseIds(2) }),
            expect.objectContaining({ exercise_id: legsExerciseIds(1) }),
            expect.objectContaining({ exercise_id: legsExerciseIds(3) }),
            expect.objectContaining({ exercise_id: legsExerciseIds(4) }),
          ],
        }),
        expect.objectContaining({ name: "Pull", weekday: 1 }),
        expect.objectContaining({ name: "Push", weekday: 5 }),
      ]);
    });

    it("should dim the first day's Move up and the last day's Move down, and no other", async () => {
      await openGoldenRoutine();

      expect(moveDay("Push, Mon", "Push", "up").hasAttribute("disabled")).toBe(true);
      expect(moveDay("Push, Mon", "Push", "down").hasAttribute("disabled")).toBe(false);
      expect(moveDay("Legs, Thu", "Legs", "up").hasAttribute("disabled")).toBe(false);
      expect(moveDay("Legs, Thu", "Legs", "down").hasAttribute("disabled")).toBe(false);
      expect(moveDay("Push, Sat", "Push", "up").hasAttribute("disabled")).toBe(false);
      expect(moveDay("Push, Sat", "Push", "down").hasAttribute("disabled")).toBe(true);
    });

    it("should dim the first exercise's Move up and the last exercise's Move down, and no other", async () => {
      await openGoldenRoutine();

      expect(moveExercise("Barbell Squat", "up").hasAttribute("disabled")).toBe(true);
      expect(moveExercise("Barbell Squat", "down").hasAttribute("disabled")).toBe(false);
      expect(moveExercise("Leg Press", "up").hasAttribute("disabled")).toBe(false);
      expect(moveExercise("Standing Calf Raise", "up").hasAttribute("disabled")).toBe(false);
      expect(moveExercise("Standing Calf Raise", "down").hasAttribute("disabled")).toBe(true);
    });

    it("should keep the same card for a moved day, so what is typed in it stays", async () => {
      await openGoldenRoutine();
      const legsCard = screen.getByRole("region", { name: "Legs, Thu" });

      await userEvent.click(moveDay("Legs, Thu", "Legs", "up"));

      expect(cardNames()).toEqual(["Push, Mon", "Legs, Thu", "Pull, Tue", "Push, Sat"]);
      expect(screen.getByRole("region", { name: "Legs, Thu" })).toBe(legsCard);
    });

    it("should keep the same row for a moved exercise", async () => {
      await openGoldenRoutine();
      const legPressSets = dayCard("Legs, Thu").getByRole("textbox", {
        name: describeExerciseFieldNames("Leg Press").sets,
      });

      await userEvent.click(moveExercise("Leg Press", "up"));

      expect(
        dayCard("Legs, Thu").getByRole("textbox", {
          name: describeExerciseFieldNames("Leg Press").sets,
        }),
      ).toBe(legPressSets);
      const romanianSets = dayCard("Legs, Thu").getByRole("textbox", {
        name: describeExerciseFieldNames("Romanian Deadlift").sets,
      });
      expect(legPressSets.compareDocumentPosition(romanianSets)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    describe("focus", () => {
      it("should stay on the pressed day button while it can move on, so the next press moves again", async () => {
        await openGoldenRoutine();

        await pressWithKeyboard(moveDay("Legs, Thu", "Legs", "up"));

        expect(document.activeElement).toBe(moveDay("Legs, Thu", "Legs", "up"));
        await userEvent.keyboard("{Enter}");
        expect(cardNames()).toEqual(["Legs, Thu", "Push, Mon", "Pull, Tue", "Push, Sat"]);
      });

      it("should move to the day's Move down when Move up reaches the top and is dimmed", async () => {
        await openGoldenRoutine();
        await pressWithKeyboard(moveDay("Legs, Thu", "Legs", "up"));

        expect(cardNames()).toEqual(["Push, Mon", "Legs, Thu", "Pull, Tue", "Push, Sat"]);
        await userEvent.keyboard("{Enter}");

        expect(moveDay("Legs, Thu", "Legs", "up").hasAttribute("disabled")).toBe(true);
        expect(document.activeElement).toBe(moveDay("Legs, Thu", "Legs", "down"));
      });

      it("should move to the day's Move up when Move down reaches the bottom and is dimmed", async () => {
        await openGoldenRoutine();

        await pressWithKeyboard(moveDay("Pull, Tue", "Pull", "down"));
        await userEvent.keyboard("{Enter}");

        expect(moveDay("Pull, Tue", "Pull", "down").hasAttribute("disabled")).toBe(true);
        expect(document.activeElement).toBe(moveDay("Pull, Tue", "Pull", "up"));
      });

      it("should move to the exercise's Move down when Move up reaches the top and is dimmed", async () => {
        await openGoldenRoutine();

        await pressWithKeyboard(moveExercise("Leg Press", "up"));
        await userEvent.keyboard("{Enter}");

        expect(moveExercise("Leg Press", "up").hasAttribute("disabled")).toBe(true);
        expect(document.activeElement).toBe(moveExercise("Leg Press", "down"));
      });

      it("should move to the exercise's Move up when Move down reaches the bottom and is dimmed", async () => {
        await openGoldenRoutine();

        await pressWithKeyboard(moveExercise("Seated Leg Curl", "down"));

        expect(moveExercise("Seated Leg Curl", "down").hasAttribute("disabled")).toBe(true);
        expect(document.activeElement).toBe(moveExercise("Seated Leg Curl", "up"));
      });
    });

    describe("the announcement", () => {
      it("should say nothing before anything moves", async () => {
        await openGoldenRoutine();

        expect(announcementRegion().textContent).toBe("");
      });

      it("should say the new position of a moved day politely, and again after each move", async () => {
        await openGoldenRoutine();

        await userEvent.click(moveDay("Legs, Thu", "Legs", "up"));
        expect(announcementRegion().textContent).toBe(describeMovedPosition("Legs", 2, 4));
        await userEvent.click(moveDay("Legs, Thu", "Legs", "up"));

        expect(announcementRegion().textContent).toBe(describeMovedPosition("Legs", 1, 4));
        expect(announcementRegion().getAttribute("aria-live")).toBe("polite");
      });

      it("should say the new position of a moved exercise within its day", async () => {
        await openGoldenRoutine();

        await userEvent.click(moveExercise("Leg Press", "down"));

        expect(announcementRegion().textContent).toBe(describeMovedPosition("Leg Press", 4, 5));
      });

      it("should announce a move that says the same words as the one before", async () => {
        await openGoldenRoutine();
        await userEvent.click(screen.getByRole("button", { name: describeRemoveDay("Pull") }));
        await userEvent.click(screen.getByRole("button", { name: describeRemoveDay("Legs") }));
        // The two days are both named Push, so the second move says what the first did.
        await userEvent.click(moveDay("Push, Mon", "Push", "down"));
        const status = announcementRegion();
        const announcements: MutationRecord[] = [];
        const watcher = new MutationObserver((records) => {
          announcements.push(...records);
        });
        watcher.observe(status, { childList: true, characterData: true, subtree: true });

        await userEvent.click(moveDay("Push, Sat", "Push", "down"));
        await Promise.resolve();
        watcher.disconnect();

        expect(status.textContent).toBe(describeMovedPosition("Push", 2, 2));
        expect(announcements.length).toBeGreaterThan(0);
      });
    });

    describe("the marks", () => {
      async function markLegPressSets() {
        await openGoldenRoutine();
        await replaceText(
          dayCard("Legs, Thu").getByRole("textbox", {
            name: describeExerciseFieldNames("Leg Press").sets,
          }),
          "0",
        );
        await userEvent.click(save());
        await screen.findByText(describeProblemsBanner(1));
      }

      it("should stay on the moved exercise, with the count unchanged", async () => {
        await markLegPressSets();
        const setsOf = (name: string) =>
          dayCard("Legs, Thu").getByRole("textbox", {
            name: describeExerciseFieldNames(name).sets,
          });
        expect(setsOf("Leg Press").getAttribute("aria-invalid")).toBe("true");

        await userEvent.click(moveExercise("Leg Press", "up"));

        expect(setsOf("Leg Press").getAttribute("aria-invalid")).toBe("true");
        expect(setsOf("Romanian Deadlift").getAttribute("aria-invalid")).not.toBe("true");
        expect(screen.getByText(describeProblemsBanner(1))).toBeTruthy();
        expect(trainBackend.savedRoutines).toEqual([]);
      });

      it("should send the focus of Save to the moved exercise's field in its new place", async () => {
        await markLegPressSets();
        await userEvent.click(moveExercise("Leg Press", "up"));

        await userEvent.click(save());

        await waitFor(() => {
          expect(document.activeElement).toBe(
            dayCard("Legs, Thu").getByRole("textbox", {
              name: describeExerciseFieldNames("Leg Press").sets,
            }),
          );
        });
      });

      it("should stay with the day whose name is blank, with the count unchanged", async () => {
        await openGoldenRoutine();
        await replaceText(dayCard("Legs, Thu").getByRole("textbox", { name: /^Day name for/ }), "");
        await userEvent.click(save());
        await screen.findByText(describeProblemsBanner(1));
        const blank = within(screen.getByRole("region", { name: /^, Thu$/ }));
        expect(blank.getByText(describeRoutineRule("day_name_blank", null))).toBeTruthy();

        await userEvent.click(blank.getByRole("button", { name: describeMoveDay("", "up") }));

        expect(
          within(screen.getByRole("region", { name: /^, Thu$/ })).getByText(
            describeRoutineRule("day_name_blank", null),
          ),
        ).toBeTruthy();
        expect(screen.getByText(describeProblemsBanner(1))).toBeTruthy();
        expect(cardNames()).toEqual(["Push, Mon", ", Thu", "Pull, Tue", "Push, Sat"]);
      });

      it("should follow the draft for a weekday clash: the later day carries it after the move", async () => {
        await openGoldenRoutine();
        await userEvent.click(dayCard("Legs, Thu").getByRole("radio", { name: "Tue" }));
        await userEvent.click(save());
        await screen.findByText(describeProblemsBanner(1));
        const clash = describeRoutineRule("weekday_repeated", 1);
        expect(
          within(screen.getByRole("region", { name: "Legs, Tue" })).getByText(clash),
        ).toBeTruthy();

        await userEvent.click(moveDay("Legs, Tue", "Legs", "up"));

        expect(
          within(screen.getByRole("region", { name: "Pull, Tue" })).getByText(clash),
        ).toBeTruthy();
        expect(screen.getAllByText(clash)).toHaveLength(1);
        expect(screen.getByText(describeProblemsBanner(1))).toBeTruthy();
      });
    });

    describe("leaving after a move", () => {
      it("should ask before discarding a move", async () => {
        await openGoldenRoutine();
        await userEvent.click(moveDay("Legs, Thu", "Legs", "up"));

        await userEvent.click(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelAction }));

        expect(await screen.findByRole("dialog", { name: ROUTINE_DISCARD.title })).toBeTruthy();
        expect(router.replace).not.toHaveBeenCalled();
      });

      it("should not ask once the move is moved back, as the draft is as it was", async () => {
        await openGoldenRoutine();
        await userEvent.click(moveDay("Legs, Thu", "Legs", "up"));
        await userEvent.click(moveDay("Legs, Thu", "Legs", "down"));

        await userEvent.click(screen.getByRole("button", { name: ROUTINE_EDITOR.cancelAction }));

        expect(router.replace).toHaveBeenCalledWith("/train/routines");
        expect(screen.queryByRole("dialog")).toBeNull();
      });

      it("should ask before closing the tab after a move", async () => {
        await openGoldenRoutine();
        await userEvent.click(moveExercise("Leg Press", "up"));

        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
      });
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
