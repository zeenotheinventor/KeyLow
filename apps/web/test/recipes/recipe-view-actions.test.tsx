import {
  GENERIC_ERROR,
  describeArchiveRecipe,
  describeDuplicateRecipe,
  describeEditRecipe,
} from "@keylow/core/copy";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  holdWrites,
  recipesBackend,
  releaseWrites,
  renderWithRecipes,
  resetRecipesBackend,
  sampleRecipeNamed,
} from "./support";

import { RecipeViewScreen } from "@/components/recipes";
import { archivedSampleRecipes, sampleRecipes } from "@/components/recipes/sampleRecipes";
import { recipePath, recipesPath } from "@/lib/recipeRoutes";

// The router moves the browser's address and tells the page, as the app router does, so the page that
// is showing follows the address and "where the user is now" can be read from it.
const navigation = vi.hoisted(() => {
  const state: { listener: ((path: string) => void) | undefined; calls: string[] } = {
    listener: undefined,
    calls: [],
  };
  const go = (method: "push" | "replace", href: string) => {
    state.calls.push(`${method} ${href}`);
    if (method === "push") {
      window.history.pushState({}, "", href);
    } else {
      window.history.replaceState({}, "", href);
    }
    state.listener?.(href);
  };

  return { state, go };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => {
      navigation.go("push", href);
    },
    replace: (href: string) => {
      navigation.go("replace", href);
    },
  }),
}));

const chickenAndRice = sampleRecipeNamed("Chicken and rice");
const golden = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });
const archivedRecipe = archivedSampleRecipes[0];
if (archivedRecipe === undefined) {
  throw new Error("The sample recipes must include an archived recipe");
}

// The pages of the app this test cares about: the recipe view at the address, and the library.
function Pages() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    navigation.state.listener = setPath;
    return () => {
      navigation.state.listener = undefined;
    };
  }, []);

  return path === recipesPath() ? (
    <h1>The recipe library</h1>
  ) : (
    <RecipeViewScreen id={path.slice(recipesPath().length + 1)} />
  );
}

beforeEach(() => {
  resetRecipesBackend();
  navigation.state.calls = [];
  recipesBackend.rows = [...sampleRecipes, ...archivedSampleRecipes];
  recipesBackend.contents.set(chickenAndRice.id, {
    instructions: ["Cook the rice.", "Fry the chicken."],
    ingredients: golden.ingredients,
  });
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  window.history.replaceState({}, "", "/");
});

async function showView(id: string, name: string) {
  window.history.replaceState({}, "", recipePath(id));
  renderWithRecipes(<Pages />);
  await screen.findByRole("heading", { level: 1, name });
}

const showChickenAndRice = () => showView(chickenAndRice.id, "Chicken and rice");

const press = (name: string) => {
  fireEvent.click(screen.getByRole("button", { name }));
};

const pageTitled = (name: string) => screen.findByRole("heading", { level: 1, name });

// A press starts its write after an await, so what a press did not do is only known once that has had its turn.
const letPressesSettle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const writesOf = (kind: string) => recipesBackend.writes.filter((write) => write === kind);

// Waits for the library to be read, which is when Duplicate can name its copy.
async function duplicateButtonOf(name: string) {
  const button = screen.getByRole("button", { name: describeDuplicateRecipe(name) });
  await waitFor(() => {
    expect(button.getAttribute("aria-disabled")).toBeNull();
  });
  return button;
}

