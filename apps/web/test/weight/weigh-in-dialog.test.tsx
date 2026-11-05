import { GENERIC_ERROR, WEIGH_IN_SHEET, WEIGHT_EMPTY, WEIGHT_SCREEN } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEAKY_DATABASE_MESSAGE,
  renderWithWeight,
  resetWeightBackend,
  weighInRow,
  weightBackend,
} from "./support";

import { WeightScreen } from "@/components/weight";

// Saturday 17 October 2026, 12:00 UTC, which is 12:00 in the profile's zone (UTC).
const NOW = new Date("2026-10-17T12:00:00Z");

function earlierReadings() {
  return [
    weighInRow({ localDate: "2026-10-15", utcTime: "07:24", weightKg: 81.8, note: "Before work" }),
    weighInRow({ localDate: "2026-10-14", utcTime: "08:31", weightKg: 81.9 }),
  ];
}

// 08:17 in London in October is 07:17 UTC: the reading is shown in the zone it was taken in.
function importedReading() {
  return {
    ...weighInRow({
      localDate: "2026-10-16",
      utcTime: "07:17",
      weightKg: 81.6,
      source: "health_connect",
    }),
    tz: "Europe/London",
  };
}

const addButtons = () => screen.getAllByRole("button", { name: WEIGHT_SCREEN.addLabel });
function nth<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`There is no item at ${index}`);
  }
  return item;
}
const dialog = (name: string) => screen.findByRole("dialog", { name });
const weightField = () => screen.getByRole("textbox", { name: /^Weight/ });
const noteField = () => screen.getByRole("textbox", { name: /^Note/ });
const saveButton = () => screen.getByRole("button", { name: /^(Save|Saving)$/ });
const typeWeight = (text: string) => {
  fireEvent.change(weightField(), { target: { value: text } });
};
const list = () => screen.findByRole("region", { name: "Weigh-ins" });

async function openAdd({ goesOffline = false } = {}) {
  renderWithWeight(<WeightScreen />);
  await list();
  // The list is read online, as a person who loses the connection with the page open has it.
  onlineManager.setOnline(!goesOffline);
  const opener = nth(addButtons(), 0);
  opener.focus();
  fireEvent.click(opener);
  await dialog(WEIGH_IN_SHEET.titleAdd);
  return opener;
}

async function openRow(day: string, { goesOffline = false } = {}) {
  renderWithWeight(<WeightScreen />);
  const row = within(await list()).getByRole("button", { name: new RegExp(`^${day}`) });
  onlineManager.setOnline(!goesOffline);
  row.focus();
  fireEvent.click(row);
  await dialog(WEIGH_IN_SHEET.titleEdit);
  return row;
}

