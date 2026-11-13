import { act, cleanup, render } from "@testing-library/react-native";

import NewRecipeRoute from "../app/recipes/new";
import { beginRecipePrefill, peekRecipePrefill, savedRecipeIdOfDraft } from "../lib/recipePrefill";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { resetRecipePrefillForTests } from "../lib/recipePrefill/testing";

import type { RecipeEditorProps } from "../components/RecipeEditor";
import type { RecipeDraft } from "@keylow/core/recipes";

// The new recipe route reads the id of a drafted recipe from its address and hands the editor the draft left under
// it. The editor itself is stood in for: its own tests cover what it does with the draft.

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);

const mockEditor = jest.fn<null, [RecipeEditorProps]>(() => null);
jest.mock("../components/RecipeEditor", () => ({
  RecipeEditor: (props: RecipeEditorProps) => mockEditor(props),
}));

const draft: RecipeDraft = {
  name: "Chicken and rice",
  servings: "2",
  cookedWeight: "",
  ingredients: [],
  steps: [],
};

const lastProps = (): RecipeEditorProps => {
  const props = mockEditor.mock.lastCall?.[0];
  if (props === undefined) {
    throw new Error("The editor was not drawn");
  }
  return props;
};

describe("the new recipe route", () => {
  beforeEach(() => {
    resetRouterMock();
    resetRecipePrefillForTests();
    mockEditor.mockClear();
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should open the empty editor with the typed name when there is no prefill", async () => {
    routerMock.searchParams = { name: "pasta" };

    await render(<NewRecipeRoute />);

    expect(lastProps().initialName).toBe("pasta");
    expect(lastProps().initialDraft).toBeUndefined();
    expect(lastProps().onSaved).toBeUndefined();
  });

  it("should hand the editor the draft left under the id in the address", async () => {
    const id = beginRecipePrefill({ draft, draftKey: "key-a", searchWord: null });
    routerMock.searchParams = { prefill: id };

    await render(<NewRecipeRoute />);

    expect(lastProps().initialDraft).toBe(draft);
  });

  it("should open an empty editor for an id that was never given out", async () => {
    routerMock.searchParams = { prefill: "made-up" };

    await render(<NewRecipeRoute />);

    expect(lastProps().initialDraft).toBeUndefined();
  });

  it("should tell the card which recipe the draft was saved as", async () => {
    const id = beginRecipePrefill({ draft, draftKey: "key-a", searchWord: null });
    routerMock.searchParams = { prefill: [id, "other"] };
    await render(<NewRecipeRoute />);

    await act(() => {
      lastProps().onSaved?.("55555555-5555-4555-8555-555555555555");
    });

    expect(savedRecipeIdOfDraft("key-a")).toBe("55555555-5555-4555-8555-555555555555");
  });

  it("should open the add-ingredient search on the first line that matched no food", async () => {
    const id = beginRecipePrefill({ draft, draftKey: "key-a", searchWord: "harissa paste" });
    routerMock.searchParams = { prefill: id };

    await render(<NewRecipeRoute />);

    expect(lastProps().initialIngredientSearch).toBe("harissa paste");
  });

  it("should leave the search closed when every line matched", async () => {
    const id = beginRecipePrefill({ draft, draftKey: "key-a", searchWord: null });
    routerMock.searchParams = { prefill: id };

    await render(<NewRecipeRoute />);

    expect(lastProps().initialIngredientSearch).toBeUndefined();
  });

  it("should take the draft out of the store once it has it, so the id opens nothing again", async () => {
    const id = beginRecipePrefill({ draft, draftKey: "key-a", searchWord: null });
    routerMock.searchParams = { prefill: id };

    await render(<NewRecipeRoute />);

    expect(peekRecipePrefill(id)).toBeUndefined();
    expect(lastProps().initialDraft).toBe(draft);
  });
});