describe("RecipeViewScreen Duplicate and Archive", () => {
  describe("the buttons", () => {
    it("should offer Duplicate and Archive, named for the recipe, after Edit", async () => {
      await showChickenAndRice();

      const controls = [
        screen.getByRole("link", { name: describeEditRecipe("Chicken and rice") }),
        screen.getByRole("button", { name: describeDuplicateRecipe("Chicken and rice") }),
        screen.getByRole("button", { name: describeArchiveRecipe("Chicken and rice") }),
      ];
      const [edit, duplicate, archive] = controls;
      expect(edit?.compareDocumentPosition(duplicate ?? document.body)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(duplicate?.compareDocumentPosition(archive ?? document.body)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    it("should offer Duplicate but no Archive on an archived recipe reached by a link", async () => {
      await showView(archivedRecipe.id, archivedRecipe.name);

      expect(
        screen.getByRole("button", { name: describeDuplicateRecipe(archivedRecipe.name) }),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Archive / })).toBeNull();
    });
  });

  describe("Duplicate", () => {
    it("should open the copy's own page and say the recipe is duplicated, with an Undo", async () => {
      await showChickenAndRice();
      await duplicateButtonOf("Chicken and rice");

      press(describeDuplicateRecipe("Chicken and rice"));

      expect(await pageTitled("Chicken and rice (copy)")).toBeTruthy();
      expect(await screen.findByText("Recipe duplicated")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      expect(navigation.state.calls).toEqual([
        expect.stringMatching(/^push \/recipes\/00000000-0000-4000-8000-0000000001/),
      ]);
    });

    it("should name a second copy of the original (copy 2)", async () => {
      await showChickenAndRice();
      await duplicateButtonOf("Chicken and rice");
      press(describeDuplicateRecipe("Chicken and rice"));
      await pageTitled("Chicken and rice (copy)");
      act(() => {
        navigation.go("push", recipePath(chickenAndRice.id));
      });
      await pageTitled("Chicken and rice");

      press(describeDuplicateRecipe("Chicken and rice"));

      expect(await pageTitled("Chicken and rice (copy 2)")).toBeTruthy();
    });

    it("should archive the copy and return to the original's page when Undo is pressed", async () => {
      await showChickenAndRice();
      await duplicateButtonOf("Chicken and rice");
      press(describeDuplicateRecipe("Chicken and rice"));
      await pageTitled("Chicken and rice (copy)");

      press("Undo");

      expect(await pageTitled("Chicken and rice")).toBeTruthy();
      expect(navigation.state.calls.at(-1)).toBe(`replace ${recipePath(chickenAndRice.id)}`);
      expect(writesOf("archive")).toHaveLength(1);
      expect(
        recipesBackend.rows.find((row) => row.name === "Chicken and rice (copy)")?.is_archived,
      ).toBe(true);
    });

    it("should archive the copy but leave the user where they are when they have left the copy's page", async () => {
      await showChickenAndRice();
      await duplicateButtonOf("Chicken and rice");
      press(describeDuplicateRecipe("Chicken and rice"));
      await pageTitled("Chicken and rice (copy)");
      act(() => {
        navigation.go("push", recipesPath());
      });
      await screen.findByRole("heading", { name: "The recipe library" });

      press("Undo");

      await waitFor(() => {
        expect(writesOf("archive")).toHaveLength(1);
      });
      expect(screen.getByRole("heading", { name: "The recipe library" })).toBeTruthy();
      expect(navigation.state.calls).toHaveLength(2);
    });

    it("should wait for the library to be read before it makes a copy, as the copy is named from it", async () => {
      recipesBackend.hangs = true;
      await showChickenAndRice();
      const duplicate = screen.getByRole("button", {
        name: describeDuplicateRecipe("Chicken and rice"),
      });

      fireEvent.click(duplicate);
      await letPressesSettle();

      expect(duplicate.getAttribute("aria-disabled")).toBe("true");
      expect(recipesBackend.writes).toEqual([]);
      expect(navigation.state.calls).toEqual([]);
    });

    it("should make one copy when the button is pressed twice, and be busy until it is saved", async () => {
      await showChickenAndRice();
      const duplicate = await duplicateButtonOf("Chicken and rice");
      holdWrites();

      fireEvent.click(duplicate);
      fireEvent.click(duplicate);

      await waitFor(() => {
        expect(duplicate.getAttribute("aria-busy")).toBe("true");
      });
      releaseWrites();
      await pageTitled("Chicken and rice (copy)");
      expect(writesOf("save_recipe")).toHaveLength(1);
    });

    it("should stay on the page and give the fixed sentence when the copy cannot be saved", async () => {
      await showChickenAndRice();
      const duplicate = await duplicateButtonOf("Chicken and rice");
      recipesBackend.failsWrites = true;

      fireEvent.click(duplicate);

      expect(await screen.findByText(GENERIC_ERROR)).toBeTruthy();
      expect(screen.queryByText(/database unavailable/)).toBeNull();
      expect(screen.getByRole("heading", { level: 1, name: "Chicken and rice" })).toBeTruthy();
      expect(navigation.state.calls).toEqual([]);
      await waitFor(() => {
        expect(duplicate.getAttribute("aria-busy")).toBeNull();
      });
    });
  });

  describe("Archive", () => {
    it("should go to the library and say the recipe is archived, with an Undo", async () => {
      await showChickenAndRice();

      press(describeArchiveRecipe("Chicken and rice"));

      expect(await screen.findByRole("heading", { name: "The recipe library" })).toBeTruthy();
      expect(await screen.findByText("Recipe archived")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      expect(navigation.state.calls).toEqual([`push ${recipesPath()}`]);
      expect(recipesBackend.rows.find((row) => row.id === chickenAndRice.id)?.is_archived).toBe(
        true,
      );
    });

    it("should restore the recipe when Undo is pressed, and stay where it is", async () => {
      await showChickenAndRice();
      press(describeArchiveRecipe("Chicken and rice"));
      fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(recipesBackend.rows.find((row) => row.id === chickenAndRice.id)?.is_archived).toBe(
          false,
        );
      });
      expect(screen.getByRole("heading", { name: "The recipe library" })).toBeTruthy();
      expect(navigation.state.calls).toEqual([`push ${recipesPath()}`]);
    });

    it("should archive once when the button is pressed twice, and be busy until it is done", async () => {
      await showChickenAndRice();
      const archive = screen.getByRole("button", {
        name: describeArchiveRecipe("Chicken and rice"),
      });
      holdWrites();

      fireEvent.click(archive);
      fireEvent.click(archive);

      await waitFor(() => {
        expect(archive.getAttribute("aria-busy")).toBe("true");
      });
      releaseWrites();
      await screen.findByRole("heading", { name: "The recipe library" });
      expect(writesOf("archive")).toHaveLength(1);
    });

    it("should stay on the page and give the fixed sentence when it cannot be archived", async () => {
      await showChickenAndRice();
      recipesBackend.failsWrites = true;

      press(describeArchiveRecipe("Chicken and rice"));

      expect(await screen.findByText(GENERIC_ERROR)).toBeTruthy();
      expect(screen.queryByText(/database unavailable/)).toBeNull();
      expect(screen.getByRole("heading", { level: 1, name: "Chicken and rice" })).toBeTruthy();
      expect(navigation.state.calls).toEqual([]);
      await waitFor(() => {
        expect(
          screen
            .getByRole("button", { name: describeArchiveRecipe("Chicken and rice") })
            .getAttribute("aria-busy"),
        ).toBeNull();
      });
    });
  });

  describe("offline", () => {
    it("should disable both buttons, keep them focusable, and do nothing when they are pressed", async () => {
      await showChickenAndRice();
      await duplicateButtonOf("Chicken and rice");
      act(() => {
        onlineManager.setOnline(false);
      });

      const duplicate = screen.getByRole("button", {
        name: describeDuplicateRecipe("Chicken and rice"),
      });
      const archive = screen.getByRole("button", {
        name: describeArchiveRecipe("Chicken and rice"),
      });
      for (const button of [duplicate, archive]) {
        expect(button.getAttribute("aria-disabled")).toBe("true");
        expect(button.hasAttribute("disabled")).toBe(false);
        button.focus();
        expect(document.activeElement).toBe(button);
        fireEvent.click(button);
      }
      await letPressesSettle();

      // Offline a write waits for the connection instead of failing, so a press that did something would
      // show as busy now and as a write once the connection is back.
      expect(duplicate.getAttribute("aria-busy")).toBeNull();
      expect(archive.getAttribute("aria-busy")).toBeNull();
      act(() => {
        onlineManager.setOnline(true);
      });
      await letPressesSettle();
      expect(recipesBackend.writes).toEqual([]);
      expect(navigation.state.calls).toEqual([]);
    });
  });
});
