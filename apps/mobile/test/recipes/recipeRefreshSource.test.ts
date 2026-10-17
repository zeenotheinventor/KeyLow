// Typed by hand because the app has no Node type definitions.
const { readFileSync, readdirSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: "utf8") => string;
  readdirSync: (path: string, options: { encoding: "utf8" }) => string[];
}>("node:fs");

// The refresh screen's own files. The kit pieces it extended are held to the same rules by the repository's
// source guard; this keeps the screen itself honest where the ticket asks for it.
const directories = [
  "components/RecipeRefreshScreen",
  "components/RecipeRefreshContent",
  "components/BeforeAfterRow",
  "components/ChangedIngredientCard",
  "app/recipes/[id]",
];
const sourceFiles = directories.flatMap((directory) =>
  readdirSync(directory, { encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => `${directory}/${file}`),
);

describe("the refresh screen's source", () => {
  it("should find the screen's files", () => {
    expect(sourceFiles).toEqual(
      expect.arrayContaining([
        "components/RecipeRefreshScreen/RecipeRefreshScreen.tsx",
        "components/RecipeRefreshContent/RecipeRefreshContent.tsx",
        "components/BeforeAfterRow/BeforeAfterRow.tsx",
        "components/ChangedIngredientCard/ChangedIngredientCard.tsx",
        "app/recipes/[id]/refresh.tsx",
      ]),
    );
  });

  describe.each(sourceFiles)("%s", (file) => {
    const source = readFileSync(file, "utf8");

    it("should hold no raw hex colour or colour function", () => {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(/\b(?:rgba?|hsla?)\(/);
    });

    it("should hold no inline style object other than the inset variables", () => {
      expect(source).not.toMatch(/StyleSheet\.create/);
      // The insets are the one runtime value no class can name, and they go through variables.
      expect(source.replaceAll("style={vars(", "")).not.toMatch(/style=\{/);
    });

    it("should hold no arbitrary colour in a class, so every colour is a design token", () => {
      expect(source).not.toMatch(/\b(?:bg|text|border|fill|stroke)-\[(?:#|rgb|hsl)/);
    });

    it("should do no diffing, rounding or scaling of its own", () => {
      expect(source).not.toMatch(/parseFloat|Number\(|\.reduce\(|Math\.(?:round|floor|ceil)/);
    });

    it("should log nothing, so no recipe name or amount can reach a log", () => {
      expect(source).not.toMatch(/console\./);
    });
  });
});
