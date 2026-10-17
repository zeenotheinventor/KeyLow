import { RECIPE_EDITOR, RECIPE_PROBLEMS, RECIPE_TOASTS } from "@keylow/core/copy";
import { MAX_RECIPE_STEPS, MAX_RECIPE_STEP_LENGTH } from "@keylow/core/recipes";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEditorExisting } from "@/components/recipes";

import { RecipeEditor } from "@/components/recipes";
import { ToastProvider } from "@/components/ui/Toast";

// The Instructions card of the recipe editor: the steps and their four buttons, an inline field that edits
// or adds one, moving a step with focus kept on it, and a removal with an Undo. The steps are the editor's
// draft until Save. Chicken and rice is the brief's recipe, and its step 3 is the 201 character one the
// boards draw.

const { createRecipe, updateRecipe } = vi.hoisted(() => ({
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useCreateRecipe: () => ({ mutateAsync: createRecipe }),
  useUpdateRecipe: () => ({ mutateAsync: updateRecipe }),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const RECIPE_ID = "55555555-5555-4555-8555-555555555555";
const golden = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });

const steps = [
  "Rinse the rice, then cook it in salted water for 12 minutes and drain.",
  "Cut the chicken into 2 cm pieces.",
  "Heat the oil in a large pan and fry the chicken over a medium-high heat for 6 to 8 minutes, turning it now and then, until it is golden on every side and cooked through with no pink left in the middle.",
  "Stir in the rice and heat it through for 2 minutes.",
  "Divide between 4 plates.",
];

function recipeWith(instructions: readonly string[]): RecipeEditorExisting {
  return {
    id: RECIPE_ID,
    name: "Chicken and rice",
    servings: golden.servings,
    yield_grams: golden.yieldGrams,
    instructions: [...instructions],
    ingredients: golden.ingredients,
  };
}

function showEditor(instructions: readonly string[] = steps) {
  render(
    <ToastProvider>
      <RecipeEditor existing={recipeWith(instructions)} />
    </ToastProvider>,
  );
}

const stepList = () => within(screen.getByRole("list", { name: RECIPE_EDITOR.instructions }));
const stepTexts = () =>
  stepList()
    .getAllByRole("listitem")
    .map((item) => item.textContent.replace(/^\d+/, "").replace(/Move step.*$/, ""));
const button = (name: string) => screen.getByRole<HTMLButtonElement>("button", { name });
// The page has a Cancel of its own, so the step field's is found inside the card.
const instructionsCard = () => screen.getByRole("region", { name: /^Instructions/ });
const cardButton = (name: string) => within(instructionsCard()).getByRole("button", { name });
const pageCancelButton = () => {
  const found = screen
    .getAllByRole("button", { name: "Cancel" })
    .find((candidate) => !instructionsCard().contains(candidate));
  if (found === undefined) {
    throw new Error("The page's Cancel is missing");
  }
  return found;
};
const openField = () => screen.queryByRole("textbox", { name: /^Step \d+ text$/ });
const textArea = (number: number) =>
  screen.getByRole<HTMLTextAreaElement>("textbox", { name: `Step ${number} text` });
const typeInto = (field: HTMLElement, text: string) => {
  fireEvent.change(field, { target: { value: text } });
};
const isAnnounced = (message: string) =>
  screen.getAllByRole("status").some((region) => region.textContent === message);
const toastShows = (message: string) => screen.queryByText(message) !== null;

function fillTo(count: number): string[] {
  return Array.from({ length: count }, (_, place) => `Step number ${place + 1}.`);
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  onlineManager.setOnline(true);
});

