import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { transitionDuration, transitionTimingFunction } from "@keylow/tokens";

import type { Config } from "tailwindcss";

type Theme = NonNullable<Config["theme"]>;
type Keyframes = NonNullable<Theme["keyframes"]>;
type Animations = Record<string, string>;

const tokens: Record<string, Record<string, string>> = {
  transitionDuration,
  transitionTimingFunction,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function replaceTokens(value: string, file: string): string {
  return value.replace(/\{(\w+)\.(\w+)\}/g, (placeholder, group: string, name: string) => {
    const token = tokens[group]?.[name];
    if (token === undefined) {
      throw new Error(`${file} uses ${placeholder}, which is not a token`);
    }
    return token;
  });
}

function mergeDistinct<Value>(
  into: Record<string, Value>,
  from: Record<string, Value>,
  kind: string,
  file: string,
  owners: Map<string, string>,
): void {
  for (const [name, value] of Object.entries(from)) {
    const owner = owners.get(`${kind}:${name}`);
    if (owner !== undefined) {
      throw new Error(`The ${kind} "${name}" is defined in both ${owner} and ${file}`);
    }
    owners.set(`${kind}:${name}`, file);
    into[name] = value;
  }
}

/**
 * Reads every `*.json` file in `directory`, one animation each, and merges them into the `keyframes`
 * and `animation` of the Tailwind theme. A file holds `keyframes` and `animation`, either of them
 * optional, and an animation's `{transitionDuration.x}` is replaced with the token. It reads files with
 * `fs` so it works the same under Tailwind's loader, Vitest and Storybook's webpack.
 */
export function loadAnimations(directory: string): { keyframes: Keyframes; animation: Animations } {
  const keyframes: Keyframes = {};
  const animation: Animations = {};
  const owners = new Map<string, string>();

  for (const file of readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort()) {
    const content: unknown = JSON.parse(readFileSync(path.join(directory, file), "utf8"));
    if (!isRecord(content)) {
      throw new Error(`${file} must hold an object with keyframes and animation`);
    }
    if (isRecord(content.keyframes)) {
      mergeDistinct(keyframes, content.keyframes, "keyframe", file, owners);
    }
    if (isRecord(content.animation)) {
      const entries = Object.entries(content.animation).flatMap(([name, value]) =>
        typeof value === "string" ? [[name, replaceTokens(value, file)] as const] : [],
      );
      mergeDistinct(animation, Object.fromEntries(entries), "animation", file, owners);
    }
  }
  return { keyframes, animation };
}
