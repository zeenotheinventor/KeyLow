// Runs a Blender script from the command line and passes Blender's exit code through.
//
//   pnpm --filter @keylow/body-model inspect --source <folder holding the bundle>
//   pnpm --filter @keylow/body-model render --source <folder holding the bundle>
import { runBlender } from "./runBlender.ts";

const [scriptName, ...scriptArgs] = process.argv.slice(2);

if (!scriptName) {
  console.error("Usage: run.ts <script name under blender/> [script arguments]");
  process.exit(2);
}

process.exit(runBlender(scriptName, scriptArgs));
