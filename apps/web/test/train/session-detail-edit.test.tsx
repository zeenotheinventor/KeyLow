import {
  HISTORY_DELETE_SESSION,
  HISTORY_EDIT_SET,
  HISTORY_SESSION_NOT_FOUND,
  SET_ENTRY,
  describeDeleteSessionBody,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PULL_SESSION_ID,
  detailBackend,
  goldenPullSession,
  renderWithDetail,
  resetDetailBackend,
} from "./sessionDetailBackend";

import { SessionDetailScreen } from "@/components/train/SessionDetailScreen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const renderDetail = () =>
  renderWithDetail(<SessionDetailScreen id={PULL_SESSION_ID} origin="history" />);

const card = (name: string) => screen.findByRole("region", { name });

const CURL_SET_3 = "Set 3, 30 kg by 9, RIR 1, edit";
const EDIT_FORM = "Edit Barbell curl, set 3";

/** The buttons of the sets of a card: Add set under the table is not one of them. */
const setButtonsOf = (exerciseCard: HTMLElement) =>
  within(within(exerciseCard).getByRole("table", { name: "Sets" })).getAllByRole("button");

const curlSet3 = async () =>
  within(await card("Barbell curl")).getByRole("button", { name: CURL_SET_3 });

/** Opens the edit dialog of barbell curl set 3, as the board draws it. */
async function openCurlSet3() {
  await userEvent.click(await curlSet3());
  return screen.findByRole("dialog", { name: "Barbell curl" });
}

const setOnline = (isOnline: boolean) => {
  act(() => {
    onlineManager.setOnline(isOnline);
  });
};

const writesTo = (target: string) =>
  detailBackend.writes.filter((write) => write.target === target);

