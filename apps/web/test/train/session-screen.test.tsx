import {
  ADD_EXERCISE,
  SESSION_ACTIVE,
  SESSION_DISCARD,
  SET_ENTRY,
  TRAIN_DISCARD_FAILED,
  describeDiscardBody,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lateralRaiseResults } from "./addExerciseGolden";
import {
  exerciseIdOf,
  freshLegsOpen,
  goldenLegsOpen,
  legsRoutine,
  previousThursday,
} from "./sessionGolden";
import { renderWithTrain, resetTrainBackend, trainBackend } from "./support";

import { SessionScreen } from "@/components/train";
import { ToastProvider } from "@/components/ui/Toast";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const THURSDAY_1900 = new Date("2026-10-15T18:00:00Z");

const renderSession = () =>
  renderWithTrain(
    <ToastProvider>
      <SessionScreen />
    </ToastProvider>,
  );

const card = (name: string) => screen.findByRole("region", { name });

const openGoldenLegs = () => {
  trainBackend.routine = legsRoutine;
  trainBackend.activeSession = goldenLegsOpen();
  trainBackend.lastPerformance = previousThursday;
};

describe("the session page", () => {
  beforeEach(() => {
    resetTrainBackend();
    router.push.mockReset();
    router.replace.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(THURSDAY_1900);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("the golden Thursday Legs at 19:00", () => {
    beforeEach(openGoldenLegs);

    it("should head the page with the day, the clock and the sets logged", async () => {
      renderSession();

      expect(await screen.findByRole("heading", { level: 1, name: "Legs" })).toBeTruthy();
      expect(screen.getByText("30:00 · 8 of 16 sets")).toBeTruthy();
    });

    it("should draw a card for each exercise of the day with what the plan asks of it", async () => {
      renderSession();

      const squat = await card("Barbell squat");
      expect(within(squat).getByText("3 × 5 to 8 · RIR 2 · Barbell")).toBeTruthy();
      expect(
        (await screen.findAllByRole("heading", { level: 2 })).map((heading) => heading.textContent),
      ).toEqual([
        "Barbell squat",
        "Romanian deadlift",
        "Leg press",
        "Seated leg curl",
        "Standing calf raise",
      ]);
    });

    it("should draw the squat's two warm-ups and three working sets as logged rows", async () => {
      renderSession();

      const squat = await card("Barbell squat");
      const names = within(squat)
        .getAllByRole("button", { name: /undo$/ })
        .map((button) => button.getAttribute("aria-label"));
      expect(names).toEqual([
        "Warm-up set logged, 60 kilograms, 8 reps, undo",
        "Warm-up set logged, 80 kilograms, 5 reps, undo",
        "Set 1 logged, 100 kilograms, 8 reps, RIR 2, undo",
        "Set 2 logged, 100 kilograms, 7 reps, RIR 2, undo",
        "Set 3 logged, 100 kilograms, 6 reps, RIR 2, undo",
      ]);
    });

    it("should show last time's sets under Previous", async () => {
      renderSession();

      const legPress = await card("Leg press");
      await waitFor(() => {
        expect(within(legPress).getByRole("row", { name: /^3 170 × 10/ })).toBeTruthy();
      });
      expect(within(legPress).getByRole("row", { name: /^1 170 × 12/ })).toBeTruthy();
    });

    it("should open the next set's fields with the numbers of the last one", async () => {
      renderSession();

      const legPress = await card("Leg press");
      expect(
        within(legPress).getByRole<HTMLInputElement>("textbox", {
          name: "Leg press, set 3, kilograms",
        }).value,
      ).toBe("180");
      expect(
        within(legPress).getByRole<HTMLInputElement>("textbox", { name: "Leg press, set 3, reps" })
          .value,
      ).toBe("11");
      expect(
        within(legPress).getByRole("button", { name: "Log set 3, 180 kilograms, 11 reps" }),
      ).toBeTruthy();
    });

    it("should log the next set from its check and count it at once", async () => {
      renderSession();

      const legPress = await card("Leg press");
      await userEvent.click(
        within(legPress).getByRole("button", { name: "Log set 3, 180 kilograms, 11 reps" }),
      );

      expect(
        await within(legPress).findByRole("button", {
          name: "Set 3 logged, 180 kilograms, 11 reps, RIR 1, undo",
        }),
      ).toBeTruthy();
      expect(screen.getByText("30:00 · 9 of 16 sets")).toBeTruthy();
      await waitFor(() => {
        expect(trainBackend.insertedSets).toHaveLength(1);
      });
      expect(trainBackend.insertedSets[0]).toMatchObject({
        exercise_id: exerciseIdOf("legPress"),
        set_type: "working",
        load_kg: 180,
        reps: 11,
        rir: 1,
      });
    });

    it("should log what is typed in the fields, then the check", async () => {
      renderSession();

      const legPress = await card("Leg press");
      const reps = within(legPress).getByRole("textbox", { name: "Leg press, set 3, reps" });
      await userEvent.clear(reps);
      await userEvent.type(reps, "9");
      const effort = within(legPress).getByRole("textbox", { name: "Leg press, set 3, RIR" });
      await userEvent.clear(effort);
      await userEvent.type(effort, "2");
      await userEvent.click(
        within(legPress).getByRole("button", { name: "Log set 3, 180 kilograms, 9 reps" }),
      );

      await waitFor(() => {
        expect(trainBackend.insertedSets).toHaveLength(1);
      });
      expect(trainBackend.insertedSets[0]).toMatchObject({ load_kg: 180, reps: 9, rir: 2 });
    });

    it("should add a set that can be edited before it is logged", async () => {
      renderSession();

      const legPress = await card("Leg press");
      await userEvent.click(
        within(legPress).getByRole("button", { name: SESSION_ACTIVE.addSetAction }),
      );
      const added = within(legPress).getByRole<HTMLInputElement>("textbox", {
        name: "Leg press, set 4, reps",
      });
      expect(added.value).toBe("11");
      await userEvent.clear(added);
      await userEvent.type(added, "8");
      await userEvent.click(
        within(legPress).getByRole("button", { name: "Log set 4, 180 kilograms, 8 reps" }),
      );

      await waitFor(() => {
        expect(trainBackend.insertedSets).toHaveLength(1);
      });
      expect(trainBackend.insertedSets[0]).toMatchObject({ load_kg: 180, reps: 8 });
    });

    it("should remove a logged set and offer Undo, which brings it back", async () => {
      renderSession();

      const legPress = await card("Leg press");
      await userEvent.click(
        within(legPress).getByRole("button", {
          name: "Set 2 logged, 180 kilograms, 11 reps, RIR 1, undo",
        }),
      );

      expect(await screen.findByText("Set removed: Leg press, set 2")).toBeTruthy();
      await waitFor(() => {
        expect(screen.getByText("30:00 · 7 of 16 sets")).toBeTruthy();
      });
      await userEvent.click(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(trainBackend.writes).toEqual(["remove_set", "restore_set"]);
      });
      expect(await screen.findByText("30:00 · 8 of 16 sets")).toBeTruthy();
    });

    it("should keep what was typed and say the set did not save when the write fails", async () => {
      trainBackend.failingWrites = true;
      renderSession();

      const legPress = await card("Leg press");
      const reps = within(legPress).getByRole("textbox", { name: "Leg press, set 3, reps" });
      await userEvent.clear(reps);
      await userEvent.type(reps, "9");
      await userEvent.click(
        within(legPress).getByRole("button", { name: "Log set 3, 180 kilograms, 9 reps" }),
      );

      expect(await screen.findByText(SET_ENTRY.saveFailed)).toBeTruthy();
      expect(
        within(legPress).getByRole<HTMLInputElement>("textbox", { name: "Leg press, set 3, reps" })
          .value,
      ).toBe("9");
      expect(screen.getByText("30:00 · 8 of 16 sets")).toBeTruthy();
    });

    it("should write nothing and say so when there is no connection", async () => {
      renderSession();
      const legPress = await card("Leg press");
      act(() => {
        onlineManager.setOnline(false);
      });

      await userEvent.click(
        within(legPress).getByRole("button", { name: "Log set 3, 180 kilograms, 11 reps" }),
      );

      expect(await screen.findByText(SET_ENTRY.saveFailed)).toBeTruthy();
      expect(trainBackend.writes).toEqual([]);
    });

    it("should refuse a load of 1800 kg under the row and log nothing", async () => {
      renderSession();

      const legPress = await card("Leg press");
      const load = within(legPress).getByRole("textbox", { name: "Leg press, set 3, kilograms" });
      await userEvent.clear(load);
      await userEvent.type(load, "1800");
      await userEvent.click(within(legPress).getByRole("button", { name: /^Log set 3/ }));

      expect((await within(legPress).findByRole("alert")).textContent).toBe(
        "Enter a load from 0 to 1,000 kg.",
      );
      expect(load.getAttribute("aria-invalid")).toBe("true");
      expect(trainBackend.writes).toEqual([]);
    });

    it("should take the sentence away once the load is changed", async () => {
      renderSession();
      const legPress = await card("Leg press");
      const load = within(legPress).getByRole("textbox", { name: "Leg press, set 3, kilograms" });
      await userEvent.clear(load);
      await userEvent.type(load, "1800");
      await userEvent.click(within(legPress).getByRole("button", { name: /^Log set 3/ }));
      await within(legPress).findByRole("alert");

      await userEvent.clear(load);
      await userEvent.type(load, "180");

      expect(within(legPress).queryByRole("alert")).toBeNull();
    });

    it("should move focus to Add set after a keyboard log leaves no set to log in the card", async () => {
      renderSession();
      const legPress = await card("Leg press");
      within(legPress).getByRole("button", { name: "Log set 3, 180 kilograms, 11 reps" }).focus();

      await userEvent.keyboard(" ");

      await waitFor(() => {
        expect(trainBackend.writes).toEqual(["add_set"]);
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(
          within(legPress).getByRole("button", { name: SESSION_ACTIVE.addSetAction }),
        );
      });
    });

    it("should leave focus alone when a set is logged with the pointer", async () => {
      renderSession();
      const legPress = await card("Leg press");

      await userEvent.click(
        within(legPress).getByRole("button", { name: "Log set 3, 180 kilograms, 11 reps" }),
      );

      await waitFor(() => {
        expect(trainBackend.writes).toEqual(["add_set"]);
      });
      expect(document.activeElement).not.toBe(
        within(legPress).getByRole("button", { name: SESSION_ACTIVE.addSetAction }),
      );
      expect(within(legPress).queryAllByRole("textbox")).not.toContain(document.activeElement);
    });

    it("should not pull focus into the card when a set comes back after a keyboard log that wrote nothing", async () => {
      renderSession();
      const legPress = await card("Leg press");
      within(legPress).getByRole("button", { name: "Log set 3, 180 kilograms, 11 reps" }).focus();
      act(() => {
        onlineManager.setOnline(false);
      });
      await userEvent.keyboard(" ");
      expect(await screen.findByText(SET_ENTRY.saveFailed)).toBeTruthy();
      expect(trainBackend.writes).toEqual([]);
      act(() => {
        onlineManager.setOnline(true);
      });
      screen.getByRole("heading", { name: "Legs" }).focus();
      await userEvent.click(
        within(legPress).getByRole("button", {
          name: "Set 2 logged, 180 kilograms, 11 reps, RIR 1, undo",
        }),
      );
      await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
      await waitFor(() => {
        expect(trainBackend.writes).toEqual(["remove_set", "restore_set"]);
      });
      await within(legPress).findByRole("button", {
        name: "Set 2 logged, 180 kilograms, 11 reps, RIR 1, undo",
      });

      expect(legPress.contains(document.activeElement)).toBe(false);
    });

    it("should give focus to the Undo of the toast when a set is removed from the keyboard", async () => {
      renderSession();
      const legPress = await card("Leg press");
      within(legPress)
        .getByRole("button", { name: "Set 2 logged, 180 kilograms, 11 reps, RIR 1, undo" })
        .focus();

      await userEvent.keyboard(" ");

      const undo = await screen.findByRole("button", { name: "Undo" });
      await waitFor(() => {
        expect(document.activeElement).toBe(undo);
      });
    });

    it("should open the discard question with the sets logged and the session's name", async () => {
      renderSession();

      await userEvent.click(
        await screen.findByRole("button", { name: SESSION_DISCARD.confirmAction }),
      );

      const dialog = await screen.findByRole("dialog", { name: SESSION_DISCARD.title });
      expect(
        within(dialog).getByText(describeDiscardBody({ setCount: 8, dayName: "Legs" })),
      ).toBeTruthy();
    });

    it("should keep the session when the question is answered Keep logging", async () => {
      renderSession();
      await userEvent.click(
        await screen.findByRole("button", { name: SESSION_DISCARD.confirmAction }),
      );

      await userEvent.click(
        await screen.findByRole("button", { name: SESSION_DISCARD.keepAction }),
      );

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(trainBackend.writes).toEqual([]);
      expect(router.replace).not.toHaveBeenCalled();
    });

    it("should delete the session and go to the Train home when it is discarded", async () => {
      renderSession();
      await userEvent.click(
        await screen.findByRole("button", { name: SESSION_DISCARD.confirmAction }),
      );
      const dialog = await screen.findByRole("dialog", { name: SESSION_DISCARD.title });

      await userEvent.click(
        within(dialog).getByRole("button", { name: SESSION_DISCARD.confirmAction }),
      );

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith("/train");
      });
      expect(trainBackend.writes).toEqual(["delete_session"]);
    });

    it("should keep the session and say so when the discard fails", async () => {
      trainBackend.failingWrites = true;
      renderSession();
      await userEvent.click(
        await screen.findByRole("button", { name: SESSION_DISCARD.confirmAction }),
      );
      const dialog = await screen.findByRole("dialog", { name: SESSION_DISCARD.title });

      await userEvent.click(
        within(dialog).getByRole("button", { name: SESSION_DISCARD.confirmAction }),
      );

      expect(await screen.findByText(TRAIN_DISCARD_FAILED)).toBeTruthy();
      expect(router.replace).not.toHaveBeenCalled();
    });
  });

  describe("for a person who trains in pounds", () => {
    beforeEach(() => {
      openGoldenLegs();
      trainBackend.weightUnit = "lb";
    });

    it("should head the load column lb", async () => {
      renderSession();

      const legPress = await card("Leg press");
      expect(within(legPress).getByRole("columnheader", { name: "lb" })).toBeTruthy();
    });

    it("should open the next set's load in pounds", async () => {
      renderSession();

      const legPress = await card("Leg press");
      expect(
        (
          await within(legPress).findByRole<HTMLInputElement>("textbox", {
            name: "Leg press, set 3, pounds",
          })
        ).value,
      ).toBe("396.8");
    });

    it("should store 225 lb as whole grams and read it back as 225", async () => {
      renderSession();

      const legPress = await card("Leg press");
      const load = await within(legPress).findByRole("textbox", {
        name: "Leg press, set 3, pounds",
      });
      await userEvent.clear(load);
      await userEvent.type(load, "225");
      await userEvent.click(within(legPress).getByRole("button", { name: /^Log set 3/ }));

      await waitFor(() => {
        expect(trainBackend.insertedSets).toHaveLength(1);
      });
      expect(trainBackend.insertedSets[0]?.["load_kg"]).toBe(102.058);
      expect(
        await within(legPress).findByRole("button", {
          name: "Set 3 logged, 225 pounds, 11 reps, RIR 1, undo",
        }),
      ).toBeTruthy();
    });

    it("should refuse 2300 lb in the person's unit", async () => {
      renderSession();
      const legPress = await card("Leg press");
      const load = await within(legPress).findByRole("textbox", {
        name: "Leg press, set 3, pounds",
      });
      await userEvent.clear(load);
      await userEvent.type(load, "2300");
      await userEvent.click(within(legPress).getByRole("button", { name: /^Log set 3/ }));

      expect((await within(legPress).findByRole("alert")).textContent).toBe(
        "Enter a load from 0 to 2,204 lb.",
      );
    });
  });

  describe("a session just started", () => {
    beforeEach(() => {
      trainBackend.routine = legsRoutine;
      trainBackend.activeSession = freshLegsOpen("2026-10-15T18:00:00+01:00");
    });

    it("should leave the first set of an exercise with no history for numbers to be typed", async () => {
      renderSession();

      const squat = await card("Barbell squat");
      expect(
        within(squat).getByRole<HTMLInputElement>("textbox", { name: "Barbell squat, set 1, reps" })
          .value,
      ).toBe("");
      expect(within(squat).getByRole("button", { name: "Log set 1" })).toBeTruthy();
    });

    it("should move focus to the next set's first field after a keyboard log", async () => {
      renderSession();
      const squat = await card("Barbell squat");
      await userEvent.type(
        within(squat).getByRole("textbox", { name: "Barbell squat, set 1, reps" }),
        "8",
      );
      within(squat).getByRole("button", { name: "Log set 1, 8 reps" }).focus();

      await userEvent.keyboard(" ");

      await waitFor(() => {
        expect(document.activeElement).toBe(
          within(squat).getByRole("textbox", { name: "Barbell squat, set 2, kilograms" }),
        );
      });
    });

    it("should say the rule under the row when the check is pressed with no numbers", async () => {
      renderSession();

      const squat = await card("Barbell squat");
      await userEvent.click(within(squat).getByRole("button", { name: "Log set 1" }));

      expect((await within(squat).findByRole("alert")).textContent).toBe(
        "Enter whole reps from 1 to 100.",
      );
      expect(trainBackend.writes).toEqual([]);
    });
  });

  describe("adding an exercise", () => {
    beforeEach(() => {
      openGoldenLegs();
      trainBackend.searchableExercises = lateralRaiseResults;
    });

    const openDialog = async () => {
      renderSession();
      await card("Barbell squat");
      await userEvent.click(screen.getByRole("button", { name: SESSION_ACTIVE.addExerciseAction }));
      return screen.getByRole("dialog", { name: ADD_EXERCISE.title });
    };

    it("should open the dialog with the search field focused", async () => {
      await openDialog();

      expect(document.activeElement).toBe(
        screen.getByRole("searchbox", { name: ADD_EXERCISE.searchName }),
      );
    });

    it("should put a card with one row to log on the page for the exercise picked, and close", async () => {
      const dialog = await openDialog();
      await userEvent.type(
        within(dialog).getByRole("searchbox", { name: ADD_EXERCISE.searchName }),
        "lateral raise",
      );

      await userEvent.click(
        await within(dialog).findByRole("button", { name: "Add Side lateral raise" }),
      );

      const added = await card("Side lateral raise");
      expect(within(added).getByRole("button", { name: "Log set 1" })).toBeTruthy();
      expect(within(added).queryByRole("button", { name: "Log set 2" })).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(trainBackend.writes).toEqual([]);
    });

    it("should return focus to Add exercise when Escape closes the dialog", async () => {
      await openDialog();

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: SESSION_ACTIVE.addExerciseAction }),
      );
    });

    it("should leave the session as it was when the dialog is closed without a pick", async () => {
      await openDialog();

      await userEvent.click(screen.getByRole("button", { name: ADD_EXERCISE.closeName }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(5);
    });
  });

  it("should go back to the Train home when no session is in progress", async () => {
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = null;

    renderSession();

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/train");
    });
  });
});
