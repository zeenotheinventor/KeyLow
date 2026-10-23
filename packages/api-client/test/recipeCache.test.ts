import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import { keys } from "../src/queryKeys";
import { addToLibrary, libraryNames, setLibraryFlag, summaryOf } from "../src/recipeCache";
import { recipeDetailRow, recipeSummaryRow } from "./support/recipes";
import { seedDiaryQueries } from "./support/recipeWrites";

import type { RecipeDetail, RecipeSummary } from "../src/repos/recipes";

const libraryKey = keys.recipes.list(true);

const ORIGINAL_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_ID = "55555555-5555-4555-8555-555555555555";
const COPY_ID = "66666666-6666-4666-8666-666666666666";

const SUMMARY_FIELDS = ["computed", "id", "is_archived", "name", "servings", "yield_grams"];

const detailOf = (id: string, name: string): RecipeDetail => {
  const { recipe_ingredients, ...rest } = recipeDetailRow({ id, name });
  return { ...rest, ingredients: recipe_ingredients };
};

const libraryOf = (queryClient: QueryClient) =>
  queryClient.getQueryData<RecipeSummary[]>(libraryKey);

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient();
  queryClient.setQueryData(libraryKey, [
    recipeSummaryRow({ id: ORIGINAL_ID, name: "Chicken and rice" }),
    recipeSummaryRow({ id: OTHER_ID, name: "Porridge" }),
  ]);
});

describe("summaryOf", () => {
  it("should keep the library columns of a saved recipe and nothing else", () => {
    const summary = summaryOf(detailOf(COPY_ID, "Chicken and rice (copy)"));

    expect(Object.keys(summary).sort()).toEqual(SUMMARY_FIELDS);
    expect(summary).toMatchObject({ id: COPY_ID, name: "Chicken and rice (copy)" });
  });
});

describe("addToLibrary", () => {
  it("should add the copy straight after its original as a row with no ingredients or steps", () => {
    addToLibrary(queryClient, ORIGINAL_ID, summaryOf(detailOf(COPY_ID, "Chicken and rice (copy)")));

    const library = libraryOf(queryClient);
    expect(library?.map(({ id }) => id)).toEqual([ORIGINAL_ID, COPY_ID, OTHER_ID]);
    expect(Object.keys(library?.[1] ?? {}).sort()).toEqual(SUMMARY_FIELDS);
  });

  it("should not add a copy the library already holds", () => {
    const copy = summaryOf(detailOf(COPY_ID, "Chicken and rice (copy)"));
    addToLibrary(queryClient, ORIGINAL_ID, copy);
    addToLibrary(queryClient, ORIGINAL_ID, copy);

    expect(libraryOf(queryClient)).toHaveLength(3);
  });

  it("should leave the cache empty when the library has not been read", () => {
    const empty = new QueryClient();

    addToLibrary(empty, ORIGINAL_ID, summaryOf(detailOf(COPY_ID, "Chicken and rice (copy)")));

    expect(empty.getQueryData(libraryKey)).toBeUndefined();
  });
});

describe("setLibraryFlag", () => {
  it("should set the flag of one recipe and leave the others as they were", () => {
    setLibraryFlag(queryClient, ORIGINAL_ID, true);

    expect(libraryOf(queryClient)?.map(({ id, is_archived }) => [id, is_archived])).toEqual([
      [ORIGINAL_ID, true],
      [OTHER_ID, false],
    ]);
  });

  it("should put the list back exactly when the write fails and the rollback runs", () => {
    const before = libraryOf(queryClient);

    const rollback = setLibraryFlag(queryClient, ORIGINAL_ID, true);
    rollback();

    expect(libraryOf(queryClient)).toEqual(before);
  });

  it("should put back the flag the recipe had, not the opposite of the one it was given", () => {
    setLibraryFlag(queryClient, ORIGINAL_ID, true);
    const rollback = setLibraryFlag(queryClient, ORIGINAL_ID, true);
    rollback();

    expect(libraryOf(queryClient)?.[0]?.is_archived).toBe(true);
  });

  it("should leave a recipe that is not in the library alone", () => {
    const before = libraryOf(queryClient);

    setLibraryFlag(queryClient, COPY_ID, true)();

    expect(libraryOf(queryClient)).toEqual(before);
  });
});

describe("libraryNames", () => {
  it("should list the names in the library, archived ones included", () => {
    setLibraryFlag(queryClient, OTHER_ID, true);

    expect(libraryNames(queryClient)).toEqual(["Chicken and rice", "Porridge"]);
  });

  it("should be empty when the library has not been read", () => {
    expect(libraryNames(new QueryClient())).toEqual([]);
  });
});

describe("the diary", () => {
  it("should be left alone by every library edit", () => {
    const expectDiaryUntouched = seedDiaryQueries(queryClient);

    addToLibrary(queryClient, ORIGINAL_ID, summaryOf(detailOf(COPY_ID, "Chicken and rice (copy)")));
    setLibraryFlag(queryClient, COPY_ID, true)();
    libraryNames(queryClient);

    expectDiaryUntouched();
  });
});
