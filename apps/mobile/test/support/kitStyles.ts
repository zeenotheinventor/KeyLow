import { compileAppStyles } from "./nativeWindStyles";

// Typed by hand because the app has no Node type definitions.
const { readFileSync, readdirSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: "utf8") => string;
  readdirSync: (path: string, options: { recursive: true; encoding: "utf8" }) => string[];
}>("node:fs");

const kitDirectory = "components/ui";

function sourcesIn(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => readFileSync(`${directory}/${file}`, "utf8"));
}

/**
 * Compiles the styles for every class name written in the kit's own source files, so a kit test sees
 * what NativeWind would resolve on a device for the classes the components really use. A class that a
 * component writes and the Tailwind config cannot build has no style here, and the test that expects
 * it fails. Class names a test passes to a component itself are given as `extraClassNames`, and the
 * source of a screen or component outside the kit is added by its directory in `extraDirectories`. It
 * reads from the working directory, which is the app folder when Jest runs from there.
 */
export async function compileKitStyles(
  extraClassNames = "",
  extraDirectories: readonly string[] = [],
): Promise<string> {
  const sources = [kitDirectory, ...extraDirectories].flatMap(sourcesIn);

  return compileAppStyles([...sources, extraClassNames].join("\n"));
}
