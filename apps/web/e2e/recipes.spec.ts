import {
  ADD_INGREDIENT,
  EDIT_ENTRY_DIALOG,
  ENTRY_SCREEN,
  RECIPES_EMPTY,
  RECIPES_LIBRARY,
  RECIPE_EDITOR,
  RECIPE_TOASTS,
  RECIPE_VIEW,
  describeEditRecipe,
} from "@keylow/core/copy";
import { expect, test } from "@playwright/test";

const stamp = String(Date.now());
const email = `key333-${stamp}@keylow.local`;
const password = `throwaway-${stamp}`;
const recipeName = `key333-${stamp} chicken and rice`;

// The dev server compiles each page the first time it is opened, so the walk gets more time than a click.
test.setTimeout(120_000);

test("walks a new user from More's Recipes row to a saved recipe and back to it in the library", async ({
  page,
}) => {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page
    .getByRole("checkbox", { name: /I accept the Terms and the Privacy Policy/ })
    .check({ force: true });
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Recipes is not in the top bar. More's Recipes row opens the library, which has nothing in it yet.
  const mainNav = page.getByRole("navigation", { name: "Main" });
  await expect(mainNav.getByRole("link", { name: "Recipes" })).toHaveCount(0);
  await mainNav.getByRole("link", { name: "More" }).click();
  await expect(page).toHaveURL(/\/more$/);
  await page
    .getByRole("region", { name: "Nutrition" })
    .getByRole("link", { name: "Recipes" })
    .click();
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(mainNav.getByRole("link", { name: "More" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "Recipes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: RECIPES_EMPTY.title })).toBeVisible();

  // New recipe: a name, four servings and one ingredient from the Add food dialog.
  await page
    .getByRole("main")
    .getByRole("link", { name: RECIPES_LIBRARY.newRecipe })
    .last()
    .click();
  await expect(page).toHaveURL(/\/recipes\/new$/);
  await page.getByLabel("Name").fill(recipeName);
  await page.getByRole("textbox", { name: RECIPE_EDITOR.servings }).fill("4");
  await page.getByRole("button", { name: RECIPE_EDITOR.addIngredient }).click();
  const addDialog = page.getByRole("dialog", { name: ADD_INGREDIENT.title });
  await addDialog.getByRole("searchbox", { name: "Search foods" }).fill("onions raw");
  await addDialog
    .getByRole("group", { name: "Search results" })
    .getByRole("listitem")
    .filter({ hasText: "Onions, raw" })
    .first()
    .getByRole("button")
    .click();
  await addDialog.getByRole("radio", { name: "g", exact: true }).check({ force: true });
  await addDialog.getByRole("textbox", { name: /^Amount/ }).fill("200");
  await addDialog.getByRole("button", { name: RECIPE_EDITOR.addToRecipe }).click();
  await expect(addDialog).toHaveCount(0);

  // Save lands on the view of the recipe, with the toast.
  await page.getByRole("button", { name: ENTRY_SCREEN.saveAction }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}$/);
  await expect(page.getByText(RECIPE_TOASTS.saved)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: recipeName })).toBeVisible();
  const servings = page.getByRole("spinbutton", { name: "Servings" });
  await expect(servings).toHaveValue("4");
  await expect(page.getByRole("listitem", { name: "Onions, raw, 200 g" })).toBeVisible();

  // Plus twice scales the amounts to 6 servings.
  await page.getByRole("button", { name: RECIPE_VIEW.moreServings }).click();
  await page.getByRole("button", { name: RECIPE_VIEW.moreServings }).click();
  await expect(servings).toHaveValue("6");
  await expect(page.getByRole("listitem", { name: "Onions, raw, 300 g" })).toBeVisible();

  // Edit and then Cancel come back to the recipe at its own servings.
  await page.getByRole("link", { name: describeEditRecipe(recipeName) }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}\/edit$/);
  await page.getByRole("button", { name: EDIT_ENTRY_DIALOG.cancel }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("spinbutton", { name: "Servings" })).toHaveValue("4");

  // The recipe's link back to Recipes finds it in the library, and the search narrows to it.
  await page.getByRole("link", { name: "Recipes" }).first().click();
  await expect(page).toHaveURL(/\/recipes$/);
  const table = page.getByRole("table", { name: "Recipes" });
  await expect(table.getByRole("row", { name: new RegExp(recipeName) })).toBeVisible();
  await page.getByRole("searchbox", { name: RECIPES_LIBRARY.searchPlaceholder }).fill(recipeName);
  await expect(table.getByRole("row")).toHaveCount(2);

  // A row opens the recipe.
  await table.getByRole("link", { name: new RegExp(recipeName) }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: recipeName })).toBeVisible();
});
