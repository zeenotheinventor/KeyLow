import { ReplayInputError } from "./replayInputError.ts";

import type { EngineParams } from "@keylow/core/engine";

export type ParamOverrides = Readonly<{
  params: EngineParams;
  /** Each override as `path=value`, in the order given, for the header line. */
  overridden: readonly string[];
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The value at `path` below `node`, or undefined when a step of the path is missing. */
function valueAt(node: unknown, path: readonly string[]): unknown {
  const [step, ...rest] = path;
  if (step === undefined) {
    return node;
  }
  return isRecord(node) ? valueAt(node[step], rest) : undefined;
}

/** Replaces the number at `path` of `root`, which was checked to exist, so the shape does not change. */
function setValueAt(root: unknown, path: readonly string[], value: number): void {
  const parent = valueAt(root, path.slice(0, -1));
  const last = path.at(-1);
  if (isRecord(parent) && last !== undefined) {
    parent[last] = value;
  }
}

function parseOverride(override: string): { path: readonly string[]; text: string; value: string } {
  const separator = override.indexOf("=");
  if (separator === -1) {
    throw new ReplayInputError("--param needs the form path=value, for example trend.alpha=0.2.");
  }
  const text = override.slice(0, separator);
  return { path: text.split("."), text, value: override.slice(separator + 1) };
}

/**
 * The params with each `path=value` override applied, for tuning (`--param expenditure.processSdKcalPerWeek=60`).
 * Only a number can be overridden, and the path must exist, so a typo is an error and never a silent no-op.
 * A message names the path and never the value. Nothing checks that the result is a sensible engine: the
 * floors the params document (for example `minWeighDays` of at least 3) are the tuner's to keep.
 */
export function applyParamOverrides(
  base: EngineParams,
  overrides: readonly string[],
): ParamOverrides {
  let params: EngineParams = base;
  for (const override of overrides) {
    const { path, text, value } = parseOverride(override);
    const current = valueAt(params, path);
    if (current === undefined) {
      throw new ReplayInputError(`--param ${text}: no such parameter.`);
    }
    if (typeof current !== "number") {
      throw new ReplayInputError(`--param ${text}: not a number parameter.`);
    }
    const number = Number(value);
    if (value.trim() === "" || !Number.isFinite(number)) {
      throw new ReplayInputError(`--param ${text}: the value must be a number.`);
    }
    const next: EngineParams = structuredClone(params);
    setValueAt(next, path, number);
    params = next;
  }
  return { params, overridden: overrides };
}
