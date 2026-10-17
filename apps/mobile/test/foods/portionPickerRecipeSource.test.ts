// Typed by hand because the app has no Node type definitions.
const { readFileSync, readdirSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: "utf8") => string;
  readdirSync: (path: string, options: { encoding: "utf8" }) => string[];
}>("node:fs");

// The amount step of a recipe: the picker's recipe mode, its route, and the log search group that opens it.
// The kit pieces it reuses are held to the same rules by the repository's source guard; this keeps the step
// itself honest where the ticket asks for it.
const directories = [
  "components/PortionPicker/RecipePortionPicker",
  "components/FoodSearch/RecipeLogGroup",
  "app/foods/recipe/[id]",
];
const sourceFiles = directories.flatMap((directory) =>
  readdirSync(directory, { encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => `${directory}/${file}`),
);

describe("the recipe amount step's source", () => {
  it("should find the step's files", () => {
    expect(sourceFiles).toEqual(
      expect.arrayContaining([
        "components/PortionPicker/RecipePortionPicker/RecipePortionPicker.tsx",
        "components/PortionPicker/RecipePortionPicker/previewTypedRecipeAmount.ts",
        "components/FoodSearch/RecipeLogGroup/RecipeLogGroup.tsx",
        "app/foods/recipe/[id]/log.tsx",
      ]),
    );
  });

  describe.each(sourceFiles)("%s", (file) => {
    const source = readFileSync(file, "utf8");

    it("should hold no raw hex colour or colour function", () => {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(/\b(?:rgba?|hsla?)\(/);
    });

    it("should hold no inline style object other than the inset and keyboard variables", () => {
      expect(source).not.toMatch(/StyleSheet\.create/);
      // The insets and the keyboard's cover are runtime values no class can name, and they go through variables.
      expect(source.replaceAll("style={vars(", "")).not.toMatch(/style=\{/);
    });

    it("should hold no arbitrary colour in a class, so every colour is a design token", () => {
      expect(source).not.toMatch(/\b(?:bg|text|border|fill|stroke)-\[(?:#|rgb|hsl)/);
    });

    it("should keep no copy of the amount rules, which are core's", () => {
      // No rounding, no scaling of a recipe by its servings or weight, and no number parsed by hand.
      expect(source).not.toMatch(/Math\.(?:round|floor|ceil)|parseFloat|\bNumber\(|\.toFixed\(/);
      expect(source).not.toMatch(
        /[*/]\s*recipe\.(?:servings|computed)|(?:servings|effectiveGrams)\s*[*/]/,
      );
    });

    it("should log nothing, so no recipe name or amount can reach a log", () => {
      expect(source).not.toMatch(/console\./);
    });
  });
});
