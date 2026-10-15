import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Each icon is one file in `Icon/icons`, named for the icon and exporting it from lucide-react-native, and
// the icon map is generated from those files. Two files that export the same name would make tsc fail with
// a duplicate identifier, and a file that exports a different name from its own is caught here.
const iconsDirectory = path.join(__dirname, "..", "..", "components", "ui", "Icon", "icons");
const iconFiles = readdirSync(iconsDirectory).sort();

describe("the icon files", () => {
  it("should find the icons", () => {
    expect(iconFiles.length).toBeGreaterThan(0);
  });

  it.each(iconFiles)(
    "%s should export the icon it is named for, from lucide-react-native",
    (file) => {
      const name = file.replace(/\.ts$/, "");

      expect(readFileSync(path.join(iconsDirectory, file), "utf8")).toBe(
        `export { ${name} } from "lucide-react-native";\n`,
      );
    },
  );
});