describe("the session detail, changing a past session", () => {
  beforeEach(() => {
    resetDetailBackend();
    detailBackend.sessions = [goldenPullSession()];
    router.push.mockReset();
    router.replace.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setOnline(true);
  });

  describe("the rows", () => {
    it("should make each set a button that names the set and what pressing it does", async () => {
      renderDetail();

      const curl = await card("Barbell curl");
      expect(setButtonsOf(curl)).toHaveLength(4);
      expect(within(curl).getByRole("button", { name: CURL_SET_3 })).toBeTruthy();
    });

    it("should keep the table, with a row for each set still named for the set", async () => {
      renderDetail();

      const curl = await card("Barbell curl");
      const sets = within(curl).getByRole("table", { name: "Sets" });
      expect(within(sets).getAllByRole("row")).toHaveLength(4);
      expect(within(sets).getByRole("row", { name: "Set 3, 30 kg by 9, RIR 1" })).toBeTruthy();
      expect(within(sets).getAllByRole("cell")).toHaveLength(16);
    });
  });

  describe("opening a set", () => {
    it("should open the set with its numbers, RIR and the line about the heat", async () => {
      renderDetail();

      const dialog = await openCurlSet3();

      expect(within(dialog).getByText(/^Set 3 · Tue 13 Oct, /)).toBeTruthy();
      expect(within(dialog).getByRole("textbox", { name: "Load, kg" })).toHaveProperty(
        "value",
        "30",
      );
      expect(within(dialog).getByRole("textbox", { name: "Reps" })).toHaveProperty("value", "9");
      expect(within(dialog).getByRole("radio", { name: "1" }).getAttribute("aria-checked")).toBe(
        "true",
      );
      expect(within(dialog).getByText(HISTORY_EDIT_SET.effectHint)).toBeTruthy();
      expect(within(dialog).queryByText(HISTORY_EDIT_SET.noRirHint)).toBeNull();
    });

    it("should put the cursor in the reps", async () => {
      renderDetail();

      const dialog = await openCurlSet3();

      expect(document.activeElement).toBe(within(dialog).getByRole("textbox", { name: "Reps" }));
    });

    it("should show the load in pounds for someone who trains in them, and save a load they type to the gram in kilograms", async () => {
      detailBackend.weightUnit = "lb";
      renderDetail();
      const curl = await card("Barbell curl");
      await userEvent.click(within(curl).getByRole("button", { name: /^Set 3, 66.1 lb by 9/ }));
      const dialog = await screen.findByRole("dialog", { name: "Barbell curl" });
      const load = within(dialog).getByRole("textbox", { name: "Load, lb" });
      expect(load).toHaveProperty("value", "66.1");

      await userEvent.clear(load);
      await userEvent.type(load, "70");
      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.saveAction }),
      );

      await waitFor(() => {
        expect(writesTo("workout_sets")).toHaveLength(1);
      });
      expect(writesTo("workout_sets")[0]?.body).toEqual({ load_kg: 31.751 });
    });

    it("should leave a load alone that was not touched, so the pounds it was shown in do not move it", async () => {
      detailBackend.weightUnit = "lb";
      renderDetail();
      const curl = await card("Barbell curl");
      await userEvent.click(within(curl).getByRole("button", { name: /^Set 3, 66.1 lb by 9/ }));
      const dialog = await screen.findByRole("dialog", { name: "Barbell curl" });
      const reps = within(dialog).getByRole("textbox", { name: "Reps" });

      await userEvent.clear(reps);
      await userEvent.type(reps, "10");
      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.saveAction }),
      );

      await waitFor(() => {
        expect(writesTo("workout_sets")).toHaveLength(1);
      });
      expect(writesTo("workout_sets")[0]?.body).toEqual({ reps: 10 });
    });
  });

  describe("saving", () => {
    it("should save the new reps, close the dialog, refresh the set and give focus back to its row", async () => {
      renderDetail();
      const dialog = await openCurlSet3();
      const reps = within(dialog).getByRole("textbox", { name: "Reps" });

      await userEvent.clear(reps);
      await userEvent.type(reps, "10");
      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.saveAction }),
      );

      const row = await within(await card("Barbell curl")).findByRole("button", {
        name: "Set 3, 30 kg by 10, RIR 1, edit",
      });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(writesTo("workout_sets")).toEqual([
        { target: "workout_sets", method: "PATCH", body: { reps: 10 } },
      ]);
      expect(document.activeElement).toBe(row);
    });

    it("should close and write nothing when nothing was changed", async () => {
      renderDetail();
      const dialog = await openCurlSet3();

      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.saveAction }),
      );

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(detailBackend.writes).toEqual([]);
    });

    it("should say what a rep count must be and keep Save off while it breaks the rule", async () => {
      renderDetail();
      const dialog = await openCurlSet3();
      const reps = within(dialog).getByRole("textbox", { name: "Reps" });

      await userEvent.clear(reps);
      await userEvent.type(reps, "0");

      expect(within(dialog).getByRole("alert").textContent).toBe("Enter whole reps from 1 to 100.");
      expect(
        within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.saveAction }),
      ).toHaveProperty("disabled", true);
    });

    it("should save a new RIR, and a RIR taken back by pressing the chosen chip, with the line for a working set with none", async () => {
      renderDetail();
      const dialog = await openCurlSet3();

      await userEvent.click(within(dialog).getByRole("radio", { name: "3" }));
      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.saveAction }),
      );
      await waitFor(() => {
        expect(writesTo("workout_sets")).toHaveLength(1);
      });
      expect(writesTo("workout_sets")[0]?.body).toEqual({ rir: 3, rpe: null });

      const again = await (async () => {
        await userEvent.click(
          await within(await card("Barbell curl")).findByRole("button", {
            name: "Set 3, 30 kg by 9, RIR 3, edit",
          }),
        );
        return screen.findByRole("dialog", { name: "Barbell curl" });
      })();
      await userEvent.click(within(again).getByRole("radio", { name: "3" }));

      expect(within(again).getByText(HISTORY_EDIT_SET.noRirHint)).toBeTruthy();
      await userEvent.click(
        within(again).getByRole("button", { name: HISTORY_EDIT_SET.saveAction }),
      );
      await waitFor(() => {
        expect(writesTo("workout_sets")).toHaveLength(2);
      });
      expect(writesTo("workout_sets")[1]?.body).toEqual({ rir: null });
    });

    it("should keep the dialog and what was typed when the save fails, say so, and save at the next try", async () => {
      renderDetail();
      const dialog = await openCurlSet3();
      const reps = within(dialog).getByRole("textbox", { name: "Reps" });
      await userEvent.clear(reps);
      await userEvent.type(reps, "12");
      detailBackend.failingWrites = true;

      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.saveAction }),
      );

      expect(await screen.findByText(SET_ENTRY.saveFailed)).toBeTruthy();
      expect(screen.getByRole("dialog", { name: "Barbell curl" })).toBeTruthy();
      expect(reps).toHaveProperty("value", "12");
      expect(document.body.textContent).not.toContain("raw database text");

      detailBackend.failingWrites = false;
      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.saveAction }),
      );

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(
        await within(await card("Barbell curl")).findByRole("button", {
          name: "Set 3, 30 kg by 12, RIR 1, edit",
        }),
      ).toBeTruthy();
    });

    it("should write once when the form is submitted twice before the first is answered", async () => {
      renderDetail();
      const dialog = await openCurlSet3();
      const reps = within(dialog).getByRole("textbox", { name: "Reps" });
      await userEvent.clear(reps);
      await userEvent.type(reps, "10");
      let release: () => void = () => undefined;
      detailBackend.writeGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const form = within(dialog).getByRole("form", { name: EDIT_FORM });

      fireEvent.submit(form);
      fireEvent.submit(form);
      await waitFor(() => {
        expect(detailBackend.writes).toHaveLength(1);
      });
      release();

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(detailBackend.writes).toHaveLength(1);
    });

    it("should turn Save changes and Delete set off, with Save loading, while a save is on its way", async () => {
      renderDetail();
      const dialog = await openCurlSet3();
      const reps = within(dialog).getByRole("textbox", { name: "Reps" });
      await userEvent.clear(reps);
      await userEvent.type(reps, "10");
      let release: () => void = () => undefined;
      detailBackend.writeGate = new Promise<void>((resolve) => {
        release = resolve;
      });

      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.saveAction }),
      );

      await waitFor(() => {
        expect(detailBackend.writes).toHaveLength(1);
      });
      const save = within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.saveAction });
      expect(save).toHaveProperty("disabled", true);
      expect(save.getAttribute("aria-busy")).toBe("true");
      expect(
        within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.deleteSetAction }),
      ).toHaveProperty("disabled", true);
      release();
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    });

    it("should turn Save changes off while a delete is on its way", async () => {
      renderDetail();
      const dialog = await openCurlSet3();
      let release: () => void = () => undefined;
      detailBackend.writeGate = new Promise<void>((resolve) => {
        release = resolve;
      });

      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.deleteSetAction }),
      );

      await waitFor(() => {
        expect(detailBackend.writes).toHaveLength(1);
      });
      expect(
        within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.saveAction }),
      ).toHaveProperty("disabled", true);
      release();
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    });

    it("should close with Escape and give focus back to the row, writing nothing", async () => {
      renderDetail();
      // A click does not focus a button in every browser, so focus must not depend on it having.
      fireEvent.click(await curlSet3());
      await screen.findByRole("dialog", { name: "Barbell curl" });

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(await curlSet3());
      expect(detailBackend.writes).toEqual([]);
      expect(router.replace).not.toHaveBeenCalled();
    });
  });

  describe("offline", () => {
    it("should turn Save changes and Delete set off, say why, and send nothing for Enter in a field", async () => {
      renderDetail();
      const dialog = await openCurlSet3();
      const reps = within(dialog).getByRole("textbox", { name: "Reps" });
      await userEvent.clear(reps);
      await userEvent.type(reps, "10");

      setOnline(false);

      const save = within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.saveAction });
      const remove = within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.deleteSetAction });
      expect(save).toHaveProperty("disabled", true);
      expect(remove).toHaveProperty("disabled", true);
      expect(within(dialog).getByText(HISTORY_EDIT_SET.offline)).toBeTruthy();
      expect(save.getAttribute("aria-describedby")).toBe(
        within(dialog).getByText(HISTORY_EDIT_SET.offline).closest("[id]")?.id,
      );
      fireEvent.submit(within(dialog).getByRole("form", { name: EDIT_FORM }));
      await act(async () => {
        await Promise.resolve();
      });
      expect(detailBackend.writes).toEqual([]);
      // Nothing is tried, so nothing fails: no toast says the set did not save.
      expect(screen.queryByText(SET_ENTRY.saveFailed)).toBeNull();
      expect(screen.getByRole("dialog", { name: "Barbell curl" })).toBeTruthy();
    });

    it("should send nothing when the dialog is cancelled offline and the connection comes back", async () => {
      renderDetail();
      const dialog = await openCurlSet3();
      const reps = within(dialog).getByRole("textbox", { name: "Reps" });
      await userEvent.clear(reps);
      await userEvent.type(reps, "10");
      setOnline(false);
      fireEvent.submit(within(dialog).getByRole("form", { name: EDIT_FORM }));

      await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
      setOnline(true);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(detailBackend.writes).toEqual([]);
    });
  });

  describe("deleting a set", () => {
    it("should remove the set with an Undo toast that brings it back", async () => {
      renderDetail();
      const dialog = await openCurlSet3();

      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.deleteSetAction }),
      );

      expect(await screen.findByText("Set removed: Barbell curl, set 3")).toBeTruthy();
      expect(screen.queryByRole("dialog")).toBeNull();
      const curl = await card("Barbell curl");
      await waitFor(() => {
        expect(setButtonsOf(curl)).toHaveLength(3);
      });
      expect(writesTo("workout_sets").map(({ method }) => method)).toEqual(["PATCH"]);

      await userEvent.click(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(setButtonsOf(curl)).toHaveLength(4);
      });
      expect(within(curl).getByRole("button", { name: CURL_SET_3 })).toBeTruthy();
    });

    it("should keep the dialog when the delete fails, and say so", async () => {
      renderDetail();
      const dialog = await openCurlSet3();
      detailBackend.failingWrites = true;

      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.deleteSetAction }),
      );

      expect(await screen.findByText(SET_ENTRY.removeFailed)).toBeTruthy();
      expect(screen.getByRole("dialog", { name: "Barbell curl" })).toBeTruthy();
    });

    it("should take focus to Undo after a keyboard delete, and to the next set when the toast goes", async () => {
      renderDetail();
      const barbellRow = await card("Bent over barbell row");
      within(barbellRow).getByRole("button", { name: "Set 2, 70 kg by 9, RIR 2, edit" }).focus();
      await userEvent.keyboard("{Enter}");
      const dialog = await screen.findByRole("dialog", { name: "Bent over barbell row" });
      within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.deleteSetAction }).focus();

      await userEvent.keyboard("{Enter}");

      const undo = await screen.findByRole("button", { name: "Undo" });
      await waitFor(() => {
        expect(document.activeElement).toBe(undo);
      });
      await userEvent.keyboard("{Escape}");
      // The set after the deleted one moves up a place, so it is now the second.
      await waitFor(() => {
        expect(document.activeElement).toBe(
          within(barbellRow).getByRole("button", { name: "Set 2, 70 kg by 8, RIR 2, edit" }),
        );
      });
    });

    it("should leave focus alone after a pointer delete", async () => {
      renderDetail();
      const dialog = await openCurlSet3();

      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_EDIT_SET.deleteSetAction }),
      );

      const undo = await screen.findByRole("button", { name: "Undo" });
      expect(document.activeElement).not.toBe(undo);
    });
  });

  describe("deleting the session", () => {
    const openQuestion = async () => {
      await userEvent.click(
        await screen.findByRole("button", { name: HISTORY_DELETE_SESSION.confirmAction }),
      );
      return screen.findByRole("dialog", { name: HISTORY_DELETE_SESSION.title });
    };

    it("should ask first, with the sets, the day and the date, and change nothing for Keep it", async () => {
      renderDetail();

      const dialog = await openQuestion();

      expect(
        within(dialog).getByText(
          describeDeleteSessionBody({ setCount: 17, dayName: "Pull", localDate: "2026-10-13" }),
        ),
      ).toBeTruthy();
      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_DELETE_SESSION.cancelAction }),
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(detailBackend.writes).toEqual([]);
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: HISTORY_DELETE_SESSION.confirmAction }),
      );
    });

    it("should delete the session and leave for the history without a way back to it", async () => {
      renderDetail();
      const dialog = await openQuestion();

      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_DELETE_SESSION.confirmAction }),
      );

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledWith("/train/history");
      });
      expect(router.push).not.toHaveBeenCalled();
      expect(writesTo("delete_workout_session")).toEqual([
        {
          target: "delete_workout_session",
          method: "POST",
          body: { p_session_id: PULL_SESSION_ID },
        },
      ]);
      // What was shown stays until the page has left, so it never flashes "not found".
      expect(screen.queryByRole("heading", { name: HISTORY_SESSION_NOT_FOUND.title })).toBeNull();
      expect(screen.getByRole("heading", { level: 1, name: "Pull" })).toBeTruthy();
    });

    it("should delete once however many presses arrive before it is answered", async () => {
      renderDetail();
      const dialog = await openQuestion();
      let release: () => void = () => undefined;
      detailBackend.writeGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const confirm = within(dialog).getByRole("button", {
        name: HISTORY_DELETE_SESSION.confirmAction,
      });

      // Both presses arrive before React has drawn the first one's busy button.
      act(() => {
        fireEvent.click(confirm);
        fireEvent.click(confirm);
      });
      release();

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledTimes(1);
      });
      expect(writesTo("delete_workout_session")).toHaveLength(1);
    });

    it("should keep both buttons off once the delete has worked, until the page has left", async () => {
      renderDetail();
      const dialog = await openQuestion();

      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_DELETE_SESSION.confirmAction }),
      );

      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledTimes(1);
      });
      // The page has not left yet (the router is a stand-in), so the dialog is still there.
      const confirm = within(dialog).getByRole("button", {
        name: HISTORY_DELETE_SESSION.confirmAction,
      });
      expect(confirm).toHaveProperty("disabled", true);
      expect(
        within(dialog).getByRole("button", { name: HISTORY_DELETE_SESSION.cancelAction }),
      ).toHaveProperty("disabled", true);
      fireEvent.click(confirm);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(writesTo("delete_workout_session")).toHaveLength(1);
      expect(screen.queryByText(HISTORY_DELETE_SESSION.failed)).toBeNull();
      expect(screen.queryByRole("heading", { name: HISTORY_SESSION_NOT_FOUND.title })).toBeNull();
    });

    it("should turn Keep it off while the delete is on its way", async () => {
      renderDetail();
      const dialog = await openQuestion();
      let release: () => void = () => undefined;
      detailBackend.writeGate = new Promise<void>((resolve) => {
        release = resolve;
      });

      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_DELETE_SESSION.confirmAction }),
      );

      await waitFor(() => {
        expect(detailBackend.writes).toHaveLength(1);
      });
      expect(
        within(dialog).getByRole("button", { name: HISTORY_DELETE_SESSION.cancelAction }),
      ).toHaveProperty("disabled", true);
      release();
      await waitFor(() => {
        expect(router.replace).toHaveBeenCalledTimes(1);
      });
    });

    it("should keep the dialog and say so when the delete fails", async () => {
      renderDetail();
      const dialog = await openQuestion();
      detailBackend.failingWrites = true;

      await userEvent.click(
        within(dialog).getByRole("button", { name: HISTORY_DELETE_SESSION.confirmAction }),
      );

      expect(await screen.findByText(HISTORY_DELETE_SESSION.failed)).toBeTruthy();
      expect(screen.getByRole("dialog", { name: HISTORY_DELETE_SESSION.title })).toBeTruthy();
      expect(router.replace).not.toHaveBeenCalled();
      expect(screen.getByRole("heading", { level: 1, name: "Pull" })).toBeTruthy();
    });

    it("should turn Delete session off offline and say why, on the page and in the question", async () => {
      renderDetail();
      const deleteSession = await screen.findByRole("button", {
        name: HISTORY_DELETE_SESSION.confirmAction,
      });

      setOnline(false);

      expect(deleteSession).toHaveProperty("disabled", true);
      expect(screen.getByText(HISTORY_DELETE_SESSION.offline)).toBeTruthy();
      setOnline(true);
      const dialog = await openQuestion();
      setOnline(false);
      const confirm = within(dialog).getByRole("button", {
        name: HISTORY_DELETE_SESSION.confirmAction,
      });
      expect(confirm).toHaveProperty("disabled", true);
      fireEvent.click(confirm);
      await act(async () => {
        await Promise.resolve();
      });
      expect(detailBackend.writes).toEqual([]);
    });
  });
});
