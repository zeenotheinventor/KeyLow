import { act, cleanup, screen, waitFor, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { pressTwiceInTheSameMoment } from "../support/sameTickPress";
import { ONLY_THE_DATE, SHEET_NOW, renderWeighInSheet } from "../support/weighInSheetHarness";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
} from "../support/weightBackend";

import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

let queryClient: QueryClient;

const renderSheet = () => renderWeighInSheet(queryClient);

const weightField = () => screen.getByLabelText("Weight (kg)");
const noteField = () => screen.getByLabelText(/^Note/);
const saveButton = () => screen.getByRole("button", { name: /^Sav/ });
const INVALID_RANGE = "Enter a weight between 20 and 400 kg.";
const ONE_DECIMAL = "Up to one decimal place.";

describe("the weigh-in sheet, adding", () => {
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

  describe("new", () => {
    it("should be a dialog named Add weigh-in, with a heading and Cancel", async () => {
      await renderSheet();

      expect(screen.getByLabelText("Add weigh-in")).toHaveProp("role", "dialog");
      expect(screen.getByRole("heading", { name: "Add weigh-in" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeOnTheScreen();
    });

    it("should have an empty Weight field with the help under it", async () => {
      await renderSheet();

      expect(weightField()).toHaveDisplayValue("");
      expect(screen.getByText(ONE_DECIMAL)).toBeOnTheScreen();
    });

    it("should start Date and Time at now in the profile's time zone", async () => {
      await renderSheet();

      expect(
        within(screen.getByRole("button", { name: /^Date/ })).getByText("Today, Sat 17 Oct"),
      ).toBeOnTheScreen();
      expect(
        within(screen.getByRole("button", { name: /^Time/ })).getByText("08:15"),
      ).toBeOnTheScreen();
    });

    it("should have Save off, with an empty note labelled optional", async () => {
      await renderSheet();

      expect(saveButton()).toBeDisabled();
      expect(noteField()).toHaveDisplayValue("");
      expect(screen.getByText("(optional)")).toBeOnTheScreen();
    });

    it("should keep Save off while the profile's time zone is not loaded", async () => {
      let release: () => void = () => undefined;
      weightBackend.timeZoneGate = new Promise((resolve) => {
        release = resolve;
      });
      const { user } = await renderWeighInSheet(queryClient, { waitsForZone: false });

      await user.type(weightField(), "81.4");

      expect(saveButton()).toBeDisabled();
      expect(screen.getByRole("button", { name: /^Date/ })).toBeDisabled();
      expect(screen.getByRole("button", { name: /^Time/ })).toBeDisabled();
      await user.press(screen.getByRole("button", { name: /^Date/ }));
      expect(screen.queryByLabelText("Choose a date")).not.toBeOnTheScreen();
      await act(() => {
        release();
      });
      await waitFor(() => {
        expect(saveButton()).toBeEnabled();
      });
    });

    it("should close at once, and add nothing, when Cancel is pressed", async () => {
      const { onClose, user } = await renderSheet();
      await user.type(weightField(), "81.4");

      await user.press(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(weightBackend.addedRows).toHaveLength(0);
    });
  });

  describe("when the profile has no readable time zone", () => {
    it.each([
      ["has none", () => (weightBackend.timeZone = null)],
      ["cannot be read", () => (weightBackend.timeZoneReadFails = true)],
    ])(
      "should read the day and the time in UTC, and add in UTC, when the zone %s",
      async (_, prepare) => {
        prepare();
        const { user } = await renderSheet();
        await user.type(weightField(), "81.4");

        expect(
          within(screen.getByRole("button", { name: /^Time/ })).getByText("07:15"),
        ).toBeOnTheScreen();
        await user.press(saveButton());

        await waitFor(() => {
          expect(weightBackend.addedRows).toHaveLength(1);
        });
        expect(weightBackend.addedRows[0]).toMatchObject({
          measured_at: "2026-10-17T07:15:00.000Z",
          local_date: "2026-10-17",
          tz: "UTC",
        });
      },
    );
  });

  describe("filled", () => {
    it("should turn Save on once a weight is typed", async () => {
      const { user } = await renderSheet();

      await user.type(weightField(), "81.4");

      expect(saveButton()).toBeEnabled();
    });

    it("should add the row once with the weight, the manual source, the day, the zone and the trimmed note, then close", async () => {
      const { onClose, user } = await renderSheet();
      await user.type(weightField(), "81.4");
      await user.type(noteField(), "  Before breakfast  ");

      await user.press(saveButton());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(weightBackend.addedRows).toHaveLength(1);
      expect(weightBackend.addedRows[0]).toMatchObject({
        weight_kg: 81.4,
        source: "manual",
        measured_at: "2026-10-17T07:15:00.000Z",
        local_date: "2026-10-17",
        tz: "Europe/London",
        note: "Before breakfast",
      });
    });

    it("should store no note when none is typed", async () => {
      const { user } = await renderSheet();
      await user.type(weightField(), "81.4");

      await user.press(saveButton());

      await waitFor(() => {
        expect(weightBackend.addedRows).toHaveLength(1);
      });
      expect(weightBackend.addedRows[0]).toMatchObject({ note: null });
    });

    it("should send one request for a double press", async () => {
      const { onClose, user } = await renderSheet();
      await user.type(weightField(), "81.4");

      await pressTwiceInTheSameMoment(saveButton());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(weightBackend.addedRows).toHaveLength(1);
    });

    it("should add nothing more when Save is pressed again while the sheet is closing", async () => {
      const { onClose, user } = await renderSheet();
      await user.type(weightField(), "81.4");
      await user.press(saveButton());
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });

      await user.press(saveButton());
      await act(async () => {
        await Promise.resolve();
      });

      expect(weightBackend.addedRows).toHaveLength(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should add the weight typed with a decimal comma", async () => {
      const { user } = await renderSheet();
      await user.type(weightField(), "81,4");

      expect(saveButton()).toBeEnabled();
      await user.press(saveButton());

      await waitFor(() => {
        expect(weightBackend.addedRows).toHaveLength(1);
      });
      expect(weightBackend.addedRows[0]).toMatchObject({ weight_kg: 81.4 });
    });
  });

  describe("no future date", () => {
    it("should add at now, not at the time the sheet opened, when the clock moved back while it was open", async () => {
      const { user } = await renderSheet();
      await user.type(weightField(), "81.4");
      await act(() => {
        jest.setSystemTime(new Date("2026-10-17T07:10:00Z"));
      });

      await user.press(saveButton());

      await waitFor(() => {
        expect(weightBackend.addedRows).toHaveLength(1);
      });
      expect(weightBackend.addedRows[0]).toMatchObject({
        measured_at: "2026-10-17T07:10:00.000Z",
        local_date: "2026-10-17",
      });
    });
  });

  describe("invalid", () => {
    it("should say the range on the field and keep Save off for 814", async () => {
      const { user } = await renderSheet();

      await user.type(weightField(), "814");

      expect(screen.getByRole("alert", { name: INVALID_RANGE })).toBeOnTheScreen();
      expect(weightField()).toHaveProp("accessibilityHint", INVALID_RANGE);
      expect(saveButton()).toBeDisabled();
      expect(weightBackend.addedRows).toHaveLength(0);
    });

    it("should say up to one decimal place as the error for 81.45", async () => {
      const { user } = await renderSheet();

      await user.type(weightField(), "81.45");

      expect(screen.getByRole("alert", { name: ONE_DECIMAL })).toBeOnTheScreen();
      expect(weightField()).toHaveProp("accessibilityHint", ONE_DECIMAL);
      expect(saveButton()).toBeDisabled();
    });

    it.each(["19.9", "400.1"])("should say the range for %s", async (text) => {
      const { user } = await renderSheet();

      await user.type(weightField(), text);

      expect(screen.getByRole("alert", { name: INVALID_RANGE })).toBeOnTheScreen();
      expect(saveButton()).toBeDisabled();
    });

    it("should take the error away when the weight is put right", async () => {
      const { user } = await renderSheet();
      await user.type(weightField(), "814");

      await user.clear(weightField());
      await user.type(weightField(), "81.4");

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(saveButton()).toBeEnabled();
    });
  });

  describe("saving", () => {
    it("should read Saving, and stop responding, while the request is under way", async () => {
      let release: () => void = () => undefined;
      weightBackend.weighInWriteGate = new Promise((resolve) => {
        release = resolve;
      });
      const { user } = await renderSheet();
      await user.type(weightField(), "81.4");

      await user.press(saveButton());

      const saving = await screen.findByRole("button", { busy: true });
      expect(within(saving).getByText("Saving")).toBeOnTheScreen();
      // It is busy, and not dimmed as a disabled button is: the board draws Save at full strength while it saves.
      expect(saving).toBeBusy();
      expect(String(saving.props.className)).not.toContain("opacity-40");
      expect(within(saving).getByRole("progressbar")).toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();

      await act(() => {
        release();
      });
    });
  });

  describe("save-error", () => {
    async function failToSave() {
      weightBackend.weighInWritesFail = true;
      const view = await renderSheet();
      await view.user.type(weightField(), "81.4");
      await view.user.type(noteField(), "Before breakfast");
      await view.user.press(saveButton());
      await screen.findByRole("alert");
      return view;
    }

    it("should say the fixed sentence in an alert, and keep the sheet open", async () => {
      const { onClose } = await failToSave();

      expect(
        screen.getByRole("alert", {
          name: /Couldn't save your weigh-in\. Check your connection and try again\. What you typed is still here\./,
        }),
      ).toBeOnTheScreen();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("should keep the weight, the date, the time and the note, and turn Save back on", async () => {
      await failToSave();

      expect(weightField()).toHaveDisplayValue("81.4");
      expect(noteField()).toHaveDisplayValue("Before breakfast");
      expect(
        within(screen.getByRole("button", { name: /^Date/ })).getByText("Today, Sat 17 Oct"),
      ).toBeOnTheScreen();
      expect(
        within(screen.getByRole("button", { name: /^Time/ })).getByText("08:15"),
      ).toBeOnTheScreen();
      expect(saveButton()).toBeEnabled();
    });

    it("should show none of the database's words, nor the weight or the note, in the alert", async () => {
      await failToSave();

      const alert = screen.getByRole("alert");
      expect(within(alert).queryByText(/raw database text/)).not.toBeOnTheScreen();
      expect(within(alert).queryByText(/81\.4/)).not.toBeOnTheScreen();
      expect(within(alert).queryByText(/Before breakfast/)).not.toBeOnTheScreen();
    });

    it("should add the weigh-in when Save is pressed again once the connection is back", async () => {
      const { onClose, user } = await failToSave();
      weightBackend.weighInWritesFail = false;

      await user.press(saveButton());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(weightBackend.addedRows).toHaveLength(1);
    });
  });
});
