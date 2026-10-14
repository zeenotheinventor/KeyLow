import { compileKitStyles } from "../../support/kitStyles";

// Typed by hand because the app has no Node type definitions.
const { readFileSync, readdirSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: "utf8") => string;
  readdirSync: (path: string, options: { recursive: true; encoding: "utf8" }) => string[];
}>("node:fs");

const screenDirectory = "components/FoodSearch";

/**
 * Compiles the styles of the kit and of the search sheet's own classes, so a test of the sheet sees
 * what NativeWind would resolve on a device for the classes the screen really writes.
 */
export async function compileFoodSearchStyles(): Promise<string> {
  const sources = readdirSync(screenDirectory, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => readFileSync(`${screenDirectory}/${file}`, "utf8"));

  return compileKitStyles(sources.join("\n"));
}
