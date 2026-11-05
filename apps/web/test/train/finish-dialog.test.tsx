import { keys } from "@keylow/api-client";
import {
  ADD_EXERCISE,
  FINISH_SCREEN,
  SESSION_ACTIVE,
  describeSessionSaveFailure,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lateralRaiseResults } from "./addExerciseGolden";
import {
  GOLDEN_SESSION_ID,
  freshLegsOpen,
  goldenLegsOpen,
  legsRoutine,
  loggedSetRow,
} from "./sessionGolden";
import { renderWithTrain, resetTrainBackend, trainBackend } from "./support";

import type { FinishDetails } from "@keylow/api-client";

import { SessionScreen } from "@/components/train";
import { FinishDialog } from "@/components/train/FinishDialog";
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

// The page can be left while a save is on its way, as the browser's Back button does, and the toast stays.
function LeavableSession() {
  const [isOnPage, setIsOnPage] = useState(true);
  return (
    <ToastProvider>
      <button
        type="button"
        onClick={() => {
          setIsOnPage(false);
        }}
      >
        Leave the page
      </button>
      {isOnPage ? <SessionScreen /> : null}
    </ToastProvider>
  );
}

const finishButton = () => screen.findByRole("button", { name: "Finish" });

const openFinishDialog = async () => {
  await userEvent.click(await finishButton());
  return screen.findByRole("dialog", { name: "Finish Legs" });
};

const saveButton = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: /session$/ });