describe("the Instructions card", () => {
  it("should name the card Instructions with the count of its steps", () => {
    showEditor();

    expect(screen.getByRole("heading", { name: /^Instructions/ }).textContent).toBe(
      "Instructions · 5",
    );
  });

  it("should list the five steps in order, each in full", () => {
    showEditor();

    expect(stepTexts()).toEqual(steps);
  });

  it("should give every step Move up, Move down, Edit and Remove, named for its place", () => {
    showEditor();

    const [, , third] = stepList().getAllByRole("listitem");
    const names = within(third ?? document.body)
      .getAllByRole("button")
      .map((control) => control.getAttribute("aria-label"));

    expect(names).toEqual(["Move step 3 up", "Move step 3 down", "Edit step 3", "Remove step 3"]);
  });

  it("should switch off Move up on the first step and Move down on the last, and no other", () => {
    showEditor();

    expect(button("Move step 1 up").disabled).toBe(true);
    expect(button("Move step 5 down").disabled).toBe(true);
    expect(button("Move step 1 down").disabled).toBe(false);
    expect(button("Move step 5 up").disabled).toBe(false);
    expect(button("Move step 3 up").disabled).toBe(false);
    expect(button("Move step 3 down").disabled).toBe(false);
  });

  describe("with no steps", () => {
    it("should say there are none, show no count and offer Add step", () => {
      showEditor([]);

      expect(screen.getByRole("heading", { name: /^Instructions/ }).textContent).toBe(
        "Instructions",
      );
      expect(screen.getByText(RECIPE_EDITOR.instructionsEmpty)).toBeTruthy();
      expect(screen.queryByRole("list", { name: RECIPE_EDITOR.instructions })).toBeNull();
      expect(button("Add step").disabled).toBe(false);
    });
  });
});

describe("moving a step", () => {
  it("should change the order and the numbers at once", () => {
    showEditor();

    fireEvent.click(button("Move step 2 up"));

    expect(stepTexts().slice(0, 3)).toEqual([steps[1], steps[0], steps[2]]);
    expect(button("Move step 2 up").disabled).toBe(false);
    expect(button("Move step 1 up").disabled).toBe(true);
  });

  it("should move a step down", () => {
    showEditor();

    fireEvent.click(button("Move step 1 down"));

    expect(stepTexts().slice(0, 2)).toEqual([steps[1], steps[0]]);
  });

  it("should announce where the step is now", () => {
    showEditor();

    fireEvent.click(button("Move step 2 up"));

    expect(isAnnounced("Step moved to 1 of 5")).toBe(true);
  });

  it("should announce a second move that lands on the same words", () => {
    showEditor();
    fireEvent.click(button("Move step 2 up"));
    const firstAnnouncement = screen.getByText("Step moved to 1 of 5");

    fireEvent.click(button("Move step 2 up"));

    expect(screen.getByText("Step moved to 1 of 5")).not.toBe(firstAnnouncement);
  });

  it("should keep focus on the moved step's Move down button when it reaches the top", () => {
    showEditor();

    fireEvent.click(button("Move step 2 up"));

    expect(document.activeElement).toBe(button("Move step 1 down"));
  });

  it("should keep focus on the moved step's Move up button while it can still go up", () => {
    showEditor();

    fireEvent.click(button("Move step 4 up"));

    expect(document.activeElement).toBe(button("Move step 3 up"));
  });

  it("should keep focus on the moved step's Move down button while it can still go down", () => {
    showEditor();

    fireEvent.click(button("Move step 2 down"));

    expect(document.activeElement).toBe(button("Move step 3 down"));
  });

  it("should keep focus on the Move up button when the step reaches the bottom", () => {
    showEditor();

    fireEvent.click(button("Move step 4 down"));

    expect(document.activeElement).toBe(button("Move step 5 up"));
    expect(button("Move step 5 down").disabled).toBe(true);
  });

  it("should tint the moved row for a moment", () => {
    vi.useFakeTimers();
    showEditor();

    fireEvent.click(button("Move step 2 up"));
    const [moved, other] = stepList().getAllByRole("listitem");
    expect(moved?.classList.contains("bg-accent-muted")).toBe(true);
    expect(other?.classList.contains("bg-accent-muted")).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(moved?.classList.contains("bg-accent-muted")).toBe(false);
  });

  it("should count the step that an open new step adds first, when it announces the move", () => {
    showEditor();
    fireEvent.click(button("Add step"));
    typeInto(textArea(6), "Serve at once.");

    fireEvent.click(button("Move step 4 up"));

    expect(isAnnounced("Step moved to 3 of 6")).toBe(true);
    expect(stepTexts()).toEqual([
      steps[0],
      steps[1],
      steps[3],
      steps[2],
      steps[4],
      "Serve at once.",
    ]);
    expect(document.activeElement).toBe(button("Move step 3 up"));
  });

  it("should do nothing when the first step is asked to go up", () => {
    showEditor();

    fireEvent.click(button("Move step 1 up"));

    expect(stepTexts()).toEqual(steps);
    expect(screen.queryByText(/^Step moved/)).toBeNull();
  });
});

