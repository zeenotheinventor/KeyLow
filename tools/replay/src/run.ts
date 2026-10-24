// The replay command: `pnpm --filter @keylow/replay replay`, then the options of the README.
//
// Replays the adaptive engine week by week over a fixture or a history file and prints one row for each
// check-in. It reads one file at most, and it has no database client and no network code.
import { readFileSync } from "node:fs";
import { register } from "node:module";

register("./resolveExtensionlessTypeScript.ts", import.meta.url);
// Imported after the hook is registered, because @keylow/core is read as source with extensionless imports.
const { runReplay } = await import("./cli.ts");
const { ReplayInputError } = await import("./replayInputError.ts");

try {
  const { stdout, stderr } = runReplay(process.argv.slice(2), (path) => readFileSync(path, "utf8"));
  if (stderr !== "") {
    console.error(stderr);
  }
  console.log(stdout);
} catch (error) {
  if (error instanceof ReplayInputError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
