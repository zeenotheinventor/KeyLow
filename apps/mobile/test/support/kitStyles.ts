import { compileAppStyles } from "./nativeWindStyles";

// Typed by hand because the app has no Node type definitions.
const { readFileSync, readdirSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: "utf8") => string;
  readdirSync: (path: string, options: { recursive: true; encoding: "utf8" }) => string[];
}>("node:fs");

const kitDirectory = "components/ui";

/**
 * Compiles the styles for every class name written in the kit's own source files, so a kit test sees
 * what NativeWind would resolve on a device for the classes the components really use. A class that a
 * component writes and the Tailwind config cannot build has no style here, and the test that expects
 * it fails. Class names a test passes to a component itself are given as `extraClassNames`. It reads
 * from the working directory, which is the app folder when Jest runs from there.
 */
export async function compileKitStyles(extraClassNames = ""): Promise<string> {
  const sources = readdirSync(kitDirectory, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => readFileSync(`${kitDirectory}/${file}`, "utf8"));

  return compileAppStyles([...sources, extraClassNames].join("\n"));
}