describe("editing a step", () => {
  it("should turn the row into a field named for the step, holding its text, with the count", () => {
    showEditor();

    fireEvent.click(button("Edit step 3"));

    expect(textArea(3).value).toBe(steps[2]);
    expect(screen.getByText("201 / 1,000")).toBeTruthy();
    expect(button("Done")).toBeTruthy();
    expect(cardButton("Cancel")).toBeTruthy();
  });

  it("should put the cursor in the field, after the text", () => {
    showEditor();

    fireEvent.click(button("Edit step 3"));

    expect(document.activeElement).toBe(textArea(3));
    expect(textArea(3).selectionStart).toBe(steps[2]?.length);
  });

  it("should take the step's own buttons away while it is open", () => {
    showEditor();

    fireEvent.click(button("Edit step 3"));

    expect(screen.queryByRole("button", { name: "Move step 3 up" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit step 3" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove step 3" })).toBeNull();
  });

  it("should change the step and give focus back to its Edit button when Done is pressed", () => {
    showEditor();
    fireEvent.click(button("Edit step 3"));

    typeInto(textArea(3), "  Fry the chicken until golden.  ");
    fireEvent.click(button("Done"));

    expect(stepTexts()[2]).toBe("Fry the chicken until golden.");
    expect(openField()).toBeNull();
    expect(document.activeElement).toBe(button("Edit step 3"));
  });

  it("should leave the step as it was when Cancel is pressed", () => {
    showEditor();
    fireEvent.click(button("Edit step 3"));

    typeInto(textArea(3), "Something else entirely.");
    fireEvent.click(cardButton("Cancel"));

    expect(stepTexts()).toEqual(steps);
    expect(document.activeElement).toBe(button("Edit step 3"));
  });

  it("should leave the step as it was when Done is pressed over a blank field", () => {
    showEditor();
    fireEvent.click(button("Edit step 3"));

    typeInto(textArea(3), "   ");
    fireEvent.click(button("Done"));

    expect(stepTexts()).toEqual(steps);
  });

  it("should count what has been typed", () => {
    showEditor();
    fireEvent.click(button("Edit step 2"));

    typeInto(textArea(2), "Cut it.");

    expect(screen.getByText("7 / 1,000")).toBeTruthy();
  });

  describe("past the most a step holds", () => {
    const tooLong = "a".repeat(MAX_RECIPE_STEP_LENGTH + 1);

    it("should show the count, say why and switch Done off", () => {
      showEditor();
      fireEvent.click(button("Edit step 3"));

      typeInto(textArea(3), tooLong);

      expect(screen.getByText("1,001 / 1,000").classList.contains("text-danger")).toBe(true);
      expect(screen.getByRole("alert").textContent).toBe(RECIPE_PROBLEMS.stepTooLong);
      expect(screen.getByRole("alert").textContent).toBe(
        "Keep a step to 1,000 characters or fewer.",
      );
      expect(button("Done").disabled).toBe(true);
    });

    it("should accept exactly the most a step holds", () => {
      showEditor();
      fireEvent.click(button("Edit step 3"));

      typeInto(textArea(3), "a".repeat(MAX_RECIPE_STEP_LENGTH));

      expect(screen.queryByRole("alert")).toBeNull();
      expect(button("Done").disabled).toBe(false);
    });

    it("should switch Done back on once the text is short enough", () => {
      showEditor();
      fireEvent.click(button("Edit step 3"));
      typeInto(textArea(3), tooLong);

      typeInto(textArea(3), "Short enough.");

      expect(screen.queryByRole("alert")).toBeNull();
      expect(button("Done").disabled).toBe(false);
    });

    it("should still let Cancel close it", () => {
      showEditor();
      fireEvent.click(button("Edit step 3"));
      typeInto(textArea(3), tooLong);

      fireEvent.click(cardButton("Cancel"));

      expect(openField()).toBeNull();
      expect(stepTexts()).toEqual(steps);
    });
  });

  describe("with another control pressed while it is open", () => {
    it("should keep what was typed, as Done would, before it opens another step", () => {
      showEditor();
      fireEvent.click(button("Edit step 3"));
      typeInto(textArea(3), "Fry the chicken.");

      fireEvent.click(button("Edit step 1"));

      expect(textArea(1).value).toBe(steps[0]);
      expect(screen.queryByRole("textbox", { name: "Step 3 text" })).toBeNull();
      expect(stepTexts()[2]).toBe("Fry the chicken.");
    });

    it("should keep what was typed before it moves another step", () => {
      showEditor();
      fireEvent.click(button("Edit step 1"));
      typeInto(textArea(1), "Cook the rice.");

      fireEvent.click(button("Move step 4 up"));

      expect(stepTexts()).toEqual(["Cook the rice.", steps[1], steps[3], steps[2], steps[4]]);
    });

    it("should keep what was typed before it removes another step", () => {
      showEditor();
      fireEvent.click(button("Edit step 1"));
      typeInto(textArea(1), "Cook the rice.");

      fireEvent.click(button("Remove step 5"));

      expect(stepTexts()).toEqual(["Cook the rice.", steps[1], steps[2], steps[3]]);
    });

    it("should keep what was typed in its own place when a step is moved past it", () => {
      showEditor();
      fireEvent.click(button("Edit step 3"));
      typeInto(textArea(3), "Fry it.");

      fireEvent.click(button("Move step 4 up"));

      expect(stepTexts()).toEqual([steps[0], steps[1], steps[3], "Fry it.", steps[4]]);
    });

    it("should keep what was typed in its own place when a step before it is removed, and Undo it into place", () => {
      showEditor();
      fireEvent.click(button("Edit step 3"));
      typeInto(textArea(3), "Fry it.");

      fireEvent.click(button("Remove step 1"));
      expect(stepTexts()).toEqual([steps[1], "Fry it.", steps[3], steps[4]]);

      fireEvent.click(button("Undo"));
      expect(stepTexts()).toEqual([steps[0], steps[1], "Fry it.", steps[3], steps[4]]);
    });

    it("should not open another step, and bring the cursor back, while the text is too long to keep", () => {
      showEditor();
      fireEvent.click(button("Edit step 3"));
      typeInto(textArea(3), "a".repeat(MAX_RECIPE_STEP_LENGTH + 1));
      button("Edit step 1").focus();

      fireEvent.click(button("Edit step 1"));

      expect(textArea(3).value).toHaveLength(MAX_RECIPE_STEP_LENGTH + 1);
      expect(screen.queryByRole("textbox", { name: "Step 1 text" })).toBeNull();
      expect(document.activeElement).toBe(textArea(3));
    });

    it("should not move a step while the text is too long to keep", () => {
      showEditor();
      fireEvent.click(button("Edit step 3"));
      typeInto(textArea(3), "a".repeat(MAX_RECIPE_STEP_LENGTH + 1));

      fireEvent.click(button("Move step 5 up"));

      expect(isAnnounced("Step moved to 4 of 5")).toBe(false);
      expect(document.activeElement).toBe(textArea(3));
    });

    it("should open Add step with the open step kept", () => {
      showEditor();
      fireEvent.click(button("Edit step 2"));
      typeInto(textArea(2), "Dice the chicken.");

      fireEvent.click(button("Add step"));

      expect(textArea(6).value).toBe("");
      expect(stepTexts()[1]).toBe("Dice the chicken.");
    });
  });
});

