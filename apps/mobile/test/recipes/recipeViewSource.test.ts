// Typed by hand because the app has no Node type definitions.
const { readFileSync, readdirSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: "utf8") => string;
  readdirSync: (path: string, options: { encoding: "utf8" }) => string[];
}>("node:fs");

// The recipe view's own files. The kit pieces it extended are held to the same rules by the repository's
// source guard; this keeps the screen itself honest where the ticket asks for it.
const directories = [
  "components/RecipeView",
  "components/RecipeViewScreen",
  "components/RecipeLoadState",
  "components/RecipeEditorScreen",
  "components/ServingsCard",
  "components/RecipeViewIngredientsSection",
  "components/RecipeViewStepsSection",
  "components/StepRow",
  "app/recipes/[id]",
];
const sourceFiles = [
  "lib/recipeRoutes.ts",
  ...directories.flatMap((directory) =>
    readdirSync(directory, { encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file))
      .map((file) => `${directory}/${file}`),
  ),
];

describe("the recipe view's source", () => {
  it("should find the screen's files", () => {
    expect(sourceFiles).toEqual(
      expect.arrayContaining([
        "components/RecipeView/RecipeView.tsx",
        "components/RecipeViewScreen/RecipeViewScreen.tsx",
        "components/StepRow/StepRow.tsx",
        "app/recipes/[id]/index.tsx",
      ]),
    );
  });

  describe.each(sourceFiles)("%s", (file) => {
    const source = readFileSync(file, "utf8");

    it("should hold no raw hex colour or colour function", () => {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(/\b(?:rgba?|hsla?)\(/);
    });

    it("should hold no inline style object other than the inset variable", () => {
      expect(source).not.toMatch(/StyleSheet\.create/);
      // The top inset is the one runtime value no class can name, and it goes through a variable.
      expect(source.replaceAll("style={vars(", "")).not.toMatch(/style=\{/);
    });

    it("should hold no arbitrary colour in a class, so every colour is a design token", () => {
      expect(source).not.toMatch(/\b(?:bg|text|border|fill|stroke)-\[(?:#|rgb|hsl)/);
    });

    it("should hold no scaling, rounding or validation of its own", () => {
      expect(source).not.toMatch(/parseFloat|Number\(|\.reduce\(|Math\.(?:round|floor|ceil)/);
    });

    it("should log nothing, so no recipe name or amount can reach a log", () => {
      expect(source).not.toMatch(/console\./);
    });
  });
});
