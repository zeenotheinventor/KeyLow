// Typed by hand because the app has no Node type definitions.
const { readFileSync, readdirSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: "utf8") => string;
  readdirSync: (path: string, options: { encoding: "utf8" }) => string[];
}>("node:fs");

// The recipe library's own files, and the route helper. The kit pieces it extended are held to the same
// rules by the repository's source guard; this keeps the screen itself honest where the ticket asks for it.
const directories = [
  "components/RecipeLibrary",
  "components/RecipeLibraryView",
  "components/RecipeActions",
  "components/RecipeRowMenu",
  "components/ArchivedRecipesView",
  "components/ArchivedRecipesScreen",
];
const sourceFiles = [
  "lib/recipeRoutes.ts",
  ...directories.flatMap((directory) =>
    readdirSync(directory, { encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file))
      .map((file) => `${directory}/${file}`),
  ),
];

describe("the recipe library's source", () => {
  it("should find the screen's files", () => {
    expect(sourceFiles).toEqual(
      expect.arrayContaining([
        "components/RecipeLibrary/RecipeLibrary.tsx",
        "components/RecipeLibraryView/RecipeLibraryView.tsx",
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
  });
});
