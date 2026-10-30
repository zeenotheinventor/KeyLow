import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Targets } from "@keylow/api-client";

import { TargetsForm } from "@/components/targets/TargetsForm";
import { ToastProvider } from "@/components/ui/Toast";

const { push, mutateAsync, updateTargets } = vi.hoisted(() => {
  const mutateAsync = vi.fn<(input: unknown) => Promise<unknown>>();
  return {
    push: vi.fn<(href: string) => void>(),
    mutateAsync,
    updateTargets: { mutateAsync, isPending: false },
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useUpdateTargets: () => updateTargets,
}));

const none: Targets = {
  kcal: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  source: "manual",
};
const filled: Targets = {
  kcal: 2200,
  protein_g: 160,
  carbs_g: 220,
  fat_g: 70,
  source: "manual",
};

const programme: Targets = {
  ...filled,
  source: "engine",
  dowCaloriesKcal: [2200, 2200, 2200, 2200, 2200, 2200, 2200],
};

function renderForm(initial: Targets = filled) {
  return render(
    <ToastProvider>
      <TargetsForm initial={initial} />
    </ToastProvider>,
  );
}

const calories = () => screen.getByRole("textbox", { name: /^Calories/ });
const protein = () => screen.getByRole("textbox", { name: "Protein target in grams" });
const carbs = () => screen.getByRole("textbox", { name: "Carbohydrate target in grams" });
const fat = () => screen.getByRole("textbox", { name: "Fat target in grams" });
const save = () => screen.getByRole("button", { name: "Save" });

function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
}

beforeEach(() => {
  vi.resetAllMocks();
  mutateAsync.mockResolvedValue(filled);
  updateTargets.isPending = false;
});

afterEach(() => {
  cleanup();
});