describe("adding a step", () => {
  it("should open an empty field at the end, named for the next place, with its prompt", () => {
    showEditor();

    fireEvent.click(button("Add step"));

    expect(textArea(6).value).toBe("");
    expect(screen.getByPlaceholderText("Describe this step")).toBeTruthy();
    expect(screen.getByText("0 / 1,000")).toBeTruthy();
    expect(document.activeElement).toBe(textArea(6));
  });

  it("should offer Add step and Cancel in the field, and not a second Add step below it", () => {
    showEditor();

    fireEvent.click(button("Add step"));

    expect(screen.getAllByRole("button", { name: "Add step" })).toHaveLength(1);
    expect(cardButton("Cancel")).toBeTruthy();
  });

  it("should append the step, trim it and give focus back to Add step", () => {
    showEditor();
    fireEvent.click(button("Add step"));

    typeInto(textArea(6), "  Serve at once.  ");
    fireEvent.click(button("Add step"));

    expect(stepTexts()).toEqual([...steps, "Serve at once."]);
    expect(screen.getByRole("heading", { name: /^Instructions/ }).textContent).toBe(
      "Instructions · 6",
    );
    expect(document.activeElement).toBe(button("Add step"));
  });

  it("should add nothing when the field is empty", () => {
    showEditor();
    fireEvent.click(button("Add step"));

    fireEvent.click(button("Add step"));

    expect(stepTexts()).toEqual(steps);
    expect(openField()).toBeNull();
  });

  it("should add nothing when the field holds only spaces", () => {
    showEditor();
    fireEvent.click(button("Add step"));

    typeInto(textArea(6), "   \n  ");
    fireEvent.click(button("Add step"));

    expect(stepTexts()).toEqual(steps);
  });

  it("should add nothing when Cancel is pressed", () => {
    showEditor();
    fireEvent.click(button("Add step"));
    typeInto(textArea(6), "Serve at once.");

    fireEvent.click(cardButton("Cancel"));

    expect(stepTexts()).toEqual(steps);
    expect(openField()).toBeNull();
    expect(document.activeElement).toBe(button("Add step"));
  });

  it("should add the first step to a recipe with none", () => {
    showEditor([]);
    fireEvent.click(button("Add step"));

    typeInto(textArea(1), "Boil the kettle.");
    fireEvent.click(button("Add step"));

    expect(stepTexts()).toEqual(["Boil the kettle."]);
    expect(screen.queryByText(RECIPE_EDITOR.instructionsEmpty)).toBeNull();
  });

  describe("at the most a recipe holds", () => {
    it("should switch Add step off and say why", () => {
      showEditor(fillTo(MAX_RECIPE_STEPS));

      expect(button("Add step").disabled).toBe(true);
      expect(screen.getByText("Up to 50 steps")).toBeTruthy();
    });

    it("should give the reason to a screen reader when adding the last step switches the button off", () => {
      showEditor(fillTo(MAX_RECIPE_STEPS - 1));
      fireEvent.click(button("Add step"));
      typeInto(textArea(MAX_RECIPE_STEPS), "The last one.");

      fireEvent.click(button("Add step"));

      expect(document.activeElement).toBe(screen.getByText("Up to 50 steps"));
    });

    it("should draw no caption below the most", () => {
      showEditor(fillTo(MAX_RECIPE_STEPS - 1));

      expect(button("Add step").disabled).toBe(false);
      expect(screen.queryByText("Up to 50 steps")).toBeNull();
    });
  });
});