describe("finishing a session", () => {
  beforeEach(() => {
    resetTrainBackend();
    router.push.mockReset();
    router.replace.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(THURSDAY_1900);
    trainBackend.routine = legsRoutine;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("the golden Thursday Legs at 19:00", () => {
    beforeEach(() => {
      trainBackend.activeSession = goldenLegsOpen();
    });

    it("should show the board's three cards and the planned sets left alone", async () => {
      renderSession();

      const dialog = await openFinishDialog();

      const time = within(dialog).getByRole("group", { name: "Time" });
      expect(within(time).getByText("30 min")).toBeTruthy();
      expect(within(time).getByText("18:30 to 19:00")).toBeTruthy();
      const sets = within(dialog).getByRole("group", { name: "Sets" });
      expect(within(sets).getByText("8")).toBeTruthy();
      expect(within(sets).getByText("of 16, and 2 warm-ups")).toBeTruthy();
      const exercises = within(dialog).getByRole("group", { name: "Exercises" });
      expect(within(exercises).getByText("3")).toBeTruthy();
      expect(within(exercises).getByText("of 5 planned")).toBeTruthy();
      expect(within(dialog).getByRole("note").textContent).toBe(
        "8 planned sets are not logged: leg press set 3, seated leg curl and standing calf raise. Only logged sets are saved.",
      );
    });

    it("should leave the Muscles trained slot empty, which is a later ticket", async () => {
      renderSession();

      const dialog = await openFinishDialog();

      expect(within(dialog).queryByText(FINISH_SCREEN.musclesHeading)).toBeNull();
    });

    it("should keep the card and save the end it opened at, when the clock moves on and the dialog redraws", async () => {
      renderSession();
      const dialog = await openFinishDialog();

      act(() => {
        vi.setSystemTime(new Date("2026-10-15T18:20:00Z"));
      });
      // Typing redraws the dialog, which is when a time read at render would move.
      await userEvent.type(
        within(dialog).getByRole("textbox", { name: FINISH_SCREEN.noteLabel }),
        "Knees",
      );

      expect(
        within(within(dialog).getByRole("group", { name: "Time" })).getByText("30 min"),
      ).toBeTruthy();
      await userEvent.click(within(dialog).getByRole("button", { name: "Save session" }));
      await waitFor(() => {
        expect(trainBackend.finishedSessions).toEqual([
          { ended_at: "2026-10-15T18:00:00.000Z", note: "Knees" },
        ]);
      });
    });

    it("should count the note as it is typed", async () => {
      renderSession();
      const dialog = await openFinishDialog();
      expect(within(dialog).getByText("0 / 1,000")).toBeTruthy();

      await userEvent.type(
        within(dialog).getByRole("textbox", { name: FINISH_SCREEN.noteLabel }),
        "Knees felt good",
      );

      expect(within(dialog).getByText("15 / 1,000")).toBeTruthy();
    });

    it("should refuse a note of 1,001 characters with the rule, and not save", async () => {
      renderSession();
      const dialog = await openFinishDialog();
      const note = within(dialog).getByRole("textbox", { name: FINISH_SCREEN.noteLabel });
      note.focus();

      await userEvent.paste("a".repeat(1001));

      expect((await within(dialog).findByRole("alert")).textContent).toBe(
        FINISH_SCREEN.noteTooLong,
      );
      const save = saveButton(dialog);
      expect(save).toHaveProperty("disabled", true);
      await userEvent.click(save);
      expect(trainBackend.writes).toEqual([]);
    });

    it("should close on Keep logging without saving, keep the note, and give focus back to Finish", async () => {
      renderSession();
      const dialog = await openFinishDialog();
      await userEvent.type(
        within(dialog).getByRole("textbox", { name: FINISH_SCREEN.noteLabel }),
        "Knees felt good",
      );

      await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(trainBackend.writes).toEqual([]);
      expect(document.activeElement).toBe(await finishButton());
      const reopened = await openFinishDialog();
      expect(
        within(reopened).getByRole<HTMLTextAreaElement>("textbox", {
          name: FINISH_SCREEN.noteLabel,
        }).value,
      ).toBe("Knees felt good");
    });

    it("should keep focus inside the dialog while it is open", async () => {
      renderSession();
      const dialog = await openFinishDialog();
      const save = saveButton(dialog);
      save.focus();

      await userEvent.tab();

      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close" }));
    });

    describe("Save session", () => {
      it("should store the end and a null note for a blank one, then say so and go to the Train home", async () => {
        renderSession();
        const dialog = await openFinishDialog();

        await userEvent.click(within(dialog).getByRole("button", { name: "Save session" }));

        expect(await screen.findByText(FINISH_SCREEN.savedToast)).toBeTruthy();
        expect(trainBackend.finishedSessions).toEqual([
          { ended_at: "2026-10-15T18:00:00.000Z", note: null },
        ]);
        expect(router.replace).toHaveBeenCalledExactlyOnceWith("/train");
      });

      it("should drop the exercises added to the session that were never logged", async () => {
        trainBackend.searchableExercises = lateralRaiseResults;
        const { queryClient } = renderSession();
        await userEvent.click(
          await screen.findByRole("button", { name: SESSION_ACTIVE.addExerciseAction }),
        );
        const picker = await screen.findByRole("dialog", { name: ADD_EXERCISE.title });
        await userEvent.type(
          within(picker).getByRole("searchbox", { name: ADD_EXERCISE.searchName }),
          "lateral raise",
        );
        await userEvent.click(
          await within(picker).findByRole("button", { name: "Add Side lateral raise" }),
        );
        const addedKey = keys.training.addedExercises(GOLDEN_SESSION_ID);
        expect(queryClient.getQueryData(addedKey)).toHaveLength(1);
        const dialog = await openFinishDialog();

        await userEvent.click(within(dialog).getByRole("button", { name: "Save session" }));

        await waitFor(() => {
          expect(trainBackend.finishedSessions).toHaveLength(1);
        });
        await waitFor(() => {
          expect(queryClient.getQueryData(addedKey)).toBeUndefined();
        });
      });

      it("should store the note as typed", async () => {
        renderSession();
        const dialog = await openFinishDialog();
        await userEvent.type(
          within(dialog).getByRole("textbox", { name: FINISH_SCREEN.noteLabel }),
          "Knees felt good",
        );

        await userEvent.click(within(dialog).getByRole("button", { name: "Save session" }));

        await waitFor(() => {
          expect(trainBackend.finishedSessions).toEqual([
            { ended_at: "2026-10-15T18:00:00.000Z", note: "Knees felt good" },
          ]);
        });
      });

      it("should read Saving session, disabled, and keep the note still while it saves", async () => {
        let release: () => void = () => undefined;
        trainBackend.finishGate = new Promise<void>((resolve) => {
          release = resolve;
        });
        renderSession();
        const dialog = await openFinishDialog();

        await userEvent.click(within(dialog).getByRole("button", { name: "Save session" }));

        const saving = await within(dialog).findByRole("button", { name: "Saving session" });
        expect(saving).toHaveProperty("disabled", true);
        expect(
          within(dialog).getByRole<HTMLTextAreaElement>("textbox", {
            name: FINISH_SCREEN.noteLabel,
          }).disabled,
        ).toBe(true);
        await userEvent.keyboard("{Escape}");
        expect(screen.getByRole("dialog", { name: "Finish Legs" })).toBeTruthy();
        await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
        expect(screen.getByRole("dialog", { name: "Finish Legs" })).toBeTruthy();
        act(() => {
          release();
        });
        await waitFor(() => {
          expect(router.replace).toHaveBeenCalledTimes(1);
        });
      });

      it("should say the session did not save, keep the note, and send again from Try again", async () => {
        trainBackend.failingWrites = true;
        renderSession();
        const dialog = await openFinishDialog();
        await userEvent.type(
          within(dialog).getByRole("textbox", { name: FINISH_SCREEN.noteLabel }),
          "Knees felt good",
        );

        await userEvent.click(within(dialog).getByRole("button", { name: "Save session" }));

        const alert = await within(dialog).findByRole("alert");
        expect(alert.textContent).toContain(FINISH_SCREEN.saveFailureTitle);
        expect(alert.textContent).toContain(describeSessionSaveFailure(8));
        expect(
          within(dialog).getByRole<HTMLTextAreaElement>("textbox", {
            name: FINISH_SCREEN.noteLabel,
          }).value,
        ).toBe("Knees felt good");
        expect(router.replace).not.toHaveBeenCalled();
        expect(screen.queryByText(FINISH_SCREEN.savedToast)).toBeNull();

        trainBackend.failingWrites = false;
        await userEvent.click(within(dialog).getByRole("button", { name: "Try again" }));

        await waitFor(() => {
          expect(trainBackend.finishedSessions).toEqual([
            { ended_at: "2026-10-15T18:00:00.000Z", note: "Knees felt good" },
          ]);
        });
        expect(router.replace).toHaveBeenCalledExactlyOnceWith("/train");
        expect(trainBackend.writes.filter((write) => write === "finish_session")).toHaveLength(2);
      });

      it("should move focus to the error, so a keyboard user hears it", async () => {
        trainBackend.failingWrites = true;
        renderSession();
        const dialog = await openFinishDialog();

        await userEvent.click(within(dialog).getByRole("button", { name: "Save session" }));

        const alert = await within(dialog).findByRole("alert");
        await waitFor(() => {
          expect(document.activeElement?.contains(alert)).toBe(true);
        });
      });

      it("should go to the error state without sending when there is no connection", async () => {
        renderSession();
        const dialog = await openFinishDialog();
        act(() => {
          onlineManager.setOnline(false);
        });

        await userEvent.click(within(dialog).getByRole("button", { name: "Save session" }));

        expect((await within(dialog).findByRole("alert")).textContent).toContain(
          FINISH_SCREEN.saveFailureTitle,
        );
        expect(trainBackend.writes).toEqual([]);
        expect(within(dialog).getByRole("button", { name: "Try again" })).toBeTruthy();
      });

      it("should say the session is saved, but not leave the page, when it was left while saving", async () => {
        let release: () => void = () => undefined;
        trainBackend.finishGate = new Promise<void>((resolve) => {
          release = resolve;
        });
        renderWithTrain(<LeavableSession />);
        const dialog = await openFinishDialog();
        await userEvent.click(within(dialog).getByRole("button", { name: "Save session" }));
        await within(dialog).findByRole("button", { name: "Saving session" });

        await userEvent.click(screen.getByRole("button", { name: "Leave the page" }));
        act(() => {
          release();
        });

        expect(await screen.findByText(FINISH_SCREEN.savedToast)).toBeTruthy();
        expect(router.replace).not.toHaveBeenCalled();
      });
    });
  });

  describe("a session with nothing logged", () => {
    beforeEach(() => {
      trainBackend.activeSession = freshLegsOpen("2026-10-15T18:00:00+01:00");
    });

    it("should disable Finish and say to log a set or discard", async () => {
      renderSession();

      const finish = await finishButton();

      expect(finish).toHaveProperty("disabled", true);
      expect(screen.getByText(FINISH_SCREEN.nothingLoggedHint)).toBeTruthy();
      expect(
        screen.getByRole("button", {
          name: "Finish",
          description: FINISH_SCREEN.nothingLoggedHint,
        }),
      ).toBe(finish);
    });
  });

  describe("a session with only a warm-up logged", () => {
    it("should let it finish and count the warm-up in the failure line", async () => {
      trainBackend.activeSession = {
        ...freshLegsOpen("2026-10-15T18:00:00+01:00"),
        workout_sets: [
          loggedSetRow("00000006-0000-4000-8000-000000000081", "squat", 1, { set_type: "warmup" }),
        ],
      };
      trainBackend.failingWrites = true;
      renderSession();
      const dialog = await openFinishDialog();

      await userEvent.click(within(dialog).getByRole("button", { name: "Save session" }));

      expect((await within(dialog).findByRole("alert")).textContent).toContain(
        describeSessionSaveFailure(1),
      );
    });
  });

  describe("a set that is still being saved", () => {
    it("should keep Finish disabled until the database has stored it", async () => {
      trainBackend.activeSession = goldenLegsOpen();
      trainBackend.hangingSetWrites = true;
      renderSession();
      const legPress = await screen.findByRole("region", { name: "Leg press" });

      await userEvent.click(within(legPress).getByRole("button", { name: /^Log set 3/ }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Finish" })).toHaveProperty("disabled", true);
      });
    });
  });

  describe("a second press before the first save is drawn", () => {
    const details: FinishDetails = {
      sessionId: "00000006-0000-4000-8000-000000000080",
      dayName: "Legs",
      startedAt: "2026-10-15T17:30:00+00:00",
      workingSets: 8,
      plannedSets: 16,
      warmups: 2,
      exercisesLogged: 3,
      exercisesPlanned: 5,
      notLoggedNote: null,
      sets: [],
    };

    it("should save once and say so once", async () => {
      trainBackend.activeSession = goldenLegsOpen();
      const onSaved = vi.fn();
      renderWithTrain(
        <FinishDialog
          details={details}
          note=""
          onChangeNote={vi.fn()}
          onKeepLogging={vi.fn()}
          onSaved={onSaved}
        />,
      );
      const save = await screen.findByRole("button", { name: "Save session" });

      act(() => {
        fireEvent.click(save);
        fireEvent.click(save);
      });

      await waitFor(() => {
        expect(onSaved).toHaveBeenCalled();
      });
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(trainBackend.writes.filter((write) => write === "finish_session")).toHaveLength(1);
    });
  });
});
