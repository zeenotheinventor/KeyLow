import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { quickEntry } from "./support";

import type { AddFoodRequest } from "@/lib/foodLogActions";
import type { LogEntry, LogQuickEntryInput } from "@keylow/api-client";

import { QuickAddDialog } from "@/components/diary/QuickAddDialog";
import { ToastProvider } from "@/components/ui/Toast";

type Api = {
  timeZone: string;
  quickAdd: {
    mutateAsync: ReturnType<typeof vi.fn<(input: LogQuickEntryInput) => Promise<LogEntry>>>;
  };
};

const api = vi.hoisted((): Api => ({
  timeZone: "UTC",
  quickAdd: { mutateAsync: undefined as never },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: api.timeZone }),
  useQuickAdd: () => api.quickAdd,
}));

// 12:40 on Thursday 15 October 2026 in UTC, so "now" is 12:40.
const NOW = new Date("2026-10-15T12:40:30Z");

function renderDialog(request: AddFoodRequest = { date: "2026-10-15" }) {
  const onClose = vi.fn<() => void>();
  render(
    <ToastProvider>
      <QuickAddDialog request={request} opener={null} onClose={onClose} />
    </ToastProvider>,
  );

  return { onClose };
}

const calories = () => screen.getByRole("textbox", { name: /^Calories/ });
const protein = () => screen.getByRole("textbox", { name: /^Protein/ });
const carbs = () => screen.getByRole("textbox", { name: /^Carbohydrate/ });
const fat = () => screen.getByRole("textbox", { name: /^Fat/ });
const label = () => screen.getByRole("textbox", { name: /^Label/ });
const add = () => screen.getByRole("button", { name: "Add" });