describe("removing a step", () => {
  it("should remove it at once, number the rest again and say Step removed with an Undo", () => {
    showEditor();

    fireEvent.click(button("Remove step 5"));

    expect(stepTexts()).toEqual(steps.slice(0, 4));
    expect(screen.getByRole("heading", { name: /^Instructions/ }).textContent).toBe(
      "Instructions · 4",
    );
    expect(screen.getByText(RECIPE_TOASTS.stepRemoved)).toBeTruthy();
    expect(screen.getByText("Step removed")).toBeTruthy();
    expect(button("Undo")).toBeTruthy();
  });

  it("should put the step back in its place when Undo is pressed", () => {
    showEditor();
    fireEvent.click(button("Remove step 2"));
    expect(stepTexts()).toEqual([steps[0], steps[2], steps[3], steps[4]]);

    fireEvent.click(button("Undo"));

    expect(stepTexts()).toEqual(steps);
  });

  it("should put the last step back at the end", () => {
    showEditor();
    fireEvent.click(button("Remove step 5"));

    fireEvent.click(button("Undo"));

    expect(stepTexts()).toEqual(steps);
  });

  it("should put back the step that was removed after an earlier one was too", () => {
    showEditor();
    fireEvent.click(button("Remove step 1"));
    fireEvent.click(button("Remove step 3"));

    fireEvent.click(button("Undo"));

    expect(stepTexts()).toEqual([steps[1], steps[2], steps[3], steps[4]]);
  });

  it("should leave the empty card when the only step goes, and bring it back with Undo", () => {
    showEditor(["Only step."]);

    fireEvent.click(button("Remove step 1"));
    expect(screen.getByText(RECIPE_EDITOR.instructionsEmpty)).toBeTruthy();

    fireEvent.click(button("Undo"));
    expect(stepTexts()).toEqual(["Only step."]);
  });

  describe("with a toast up", () => {
    it("should take the Undo down when a step starts to move, so it cannot retarget", () => {
      showEditor();
      fireEvent.click(button("Remove step 5"));

      fireEvent.click(button("Move step 2 up"));

      expect(toastShows("Step removed")).toBe(false);
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    });

    it("should take the Undo down when a step is opened to edit", () => {
      showEditor();
      fireEvent.click(button("Remove step 5"));

      fireEvent.click(button("Edit step 1"));

      expect(toastShows("Step removed")).toBe(false);
    });

    it("should take the Undo down when a new step is started", () => {
      showEditor();
      fireEvent.click(button("Remove step 5"));

      fireEvent.click(button("Add step"));

      expect(toastShows("Step removed")).toBe(false);
    });
  });
});

