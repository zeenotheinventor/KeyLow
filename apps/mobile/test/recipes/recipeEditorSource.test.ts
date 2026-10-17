// Typed by hand because the app has no Node type definitions.
const { readFileSync, readdirSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: "utf8") => string;
  readdirSync: (path: string, options: { encoding: "utf8" }) => string[];
}>("node:fs");

// The editor's own files. The kit pieces it extended are held to the same rules by the repository's source
// guard; this keeps the screen itself honest where the ticket asks for it.
const directories = [
  "components/RecipeEditor",
  "components/RecipeEditorScreen",
  "components/RecipeLoadState",
  "components/RecipeDetailsFields",
  "components/RecipeIngredientsSection",
  "components/IngredientAmountStep",
  "components/PerServingCard",
  "components/DiscardRecipeSheet",
  "app/recipes",
  "app/recipes/[id]",
];
const sourceFiles = [
  "lib/recipeRoutes.ts",
  "lib/useSettledValue.ts",
  "lib/ingredientFromAmount.ts",
  ...directories.flatMap((directory) =>
    readdirSync(directory, { encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file))
      .map((file) => `${directory}/${file}`),
  ),
];

describe("the recipe editor's source", () => {
  it("should find the screen's files", () => {
    expect(sourceFiles).toEqual(
      expect.arrayContaining([
        "components/RecipeEditor/RecipeEditor.tsx",
        "components/RecipeEditorScreen/RecipeEditorScreen.tsx",
        "app/recipes/new.tsx",
        "app/recipes/[id]/edit.tsx",
      ]),
    );
  });

  describe.each(sourceFiles)("%s", (file) => {
    const source = readFileSync(file, "utf8");

    it("should hold no raw hex colour or colour function", () => {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(/\b(?:rgba?|hsla?)\(/);
    });

    it("should hold no inline style object", () => {
      expect(source).not.toMatch(/style=\{\{/);
      expect(source).not.toMatch(/StyleSheet\.create/);
    });

    it("should hold no arbitrary colour in a class, so every colour is a design token", () => {
      expect(source).not.toMatch(/\b(?:bg|text|border|fill|stroke)-\[(?:#|rgb|hsl)/);
    });

    it("should hold no number or validation logic of its own", () => {
      expect(source).not.toMatch(/parseFloat|Number\(|\.reduce\(|Math\.round/);
    });

    it("should log nothing, so no recipe name or amount can reach a log", () => {
      expect(source).not.toMatch(/console\./);
    });
  });
});
