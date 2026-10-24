import { parseArgs } from "node:util";

import { DEFAULT_ENGINE_PARAMS, ENGINE_VERSION } from "@keylow/core/engine";

import { fixtureInput } from "./fixtures.ts";
import { formatTable } from "./format.ts";
import { historyToInput } from "./historyInput.ts";
import { parseHistory } from "./historySchema.ts";
import { applyParamOverrides } from "./paramOverrides.ts";
import { replay } from "./replay.ts";
import { ReplayInputError } from "./replayInputError.ts";

import type { ReplayInput } from "./replay.ts";

const USAGE = "Usage: replay (--fixture <name> | --file <path>) [--json] [--param path=value]...";

type Source = Readonly<{ label: string; input: ReplayInput }>;

function parseOptions(args: readonly string[]) {
  try {
    return parseArgs({
      args: [...args],
      options: {
        fixture: { type: "string" },
        file: { type: "string" },
        json: { type: "boolean" },
        param: { type: "string", multiple: true },
      },
      allowPositionals: false,
    }).values;
  } catch {
    throw new ReplayInputError(`Unknown or incomplete option. ${USAGE}`);
  }
}

function sourceOf(
  { fixture, file }: Readonly<{ fixture?: string | undefined; file?: string | undefined }>,
  readTextFile: (path: string) => string,
): Source {
  if (fixture !== undefined && file !== undefined) {
    throw new ReplayInputError("Pass --fixture or --file, not both.");
  }
  if (fixture !== undefined) {
    return { label: `the ${fixture} fixture`, input: fixtureInput(fixture) };
  }
  if (file !== undefined) {
    let text: string;
    try {
      text = readTextFile(file);
    } catch {
      throw new ReplayInputError("The history file cannot be read.");
    }
    return { label: file, input: historyToInput(parseHistory(text)) };
  }
  throw new ReplayInputError(`Pass --fixture <name> or --file <path>. ${USAGE}`);
}

/** What one command prints: the rows or the table on stdout, and a header that must not touch stdout on stderr. */
export type ReplayOutput = Readonly<{ stdout: string; stderr: string }>;

/**
 * Runs one `replay` command and returns what it prints. The table is a header of two lines and the rows. With
 * `--json` stdout is the rows alone, so it still parses, and when params were overridden the two header lines
 * go to stderr so that the override is not lost. A problem with the arguments or the file is a
 * `ReplayInputError`. The file is read through `readTextFile`, so the tool reads nothing else and has no way
 * to reach a database.
 */
export function runReplay(
  argv: readonly string[],
  readTextFile: (path: string) => string,
): ReplayOutput {
  // pnpm hands the lone double dash of `pnpm replay -- --fixture golden` on to the script, so it is dropped here.
  const options = parseOptions(argv[0] === "--" ? argv.slice(1) : argv);
  const source = sourceOf(options, readTextFile);
  const { params, overridden } = applyParamOverrides(DEFAULT_ENGINE_PARAMS, options.param ?? []);
  const rows = replay(source.input, params);

  const header = [
    `Replay of ${source.label}`,
    overridden.length === 0
      ? `Params: ${ENGINE_VERSION}`
      : `Params: not ${ENGINE_VERSION} (${overridden.join(", ")})`,
  ].join("\n");
  if (options.json === true) {
    return { stdout: JSON.stringify(rows, null, 2), stderr: overridden.length === 0 ? "" : header };
  }
  const table = rows.length === 0 ? "No check-in is due yet." : formatTable(rows);
  return { stdout: `${header}\n\n${table}`, stderr: "" };
}