describe("the weigh-in dialog on the Weight page", () => {
  beforeEach(() => {
    resetWeightBackend();
    weightBackend.weighIns = earlierReadings();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("adding", () => {
    it("should open from the header's Add weigh-in with Date and Time at now and Save off", async () => {
      await openAdd();

      expect(
        within(screen.getByRole("dialog")).getByRole("heading", { level: 2 }).textContent,
      ).toBe(WEIGH_IN_SHEET.titleAdd);
      expect(screen.getByRole("button", { name: /^Date\s*Today, Sat 17 Oct/ })).toBeTruthy();
      expect(screen.getByRole("button", { name: /^Time\s*12:00/ })).toBeTruthy();
      expect(weightField().getAttribute("placeholder")).toBe(WEIGH_IN_SHEET.weightPlaceholder);
      expect(screen.getByText(WEIGH_IN_SHEET.help)).toBeTruthy();
      expect(saveButton().hasAttribute("disabled")).toBe(true);
      expect(screen.queryByRole("button", { name: WEIGH_IN_SHEET.delete })).toBeNull();
    });

    it("should open from the empty state's button too", async () => {
      weightBackend.weighIns = [];
      renderWithWeight(<WeightScreen />);
      await screen.findByRole("heading", { name: WEIGHT_EMPTY.title });
      // The header's button, then the empty state's own.
      const buttons = addButtons();
      expect(buttons).toHaveLength(2);

      fireEvent.click(nth(buttons, 1));

      expect(await dialog(WEIGH_IN_SHEET.titleAdd)).toBeTruthy();
    });

    it("should add 72.4 kg once as a manual weigh-in at now, close, and show it at the top of the list", async () => {
      await openAdd();
      typeWeight("72.4");
      fireEvent.change(noteField(), { target: { value: "  After a run  " } });

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(weightBackend.addedRows).toEqual([
        expect.objectContaining({
          weight_kg: 72.4,
          source: "manual",
          local_date: "2026-10-17",
          tz: "UTC",
          measured_at: "2026-10-17T12:00:00.000Z",
          note: "After a run",
        }),
      ]);
      const top = nth(within(await list()).getAllByRole("button"), 0);
      expect(top.textContent).toContain("72.4");
      expect(top.textContent).toContain("Today");
    });

    it("should send one request when Save is pressed twice before the request settles", async () => {
      let release: () => void = () => undefined;
      weightBackend.weighInWriteGate = new Promise((resolve) => {
        release = resolve;
      });
      await openAdd();
      typeWeight("72.4");

      fireEvent.click(saveButton());
      // Enter in a field submits the form even while the button is busy.
      const form = weightField().closest("form");
      expect(form).not.toBeNull();
      if (form !== null) {
        fireEvent.submit(form);
        fireEvent.submit(form);
      }
      await act(async () => {
        release();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(weightBackend.addedRows).toHaveLength(1);
    });

    it("should read Saving, busy, while the request is under way", async () => {
      let release: () => void = () => undefined;
      weightBackend.weighInWriteGate = new Promise((resolve) => {
        release = resolve;
      });
      await openAdd();
      typeWeight("72.4");

      fireEvent.click(saveButton());

      const saving = await screen.findByRole("button", { name: WEIGH_IN_SHEET.saving });
      expect(saving.getAttribute("aria-busy")).toBe("true");
      await act(async () => {
        release();
        await Promise.resolve();
      });
    });

    it("should say core's sentence as an alert and keep Save off for a weight out of bounds", async () => {
      await openAdd();

      typeWeight("814");

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Enter a weight between 20 and 400 kg.",
      );
      expect(saveButton().hasAttribute("disabled")).toBe(true);
      typeWeight("81.4");
      expect(screen.queryByRole("alert")).toBeNull();
      expect(saveButton().hasAttribute("disabled")).toBe(false);
    });

    it("should offer no day after today", async () => {
      await openAdd();

      fireEvent.click(screen.getByRole("button", { name: /^Date/ }));

      const picker = await screen.findByRole("dialog", { name: "Choose a date" });
      const tomorrow = within(picker).getByRole("button", { name: /^18 October/ });
      expect(tomorrow.hasAttribute("disabled")).toBe(true);
      expect(
        within(picker)
          .getByRole("button", { name: /^17 October/ })
          .hasAttribute("disabled"),
      ).toBe(false);
    });

    it("should add on the day chosen, at the time the field shows", async () => {
      await openAdd();
      fireEvent.click(screen.getByRole("button", { name: /^Date/ }));
      const picker = await screen.findByRole("dialog", { name: "Choose a date" });
      fireEvent.click(within(picker).getByRole("button", { name: /^15 October/ }));
      typeWeight("72.4");

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(weightBackend.addedRows).toHaveLength(1);
      });
      expect(nth(weightBackend.addedRows, 0)).toEqual(
        expect.objectContaining({
          local_date: "2026-10-15",
          measured_at: "2026-10-15T12:00:00.000Z",
        }),
      );
    });

    it("should not keep a time after now when one is chosen on today", async () => {
      await openAdd();
      fireEvent.click(screen.getByRole("button", { name: /^Time/ }));
      const picker = await screen.findByRole("dialog", { name: "Choose a time" });
      fireEvent.click(
        within(within(picker).getByRole("listbox", { name: "Hours" })).getByRole("option", {
          name: "23",
        }),
      );
      fireEvent.click(within(picker).getByRole("button", { name: "Done" }));

      expect(await screen.findByRole("button", { name: /^Time\s*12:00/ })).toBeTruthy();
    });
  });

  describe("offline", () => {
    it("should turn Save off and say it needs a connection, and send nothing", async () => {
      await openAdd({ goesOffline: true });
      typeWeight("72.4");

      expect(saveButton().hasAttribute("disabled")).toBe(true);
      expect(screen.getByRole("status").textContent).toBe(WEIGH_IN_SHEET.saveOffline);
      const form = weightField().closest("form");
      if (form !== null) {
        fireEvent.submit(form);
      }
      // Let a request that started show itself, as Saving.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      // A write made offline would wait with Save busy, so a submit that went through shows as Saving.
      expect(screen.queryByRole("button", { name: WEIGH_IN_SHEET.saving })).toBeNull();
      expect(weightBackend.addedRows).toEqual([]);
    });

    it("should turn Delete weigh-in off, so no row leaves the list and nothing is sent", async () => {
      await openRow("Thu 15 Oct", { goesOffline: true });

      const remove = screen.getByRole("button", { name: WEIGH_IN_SHEET.delete });
      expect(remove.hasAttribute("disabled")).toBe(true);
      fireEvent.click(remove);

      expect(weightBackend.deletedIds).toEqual([]);
      expect(within(await list()).getByRole("button", { name: /^Thu 15 Oct/ })).toBeTruthy();
      expect(screen.getByText(WEIGH_IN_SHEET.saveOffline)).toBeTruthy();
    });

    it("should still close on Cancel, and a weigh-in typed offline is never added when the connection returns", async () => {
      await openAdd({ goesOffline: true });
      typeWeight("72.4");
      fireEvent.click(screen.getByRole("button", { name: WEIGH_IN_SHEET.cancel }));

      await act(async () => {
        onlineManager.setOnline(true);
        await Promise.resolve();
      });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(weightBackend.addedRows).toEqual([]);
    });

    it("should say nothing about a connection when online", async () => {
      await openAdd();

      expect(screen.queryByText(WEIGH_IN_SHEET.saveOffline)).toBeNull();
    });
  });

  describe("a save that fails", () => {
    async function failToSave() {
      weightBackend.weighInWritesFail = true;
      await openAdd();
      typeWeight("72.4");
      fireEvent.change(noteField(), { target: { value: "Before breakfast" } });
      fireEvent.click(saveButton());
      return screen.findByRole("alert");
    }

    it("should say the fixed sentence, keep the dialog open and what was typed, and turn Save back on", async () => {
      const alert = await failToSave();

      expect(alert.textContent).toBe(WEIGH_IN_SHEET.saveError);
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(weightField()).toHaveProperty("value", "72.4");
      expect(noteField()).toHaveProperty("value", "Before breakfast");
      expect(saveButton().hasAttribute("disabled")).toBe(false);
      expect(document.body.textContent).not.toContain(LEAKY_DATABASE_MESSAGE);
    });

    it("should save once on a second press when the connection is back", async () => {
      await failToSave();
      weightBackend.weighInWritesFail = false;

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(weightBackend.addedRows).toHaveLength(1);
    });

    it("should write no weight or note to the console", async () => {
      const spies = [
        vi.spyOn(console, "error").mockImplementation(() => undefined),
        vi.spyOn(console, "warn").mockImplementation(() => undefined),
        vi.spyOn(console, "log").mockImplementation(() => undefined),
      ];

      await failToSave();

      const written = spies.flatMap((spy) => spy.mock.calls.flat().map(String)).join("\n");
      expect(written).not.toContain("72.4");
      expect(written).not.toContain("Before breakfast");
      expect(written).not.toContain(LEAKY_DATABASE_MESSAGE);
    });
  });

  describe("closing", () => {
    it("should close on Cancel, add nothing and return focus to the button that opened it", async () => {
      const opener = await openAdd();
      typeWeight("72.4");

      fireEvent.click(screen.getByRole("button", { name: WEIGH_IN_SHEET.cancel }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(weightBackend.addedRows).toEqual([]);
      expect(document.activeElement).toBe(opener);
    });

    it("should return focus to the empty state's own button, not the header's, when it opened the dialog", async () => {
      weightBackend.weighIns = [];
      renderWithWeight(<WeightScreen />);
      await screen.findByRole("heading", { name: WEIGHT_EMPTY.title });
      const emptyStateButton = nth(addButtons(), 1);
      emptyStateButton.focus();
      fireEvent.click(emptyStateButton);
      await dialog(WEIGH_IN_SHEET.titleAdd);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(emptyStateButton);
    });

    it("should close on Escape and return focus to the button that opened it", async () => {
      const opener = await openAdd();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(opener);
    });

    it("should close only the date picker on Escape while it is open", async () => {
      await openAdd();
      fireEvent.click(screen.getByRole("button", { name: /^Date/ }));
      const picker = await screen.findByRole("dialog", { name: "Choose a date" });

      fireEvent.keyDown(within(picker).getByRole("button", { name: /^17 October/ }), {
        key: "Escape",
      });

      expect(screen.queryByRole("dialog", { name: "Choose a date" })).toBeNull();
      expect(screen.getByRole("dialog", { name: WEIGH_IN_SHEET.titleAdd })).toBeTruthy();
    });
  });

  describe("pressing blank space in the date picker", () => {
    it("should leave focus where Escape closes only the picker, and keep what was typed", async () => {
      await openAdd();
      typeWeight("72.4");
      fireEvent.click(screen.getByRole("button", { name: /^Date/ }));
      const picker = await screen.findByRole("dialog", { name: "Choose a date" });

      // What a browser does for a press on blank space: focus goes to the nearest focusable ancestor.
      picker.closest<HTMLElement>("[tabindex]")?.focus();
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

      expect(screen.queryByRole("dialog", { name: "Choose a date" })).toBeNull();
      expect(screen.getByRole("dialog", { name: WEIGH_IN_SHEET.titleAdd })).toBeTruthy();
      expect(weightField()).toHaveProperty("value", "72.4");
    });
  });

  describe("the time", () => {
    it("should bring a later time on an earlier day back to now when today is chosen again", async () => {
      await openAdd();
      fireEvent.click(screen.getByRole("button", { name: /^Date/ }));
      let picker = await screen.findByRole("dialog", { name: "Choose a date" });
      fireEvent.click(within(picker).getByRole("button", { name: /^15 October/ }));
      fireEvent.click(screen.getByRole("button", { name: /^Time/ }));
      const timePicker = await screen.findByRole("dialog", { name: "Choose a time" });
      fireEvent.click(
        within(within(timePicker).getByRole("listbox", { name: "Hours" })).getByRole("option", {
          name: "23",
        }),
      );
      fireEvent.click(within(timePicker).getByRole("button", { name: "Done" }));
      expect(await screen.findByRole("button", { name: /^Time\s*23:00/ })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: /^Date/ }));
      picker = await screen.findByRole("dialog", { name: "Choose a date" });
      fireEvent.click(within(picker).getByRole("button", { name: /^17 October/ }));

      expect(await screen.findByRole("button", { name: /^Time\s*12:00/ })).toBeTruthy();
    });
  });

  describe("opening a manual weigh-in", () => {
    it("should open from its row with the fields filled and Delete weigh-in on offer", async () => {
      await openRow("Thu 15 Oct");

      expect(weightField()).toHaveProperty("value", "81.8");
      expect(noteField()).toHaveProperty("value", "Before work");
      expect(screen.getByRole("button", { name: /^Date\s*Thu 15 Oct/ })).toBeTruthy();
      expect(screen.getByRole("button", { name: /^Time\s*07:24/ })).toBeTruthy();
      expect(screen.getByRole("button", { name: WEIGH_IN_SHEET.delete })).toBeTruthy();
      expect(saveButton().hasAttribute("disabled")).toBe(false);
    });

    it("should change the weight to 72.6 alone, show it in the row, and return focus to the row", async () => {
      const row = await openRow("Thu 15 Oct");
      typeWeight("72.6");

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(weightBackend.updatedRows).toEqual([
        { id: nth(weightBackend.weighIns, 0)["id"], change: { weight_kg: 72.6 } },
      ]);
      expect(
        within(await list()).getByRole("button", { name: /^Thu 15 Oct/ }).textContent,
      ).toContain("72.6");
      expect(document.activeElement).toBe(row);
    });

    it("should keep the weigh-in's own zone, not the profile's, when the time is unmoved", async () => {
      weightBackend.weighIns = [
        { ...nth(earlierReadings(), 0), tz: "Europe/London" },
        ...earlierReadings().slice(1),
      ];
      await openRow("Thu 15 Oct");
      typeWeight("72.6");

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(weightBackend.updatedRows).toHaveLength(1);
      });
      expect(nth(weightBackend.updatedRows, 0).change).toEqual({ weight_kg: 72.6 });
      expect(nth(weightBackend.weighIns, 0)["tz"]).toBe("Europe/London");
    });

    it("should send the instant, the day and the zone together when the time changed", async () => {
      await openRow("Thu 15 Oct");
      fireEvent.click(screen.getByRole("button", { name: /^Time/ }));
      const picker = await screen.findByRole("dialog", { name: "Choose a time" });
      fireEvent.click(
        within(within(picker).getByRole("listbox", { name: "Hours" })).getByRole("option", {
          name: "09",
        }),
      );
      fireEvent.click(within(picker).getByRole("button", { name: "Done" }));

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(weightBackend.updatedRows).toHaveLength(1);
      });
      expect(nth(weightBackend.updatedRows, 0).change).toEqual({
        measured_at: "2026-10-15T09:24:00.000Z",
        local_date: "2026-10-15",
        tz: "UTC",
      });
    });

    it("should close with no request when nothing changed", async () => {
      await openRow("Thu 15 Oct");

      fireEvent.click(saveButton());

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(weightBackend.updatedRows).toEqual([]);
    });

    it("should delete with no confirmation, drop the row, close, and not lose focus", async () => {
      await openRow("Thu 15 Oct");

      fireEvent.click(screen.getByRole("button", { name: WEIGH_IN_SHEET.delete }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(weightBackend.deletedIds).toHaveLength(1);
      expect(within(await list()).queryByRole("button", { name: /^Thu 15 Oct/ })).toBeNull();
      expect(document.activeElement).toBe(nth(addButtons(), 0));
    });

    it("should say the generic sentence and stay open when a delete fails", async () => {
      weightBackend.weighInWritesFail = true;
      await openRow("Thu 15 Oct");

      fireEvent.click(screen.getByRole("button", { name: WEIGH_IN_SHEET.delete }));

      expect((await screen.findByRole("alert")).textContent).toBe(GENERIC_ERROR);
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(weightBackend.weighIns).toHaveLength(2);
    });
  });

  describe("opening an imported weigh-in", () => {
    beforeEach(() => {
      weightBackend.weighIns = [importedReading(), ...earlierReadings()];
    });

    it("should show the notice and the warning with every field read only and no Save", async () => {
      await openRow("Yesterday");

      expect(screen.getByRole("status").textContent).toBe(WEIGH_IN_SHEET.importedNotice);
      expect(screen.getByText(WEIGH_IN_SHEET.importedHelp)).toBeTruthy();
      expect(screen.getByText(WEIGH_IN_SHEET.deleteWarning)).toBeTruthy();
      expect(weightField()).toHaveProperty("disabled", true);
      expect(noteField()).toHaveProperty("disabled", true);
      // A button in a disabled group is disabled, though its own attribute is not set.
      expect(screen.getByRole("button", { name: /^Date/ }).matches(":disabled")).toBe(true);
      expect(screen.getByRole("button", { name: /^Time/ }).matches(":disabled")).toBe(true);
      expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    });

    it("should read the time in the zone it was taken in, not the profile's", async () => {
      await openRow("Yesterday");

      expect(screen.getByRole("button", { name: /^Time\s*08:17/ })).toBeTruthy();
    });

    it("should delete once, with no confirmation, and close", async () => {
      await openRow("Yesterday");

      fireEvent.click(screen.getByRole("button", { name: WEIGH_IN_SHEET.delete }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(weightBackend.deletedIds).toHaveLength(1);
      expect(weightBackend.updatedRows).toEqual([]);
    });
  });
});