function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  api.timeZone = "UTC";
  api.quickAdd.mutateAsync = vi.fn(() =>
    Promise.resolve(quickEntry({ date: "2026-10-15", time: "12:00", label: "x", kcal: 1 })),
  );
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe("the quick add dialog", () => {
  describe("the form", () => {
    it("should be a dialog titled Quick add", () => {
      renderDialog();

      expect(screen.getByRole("dialog", { name: "Quick add" })).toBeTruthy();
    });

    it("should have Calories, then Protein, Carbohydrate and Fat in that order, then Label", () => {
      renderDialog();

      expect(
        within(screen.getByRole("dialog", { name: "Quick add" }))
          .getAllByRole("textbox")
          .map((field) => field.getAttribute("id")),
      ).toEqual([calories().id, protein().id, carbs().id, fat().id, label().id]);
    });

    it("should have no meal anywhere", () => {
      renderDialog();

      expect(screen.queryByText(/breakfast|lunch|dinner|snack/i)).toBeNull();
    });

    it("should have a Time field that reads now from the top bar, with Now under it", () => {
      renderDialog();

      expect(screen.getByRole("button", { name: "Time 12:40" })).toBeTruthy();
      expect(screen.getByText("Now")).toBeTruthy();
    });

    it("should read the hour an hour's plus asked for, with no Now", () => {
      renderDialog({ date: "2026-10-15", time: "12:00" });

      expect(screen.getByRole("button", { name: "Time 12:00" })).toBeTruthy();
      expect(screen.queryByText("Now")).toBeNull();
    });

    it("should have the focus inside the dialog when it opens", () => {
      renderDialog();

      expect(
        screen.getByRole("dialog", { name: "Quick add" }).contains(document.activeElement),
      ).toBe(true);
    });
  });

  describe("focus and Enter", () => {
    it("should put the cursor in Calories", () => {
      renderDialog();

      expect(document.activeElement).toBe(calories());
    });

    it("should add when the form is submitted with Enter and the calories are valid", async () => {
      renderDialog();
      type(calories(), "130");

      fireEvent.submit(calories());

      await waitFor(() => {
        expect(api.quickAdd.mutateAsync).toHaveBeenCalledOnce();
      });
    });

    it("should not add on Enter while the calories are not above 0", () => {
      renderDialog();

      fireEvent.submit(calories());

      expect(api.quickAdd.mutateAsync).not.toHaveBeenCalled();
    });

    it("should not add when the time picker's Done is pressed", () => {
      renderDialog();
      type(calories(), "130");
      fireEvent.click(screen.getByRole("button", { name: "Time 12:40" }));

      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      expect(api.quickAdd.mutateAsync).not.toHaveBeenCalled();
    });
  });

  describe("the line under Calories", () => {
    it("should say the macros are optional until one is given", () => {
      renderDialog();

      expect(screen.getByText("Macros are optional")).toBeTruthy();
    });

    it("should say what the macros add up to once one is given", () => {
      renderDialog();

      type(protein(), "2");
      type(carbs(), "15");
      type(fat(), "7");

      expect(screen.getByText("Macros add up to 131 kcal")).toBeTruthy();
    });

    it("should describe the Calories field by that line", () => {
      renderDialog();
      type(protein(), "2");

      expect(calories().getAttribute("aria-describedby")).toBe(
        screen.getByText("Macros add up to 8 kcal").id,
      );
    });

    describe("the 25 % rule", () => {
      const line = (text: string) => screen.getByText(text);
      const isWarning = (text: string) => line(text).className.includes("text-warning-ink");

      it("should stay plain at exactly 25 % above the calories", () => {
        renderDialog();
        type(calories(), "130");

        // 40.5 g of protein is 162 kcal: 32 kcal over, which is under a quarter of 130.
        type(protein(), "40.5");

        expect(isWarning("Macros add up to 162 kcal")).toBe(false);
      });

      it("should turn to the review colour just over 25 % above", () => {
        renderDialog();
        type(calories(), "130");

        // 40.75 g of protein is 163 kcal: 33 kcal over, which is more than a quarter of 130.
        type(protein(), "40.75");

        expect(isWarning("Macros add up to 163 kcal")).toBe(true);
      });

      it("should stay plain at 25 % below the calories and warn just under that", () => {
        renderDialog();
        type(calories(), "130");

        type(protein(), "24.5");
        expect(isWarning("Macros add up to 98 kcal")).toBe(false);

        type(protein(), "24.25");
        expect(isWarning("Macros add up to 97 kcal")).toBe(true);
      });

      it("should be information only: Add is still allowed", () => {
        renderDialog();
        type(calories(), "130");
        type(protein(), "60");

        expect(isWarning("Macros add up to 240 kcal")).toBe(true);
        expect(add()).toHaveProperty("disabled", false);
      });

      it("should not warn with no macros, whatever the calories", () => {
        renderDialog();
        type(calories(), "9000");

        expect(screen.getByText("Macros are optional").className).not.toContain("text-warning-ink");
      });
    });
  });

  describe("the fields", () => {
    it("should keep digits and one point or comma, and refuse anything else", () => {
      renderDialog();

      type(calories(), "130");
      type(calories(), "13a0");
      type(calories(), "-130");
      type(protein(), "1.5");
      type(protein(), "1.5.2");
      type(fat(), "2,5");

      expect(calories()).toHaveProperty("value", "130");
      expect(protein()).toHaveProperty("value", "1.5");
      expect(fat()).toHaveProperty("value", "2,5");
    });

    it("should not allow Add until the calories are above 0", () => {
      renderDialog();

      expect(add()).toHaveProperty("disabled", true);

      type(calories(), "0");

      expect(add()).toHaveProperty("disabled", true);

      type(calories(), "130");

      expect(add()).toHaveProperty("disabled", false);
    });

    it("should say Enter calories on the field once it has been left empty", () => {
      renderDialog();

      fireEvent.blur(calories());

      expect(screen.getByText("Enter calories.")).toBeTruthy();
      expect(calories().getAttribute("aria-invalid")).toBe("true");
    });

    it("should say nothing before the person has touched the field", () => {
      renderDialog();

      expect(screen.queryByText("Enter calories.")).toBeNull();
    });
  });

  describe("adding", () => {
    function fillCrisps() {
      type(calories(), "130");
      type(protein(), "2");
      type(carbs(), "15");
      type(fat(), "7");
      type(label(), "  Meal deal crisps ");
    }

    it("should log the quick add at the hour an hour's plus asked for", async () => {
      renderDialog({ date: "2026-10-15", time: "12:00" });
      fillCrisps();

      fireEvent.click(add());

      await waitFor(() => {
        expect(api.quickAdd.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.quickAdd.mutateAsync).toHaveBeenCalledWith({
        kcal: 130,
        protein_g: 2,
        carbs_g: 15,
        fat_g: 7,
        label: "Meal deal crisps",
        loggedAt: "2026-10-15T12:00:00.000Z",
        localDate: "2026-10-15",
      });
    });

    it("should log at now when the dialog was opened from the top bar", async () => {
      renderDialog();
      type(calories(), "130");

      fireEvent.click(add());

      await waitFor(() => {
        expect(api.quickAdd.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.quickAdd.mutateAsync).toHaveBeenCalledWith({
        kcal: 130,
        loggedAt: "2026-10-15T12:40:30.000Z",
        localDate: "2026-10-15",
      });
    });

    it("should leave out a macro and a label that were not given", async () => {
      renderDialog();
      type(calories(), "95");
      type(protein(), "0");

      fireEvent.click(add());

      await waitFor(() => {
        expect(api.quickAdd.mutateAsync).toHaveBeenCalledOnce();
      });
      const input = api.quickAdd.mutateAsync.mock.calls[0]?.[0];
      expect(input).toMatchObject({ kcal: 95, protein_g: 0 });
      expect(input).not.toHaveProperty("carbs_g");
      expect(input).not.toHaveProperty("fat_g");
      expect(input).not.toHaveProperty("label");
    });

    it("should log at the time chosen in the Time field", async () => {
      renderDialog();
      type(calories(), "130");
      fireEvent.click(screen.getByRole("button", { name: "Time 12:40" }));
      fireEvent.click(
        within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "07" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      fireEvent.click(add());

      await waitFor(() => {
        expect(api.quickAdd.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.quickAdd.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ loggedAt: "2026-10-15T07:40:00.000Z" }),
      );
    });

    it("should log on the day on view, at the current clock time, for a past day", async () => {
      renderDialog({ date: "2026-10-14" });
      type(calories(), "130");

      fireEvent.click(add());

      await waitFor(() => {
        expect(api.quickAdd.mutateAsync).toHaveBeenCalledOnce();
      });
      expect(api.quickAdd.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ loggedAt: "2026-10-14T12:40:00.000Z", localDate: "2026-10-14" }),
      );
    });

    it("should say Added and close the dialog when it is saved", async () => {
      const { onClose } = renderDialog();
      type(calories(), "130");

      fireEvent.click(add());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(await screen.findByText("Added")).toBeTruthy();
    });

    it("should stay open with a banner, keeping the values, when it is not saved", async () => {
      api.quickAdd.mutateAsync = vi.fn(() => Promise.reject(new Error("RAW 130 kcal failure")));
      const { onClose } = renderDialog();
      type(calories(), "130");

      fireEvent.click(add());

      expect(
        await screen.findByText("Not saved. Check your connection and try again."),
      ).toBeTruthy();
      expect(screen.queryByText(/RAW/)).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
      expect(calories()).toHaveProperty("value", "130");
    });

    it("should close on Cancel and Escape without logging", () => {
      const { onClose } = renderDialog();
      type(calories(), "130");

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(2);
      expect(api.quickAdd.mutateAsync).not.toHaveBeenCalled();
    });
  });

  describe("offline", () => {
    const setOnline = (isOnline: boolean) => {
      act(() => {
        onlineManager.setOnline(isOnline);
      });
    };

    it("should disable Add, and add nothing, even when the form is submitted", () => {
      renderDialog();
      type(calories(), "130");

      setOnline(false);
      fireEvent.click(add());
      fireEvent.submit(calories());

      expect(add()).toHaveProperty("disabled", true);
      expect(api.quickAdd.mutateAsync).not.toHaveBeenCalled();
    });

    it("should keep what was typed when the connection drops and when it returns", () => {
      renderDialog();
      type(calories(), "130");
      type(protein(), "12");
      type(label(), "Crisps");

      setOnline(false);
      expect(calories()).toHaveProperty("value", "130");
      expect(protein()).toHaveProperty("value", "12");
      expect(label()).toHaveProperty("value", "Crisps");

      setOnline(true);
      expect(calories()).toHaveProperty("value", "130");
      expect(protein()).toHaveProperty("value", "12");
      expect(label()).toHaveProperty("value", "Crisps");
    });

    it("should add what was typed once the connection returns", async () => {
      const { onClose } = renderDialog();
      type(calories(), "130");
      setOnline(false);
      setOnline(true);

      fireEvent.click(add());

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(api.quickAdd.mutateAsync.mock.calls[0]?.[0].kcal).toBe(130);
    });

    it("should leave Cancel alone", () => {
      const { onClose } = renderDialog();
      setOnline(false);

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