describe("TargetsForm", () => {
  describe("with nothing set", () => {
    it("should draw empty fields, offer the calorie range and disable Save", () => {
      renderForm(none);

      expect(calories()).toHaveProperty("value", "");
      expect(protein()).toHaveProperty("value", "");
      expect(screen.getByText("Between 800 and 6,000 kcal")).toBeTruthy();
      expect(screen.getByText("Macros are optional")).toBeTruthy();
      expect(save()).toHaveProperty("disabled", true);
    });

    it("should not call a blank calorie field an error until it has been touched", () => {
      renderForm(none);

      expect(screen.queryByRole("alert")).toBeNull();

      type(calories(), "2");
      type(calories(), "");

      expect(screen.getByRole("alert").textContent).toBe("Enter a calorie target.");
    });
  });

  describe("with targets set", () => {
    it("should fill the fields with them and say what the macros add up to", () => {
      renderForm();

      expect(calories()).toHaveProperty("value", "2200");
      expect(protein()).toHaveProperty("value", "160");
      expect(carbs()).toHaveProperty("value", "220");
      expect(fat()).toHaveProperty("value", "70");
      expect(screen.getByText("Macros add up to 2,150 kcal")).toBeTruthy();
      expect(save()).toHaveProperty("disabled", false);
    });

    it("should update the macro total as a macro changes", () => {
      renderForm();

      type(fat(), "80");

      expect(screen.getByText("Macros add up to 2,240 kcal")).toBeTruthy();
    });

    it("should go back to Macros are optional when every macro is cleared", () => {
      renderForm();

      type(protein(), "");
      type(carbs(), "");
      type(fat(), "");

      expect(screen.getByText("Macros are optional")).toBeTruthy();
    });
  });

  describe("a calorie target that is not allowed", () => {
    it.each([
      ["7500", "Enter a target between 800 and 6,000 kcal."],
      ["799", "Enter a target between 800 and 6,000 kcal."],
      ["2200.5", "Enter whole calories."],
    ])("should say what is wrong with %s and disable Save", (value, message) => {
      renderForm();

      type(calories(), value);

      expect(screen.getByRole("alert").textContent).toBe(message);
      expect(calories().getAttribute("aria-invalid")).toBe("true");
      expect(save()).toHaveProperty("disabled", true);
    });

    it("should take the error away when the number is allowed again", () => {
      renderForm();
      type(calories(), "7500");

      type(calories(), "2100");

      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByText("Between 800 and 6,000 kcal")).toBeTruthy();
    });

    it("should read a comma as a decimal point", () => {
      renderForm();

      type(calories(), "2200,5");

      expect(screen.getByRole("alert").textContent).toBe("Enter whole calories.");
    });
  });

  describe("a thousands separator", () => {
    it("should refuse 1,200 calories, which is not 1.2, and write nothing", () => {
      renderForm();

      type(calories(), "1,200");
      fireEvent.submit(calories());

      expect(save()).toHaveProperty("disabled", true);
      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it("should refuse 1,200 in a macro, and write nothing", () => {
      renderForm();

      type(protein(), "1,200");
      fireEvent.submit(calories());

      expect(save()).toHaveProperty("disabled", true);
      expect(mutateAsync).not.toHaveBeenCalled();
    });
  });

  describe("a macro that is not a number", () => {
    it("should never write NaN in the macro sum", () => {
      renderForm();

      type(protein(), "1,200");

      expect(screen.queryByText(/NaN/)).toBeNull();
      expect(screen.getByText("Macros add up to 1,510 kcal")).toBeTruthy();
    });
  });

  describe("saving", () => {
    it("should save the numbers, say so in a toast and go back to More", async () => {
      renderForm();
      type(calories(), "2000");

      fireEvent.click(save());

      await waitFor(() => {
        expect(push).toHaveBeenCalledExactlyOnceWith("/more");
      });
      expect(mutateAsync).toHaveBeenCalledExactlyOnceWith({
        kcal: 2000,
        protein_g: 160,
        carbs_g: 220,
        fat_g: 70,
      });
      expect(screen.getByText("Targets saved")).toBeTruthy();
    });

    it("should save a blank macro as no target", async () => {
      renderForm();
      type(protein(), "");

      fireEvent.click(save());

      await waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledOnce();
      });
      expect(mutateAsync.mock.calls[0]?.[0]).toEqual({
        kcal: 2200,
        protein_g: null,
        carbs_g: 220,
        fat_g: 70,
      });
    });

    it("should save from the Enter key in a field too", async () => {
      renderForm();

      fireEvent.submit(calories());

      await waitFor(() => {
        expect(mutateAsync).toHaveBeenCalledOnce();
      });
    });

    it("should save nothing when the targets are not allowed", () => {
      renderForm();
      type(calories(), "100");

      fireEvent.submit(calories());

      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it("should stay on the page and say so when the save fails", async () => {
      mutateAsync.mockRejectedValue(new Error("Could not save your targets (42501)"));
      renderForm();

      fireEvent.click(save());

      const alert = (await screen.findByRole("alert")).textContent;
      expect(alert).toContain("Not saved. Check your connection and try again.");
      // The reason and the person's numbers stay out of what the page says.
      expect(alert).not.toContain("42501");
      expect(alert).not.toMatch(/2,?200/);
      expect(push).not.toHaveBeenCalled();
      expect(screen.queryByText("Targets saved")).toBeNull();
    });

    it("should hold Save while the request is on its way", () => {
      updateTargets.isPending = true;
      renderForm();

      expect(screen.getByRole("button", { name: "Saving" })).toHaveProperty("disabled", true);
    });
  });

  describe("while a programme sets the targets", () => {
    const dialog = () => screen.getByRole("dialog", { name: "Turn off weekly check-ins?" });

    it("should say that saving ends the programme, in place of the usual note", () => {
      renderForm(programme);

      expect(
        screen.getByText("Saving your own targets ends your programme and its weekly check-in."),
      ).toBeTruthy();
      expect(screen.queryByText(/You set these yourself for now/)).toBeNull();
    });

    it("should ask before saving, and save nothing yet", () => {
      renderForm(programme);

      fireEvent.click(save());

      expect(dialog()).toBeTruthy();
      expect(screen.getByRole("button", { name: "Save my targets" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Keep my programme" })).toBeTruthy();
      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it("should ask from the Enter key in a field too", () => {
      renderForm(programme);

      fireEvent.submit(calories());

      expect(dialog()).toBeTruthy();
      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it("should keep the programme and save nothing when asked to keep it", () => {
      renderForm(programme);
      fireEvent.click(save());

      fireEvent.click(screen.getByRole("button", { name: "Keep my programme" }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mutateAsync).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });

    it("should save once, say so in a toast and go back to More when confirmed", async () => {
      renderForm(programme);
      type(calories(), "2000");
      fireEvent.click(save());

      fireEvent.click(screen.getByRole("button", { name: "Save my targets" }));

      await waitFor(() => {
        expect(push).toHaveBeenCalledExactlyOnceWith("/more");
      });
      expect(mutateAsync).toHaveBeenCalledExactlyOnceWith({
        kcal: 2000,
        protein_g: 160,
        carbs_g: 220,
        fat_g: 70,
      });
      expect(screen.getByText("Targets saved")).toBeTruthy();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should close the dialog and show the form's error when the save fails", async () => {
      mutateAsync.mockRejectedValue(new Error("Could not save your targets (42501)"));
      renderForm(programme);
      fireEvent.click(save());

      fireEvent.click(screen.getByRole("button", { name: "Save my targets" }));

      expect((await screen.findByRole("alert")).textContent).toContain("Not saved.");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(push).not.toHaveBeenCalled();
    });

    it("should hold the dialog open, with Save busy, while the save is on its way", () => {
      const { rerender } = renderForm(programme);
      fireEvent.click(save());

      updateTargets.isPending = true;
      rerender(
        <ToastProvider>
          <TargetsForm initial={programme} />
        </ToastProvider>,
      );
      fireEvent.keyDown(document, { key: "Escape" });

      expect(within(dialog()).getByRole("button", { name: "Saving" })).toHaveProperty(
        "disabled",
        true,
      );
      expect(dialog()).toBeTruthy();
    });

    it("should not open the dialog for a field with an error", () => {
      renderForm(programme);
      type(calories(), "100");

      fireEvent.submit(calories());

      expect(screen.getByRole("alert").textContent).toBe(
        "Enter a target between 800 and 6,000 kcal.",
      );
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("should never ask when no programme sets the targets", () => {
    renderForm();

    fireEvent.click(save());

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("should leave through a Cancel link to More", () => {
    renderForm();

    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/more");
  });

  it("should explain that the targets are the person's own for now", () => {
    renderForm();

    expect(
      screen.getByText(
        "You set these yourself for now. Later, Ki-Lo will suggest targets from your weight trend.",
      ),
    ).toBeTruthy();
  });
});
