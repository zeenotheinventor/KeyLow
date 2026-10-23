import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const homebrewBlender = "/opt/homebrew/bin/blender";
const blenderScriptsFolder = resolve(import.meta.dirname, "../blender");

type BlenderCommand = {
  executable: string;
  args: string[];
};

/** The BLENDER environment variable, else the Homebrew install, else blender on the path. */
export function findBlenderExecutable(
  environment: Record<string, string | undefined>,
  fileExists: (path: string) => boolean = existsSync,
): string {
  if (environment.BLENDER) {
    return environment.BLENDER;
  }
  return fileExists(homebrewBlender) ? homebrewBlender : "blender";
}

/** Everything after the double dash is for the Python script, Blender ignores it. */
export function blenderCommand(
  executable: string,
  scriptName: string,
  scriptArgs: string[],
): BlenderCommand {
  return {
    executable,
    args: [
      "--background",
      "--factory-startup",
      "--disable-autoexec",
      "--python",
      join(blenderScriptsFolder, `${scriptName}.py`),
      "--",
      ...scriptArgs,
    ],
  };
}

/** Runs one script under blender/ and returns Blender's exit code, or 127 when Blender is not installed. */
export function runBlender(scriptName: string, scriptArgs: string[]): number {
  const command = blenderCommand(findBlenderExecutable(process.env), scriptName, scriptArgs);
  const result = spawnSync(command.executable, command.args, { stdio: "inherit" });
  if (result.error) {
    if ("code" in result.error && result.error.code === "ENOENT") {
      console.error("Blender not found. Set BLENDER or install it.");
      return 127;
    }
    throw result.error;
  }
  return result.status ?? 1;
}
