import { act, cleanup, screen, waitFor, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import {
  ONLY_THE_DATE,
  SHEET_NOW,
  importedWeighIn,
  manualWeighIn,
  renderWeighInSheet,
} from "../support/weighInSheetHarness";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
} from "../support/weightBackend";

import type { WeighIn } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

let queryClient: QueryClient;

// The sheet opens a weigh-in the list holds, so the fake database holds it too.
function renderSheetFor(weighIn: WeighIn) {
  weightBackend.weighIns = [{ ...weighIn }];
  return renderWeighInSheet(queryClient, { weighIn });
}

const weightField = () => screen.getByLabelText("Weight (kg)");
const noteField = () => screen.getByLabelText(/^Note/);
const saveButton = () => screen.getByRole("button", { name: /^Sav/ });
const deleteButton = () => screen.getByRole("button", { name: "Delete weigh-in" });
const dateRow = () => screen.getByRole("button", { name: /^Date/ });
const timeRow = () => screen.getByRole("button", { name: /^Time/ });
const GENERIC_ERROR = "Something went wrong. Try again.";
const SAVE_ERROR =
  "Couldn't save your weigh-in. Check your connection and try again. What you typed is still here.";

describe("the weigh-in sheet, opening a weigh-in", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: SHEET_NOW, doNotFake: [...ONLY_THE_DATE] });
    resetWeightBackend();
    queryClient = createWeightQueryClient();
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await cleanup();
    queryClient.clear();
  });

  describe("edit-manual", () => {
    it("should be a dialog titled Weigh-in with the weight, date, time and note filled in", async () => {
      await renderSheetFor(manualWeighIn);

      expect(screen.getByLabelText("Weigh-in")).toHaveProp("role", "dialog");
      expect(screen.getByRole("heading", { name: "Weigh-in" })).toBeOnTheScreen();
      expect(weightField()).toHaveDisplayValue("81.4");
      expect(within(dateRow()).getByText("Today, Sat 17 Oct")).toBeOnTheScreen();
      expect(within(timeRow()).getByText("08:15")).toBeOnTheScreen();
      expect(noteField()).toHaveDisplayValue("Before breakfast");
    });

    it("should have Save on at once, then Delete weigh-in, and no warning or alert", async () => {
      await renderSheetFor(manualWeighIn);

      expect(saveButton()).toBeEnabled();
      expect(deleteButton()).toBeEnabled();
      expect(screen.queryByRole("note")).not.toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should send the weight alone when only the weight changed", async () => {
      const { onClose, user } = await renderSheetFor(manualWeighIn);

      await user.clear(weightField());
      await user.type(weightField(), "81.9");
      await user.press(saveButton());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(weightBackend.updatedRows).toEqual([
        { id: manualWeighIn.id, change: { weight_kg: 81.9 } },
      ]);
    });

    it("should send the trimmed note alone when only the note changed", async () => {
      const { user } = await renderSheetFor(manualWeighIn);

      await user.clear(noteField());
      await user.type(noteField(), "  After a run  ");
      await user.press(saveButton());

      await waitFor(() => {
        expect(weightBackend.updatedRows).toHaveLength(1);
      });
      expect(weightBackend.updatedRows[0]?.change).toEqual({ note: "After a run" });
    });

    it("should send a null note when the note is cleared", async () => {
      const { user } = await renderSheetFor(manualWeighIn);

      await user.clear(noteField());
      await user.press(saveButton());

      await waitFor(() => {
        expect(weightBackend.updatedRows).toHaveLength(1);
      });
      expect(weightBackend.updatedRows[0]?.change).toEqual({ note: null });
    });

    it("should send the instant, the day and the zone together when the time changed, the day read in the profile's zone", async () => {
      // 23:30 UTC on the 16th is 00:30 on the 17th in London, so the day is not the UTC day.
      const { user } = await renderSheetFor({
        ...manualWeighIn,
        measured_at: "2026-10-16T23:30:00+00:00",
      });
      expect(within(timeRow()).getByText("00:30")).toBeOnTheScreen();
      await user.press(timeRow());
      await user.press(
        within(screen.getByRole("spinbutton", { name: "Hours" })).getByRole("option", {
          name: "01",
        }),
      );
      await user.press(screen.getByRole("button", { name: "Done" }));
      await user.press(saveButton());

      await waitFor(() => {
        expect(weightBackend.updatedRows).toHaveLength(1);
      });
      expect(weightBackend.updatedRows[0]?.change).toEqual({
        measured_at: "2026-10-17T00:30:00.000Z",
        local_date: "2026-10-17",
        tz: "Europe/London",
      });
    });

    it("should send a new day with the instant and the zone when the date changed", async () => {
      const { user } = await renderSheetFor(manualWeighIn);

      await user.press(dateRow());
      await user.press(screen.getByRole("button", { name: "16 October" }));
      await user.press(saveButton());

      await waitFor(() => {
        expect(weightBackend.updatedRows).toHaveLength(1);
      });
      expect(weightBackend.updatedRows[0]?.change).toEqual({
        measured_at: "2026-10-16T07:15:00.000Z",
        local_date: "2026-10-16",
        tz: "Europe/London",
      });
    });

    it("should send nothing, and close, when nothing changed", async () => {
      const { onClose, user } = await renderSheetFor(manualWeighIn);

      await user.press(saveButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(weightBackend.updatedRows).toHaveLength(0);
    });

    it("should say the fixed sentence, keep what was typed and stay open when no manual row is found", async () => {
      weightBackend.updatesMatchNoRow = true;
      const { onClose, user } = await renderSheetFor(manualWeighIn);
      await user.clear(weightField());
      await user.type(weightField(), "81.9");

      await user.press(saveButton());

      expect(await screen.findByRole("alert", { name: SAVE_ERROR })).toBeOnTheScreen();
      expect(weightField()).toHaveDisplayValue("81.9");
      expect(saveButton()).toBeEnabled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("should delete the weigh-in once, with no confirmation, and close", async () => {
      const { onClose, user } = await renderSheetFor(manualWeighIn);

      await user.press(deleteButton());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(weightBackend.deletedIds).toEqual([manualWeighIn.id]);
      expect(screen.queryByRole("alertdialog")).not.toBeOnTheScreen();
    });

    it("should not dim Delete weigh-in while the delete works, but show it busy", async () => {
      let release: () => void = () => undefined;
      weightBackend.weighInWriteGate = new Promise((resolve) => {
        release = resolve;
      });
      const { user } = await renderSheetFor(manualWeighIn);

      await user.press(deleteButton());

      const deleting = await screen.findByRole("button", { busy: true });
      expect(within(deleting).getByText("Delete weigh-in")).toBeOnTheScreen();
      expect(String(deleting.props.className)).not.toContain("opacity-40");
      await act(() => {
        release();
      });
    });

    it("should say the generic sentence, and stay open with Delete on again, when the delete fails", async () => {
      weightBackend.weighInWritesFail = true;
      const { onClose, user } = await renderSheetFor(manualWeighIn);

      await user.press(deleteButton());

      expect(await screen.findByRole("alert", { name: GENERIC_ERROR })).toBeOnTheScreen();
      expect(onClose).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(deleteButton()).toBeEnabled();
      });
    });
  });

  describe("edit-imported", () => {
    it("should be a dialog titled Weigh-in with the notice, the warning and the readings", async () => {
      await renderSheetFor(importedWeighIn);

      expect(screen.getByLabelText("Weigh-in")).toHaveProp("role", "dialog");
      expect(
        screen.getByText("Imported from Health Connect. Edit it in Health Connect."),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("note", {
          name: "Deleting removes it from Ki-Lo only. It stays in Health Connect and won't come back on the next import.",
        }),
      ).toBeOnTheScreen();
      expect(weightField()).toHaveDisplayValue("81.6");
      expect(screen.getByText("Imported readings can only be deleted here.")).toBeOnTheScreen();
      expect(within(dateRow()).getByText("Today")).toBeOnTheScreen();
      expect(within(timeRow()).getByText("07:42")).toBeOnTheScreen();
    });

    it("should have the weight, the date, the time and the note read-only, and no Save", async () => {
      await renderSheetFor(importedWeighIn);

      expect(weightField()).toHaveProp("editable", false);
      expect(noteField()).toHaveProp("editable", false);
      expect(dateRow()).toBeDisabled();
      expect(timeRow()).toBeDisabled();
      expect(screen.queryByRole("button", { name: /^Sav/ })).not.toBeOnTheScreen();
    });

    it("should delete once and close when Delete weigh-in is pressed", async () => {
      const { onClose, user } = await renderSheetFor(importedWeighIn);

      await user.press(deleteButton());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(weightBackend.deletedIds).toEqual([importedWeighIn.id]);
    });

    it("should keep the sheet open with the generic sentence when the delete fails", async () => {
      weightBackend.weighInWritesFail = true;
      const { onClose, user } = await renderSheetFor(importedWeighIn);

      await user.press(deleteButton());

      expect(await screen.findByRole("alert", { name: GENERIC_ERROR })).toBeOnTheScreen();
      expect(onClose).not.toHaveBeenCalled();
      expect(deleteButton()).toBeEnabled();
    });

    it("should close with Cancel and delete nothing", async () => {
      const { onClose, user } = await renderSheetFor(importedWeighIn);

      await user.press(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(weightBackend.deletedIds).toHaveLength(0);
    });
  });

  describe("which zone it reads in", () => {
    it("should show an imported weigh-in in the zone it was taken in, not the profile's", async () => {
      // 06:42 UTC is 02:42 in New York, where the profile (London) would read 07:42.
      await renderSheetFor({ ...importedWeighIn, tz: "America/New_York" });

      expect(within(timeRow()).getByText("02:42")).toBeOnTheScreen();
      expect(within(dateRow()).getByText("Today")).toBeOnTheScreen();
    });
  });

  describe("failures that follow one another", () => {
    it("should say the save sentence, not the delete one, when a save fails after a delete failed", async () => {
      weightBackend.weighInWritesFail = true;
      const { user } = await renderSheetFor(manualWeighIn);
      await user.press(deleteButton());
      await screen.findByRole("alert", { name: GENERIC_ERROR });
      await user.clear(weightField());
      await user.type(weightField(), "81.9");

      await user.press(saveButton());

      expect(await screen.findByRole("alert", { name: SAVE_ERROR })).toBeOnTheScreen();
      expect(screen.queryByRole("alert", { name: GENERIC_ERROR })).not.toBeOnTheScreen();
    });

    it("should say the delete sentence, not the save one, when a delete fails after a save failed", async () => {
      weightBackend.weighInWritesFail = true;
      const { user } = await renderSheetFor(manualWeighIn);
      await user.clear(weightField());
      await user.type(weightField(), "81.9");
      await user.press(saveButton());
      await screen.findByRole("alert", { name: SAVE_ERROR });

      await user.press(deleteButton());

      expect(await screen.findByRole("alert", { name: GENERIC_ERROR })).toBeOnTheScreen();
      expect(screen.queryByRole("alert", { name: SAVE_ERROR })).not.toBeOnTheScreen();
    });
  });

  describe("no future date", () => {
    it("should clamp a changed time that is after now to now when Save is pressed, as when the clock moved back while the sheet was open", async () => {
      const { user } = await renderSheetFor({
        ...manualWeighIn,
        measured_at: "2026-10-17T06:00:00+00:00",
      });
      await user.press(timeRow());
      await user.press(
        within(screen.getByRole("spinbutton", { name: "Hours" })).getByRole("option", {
          name: "08",
        }),
      );
      await user.press(
        within(screen.getByRole("spinbutton", { name: "Minutes" })).getByRole("option", {
          name: "15",
        }),
      );
      await user.press(screen.getByRole("button", { name: "Done" }));
      // 08:15 was now when it was chosen, and the clock then moves back to 08:10.
      await act(() => {
        jest.setSystemTime(new Date("2026-10-17T07:10:00Z"));
      });

      await user.press(saveButton());

      await waitFor(() => {
        expect(weightBackend.updatedRows).toHaveLength(1);
      });
      expect(weightBackend.updatedRows[0]?.change).toEqual({
        measured_at: "2026-10-17T07:10:00.000Z",
        local_date: "2026-10-17",
        tz: "Europe/London",
      });
    });
  });
});