describe("saving", () => {
  function savedFrom(save: { steps: string[] }): RecipeEditorExisting {
    return { ...recipeWith(save.steps) };
  }

  it("should send the steps as they stand, in their new order", async () => {
    updateRecipe.mockImplementation((save: { steps: string[] }) =>
      Promise.resolve(savedFrom(save)),
    );
    showEditor();
    fireEvent.click(button("Move step 2 up"));
    fireEvent.click(button("Remove step 5"));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateRecipe).toHaveBeenCalledOnce();
    });
    expect(updateRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ steps: [steps[1], steps[0], steps[2], steps[3]] }),
    );
  });

  it("should keep a step that is still open, as Done would, and send it", async () => {
    updateRecipe.mockImplementation((save: { steps: string[] }) =>
      Promise.resolve(savedFrom(save)),
    );
    showEditor();
    fireEvent.click(button("Add step"));
    typeInto(textArea(6), "  Serve at once.  ");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateRecipe).toHaveBeenCalledOnce();
    });
    expect(updateRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ steps: [...steps, "Serve at once."] }),
    );
  });

  it("should send no blank step", async () => {
    updateRecipe.mockImplementation((save: { steps: string[] }) =>
      Promise.resolve(savedFrom(save)),
    );
    showEditor(["Boil the kettle.", "   ", "Pour."]);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateRecipe).toHaveBeenCalledOnce();
    });
    expect(updateRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ steps: ["Boil the kettle.", "Pour."] }),
    );
  });

  it("should not save while an open step is too long to keep, and bring the cursor back to it", () => {
    showEditor();
    fireEvent.click(button("Edit step 3"));
    typeInto(textArea(3), "a".repeat(MAX_RECIPE_STEP_LENGTH + 1));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(updateRecipe).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(textArea(3));
  });

  it("should count a step that is open and changed as a change to ask about before leaving", () => {
    showEditor();
    fireEvent.click(button("Add step"));
    typeInto(textArea(6), "Serve at once.");

    fireEvent.click(pageCancelButton());

    expect(screen.getByRole("dialog", { name: "Discard changes?" })).toBeTruthy();
  });
});

describe("discarding", () => {
  it("should close an open step and put the saved steps back", () => {
    showEditor();
    fireEvent.click(button("Move step 2 up"));
    fireEvent.click(button("Edit step 3"));
    typeInto(textArea(3), "Something else entirely.");

    fireEvent.click(pageCancelButton());
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(openField()).toBeNull();
    expect(stepTexts()).toEqual(steps);
  });
});

describe("when the connection drops", () => {
  it("should leave every step control working, with only Save off", () => {
    showEditor();
    act(() => {
      onlineManager.setOnline(false);
    });

    fireEvent.click(button("Move step 2 up"));
    fireEvent.click(button("Edit step 3"));
    typeInto(textArea(3), "Fry it.");
    fireEvent.click(button("Done"));

    expect(stepTexts()[0]).toBe(steps[1]);
    expect(stepTexts()[2]).toBe("Fry it.");
    expect(button("Remove step 3").disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("aria-disabled")).toBe("true");
  });
});
