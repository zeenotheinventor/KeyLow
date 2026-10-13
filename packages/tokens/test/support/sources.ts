import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parseCssScopes } from "../../scripts/parseCss";

import type { TokenSourceTexts } from "../../scripts/buildTokens";
import type { CssScopes } from "../../scripts/parseCss";

const sourceDirectory = fileURLToPath(new URL("../../src/source/", import.meta.url));

const readSource = (fileName: string): string =>
  readFileSync(`${sourceDirectory}${fileName}`, "utf8");

export const readSourceTexts = (): TokenSourceTexts => ({
  json: readSource("ki-lo.tokens.json"),
  colorsCss: readSource("colors.css"),
  spacingCss: readSource("spacing.css"),
  typographyCss: readSource("typography.css"),
  motionCss: readSource("motion.css"),
});

export type FlatTokens = Record<string, string>;

export type TokenJson = { dark: FlatTokens; light: FlatTokens };

const isTokenJson = (value: unknown): value is TokenJson =>
  typeof value === "object" && value !== null && "dark" in value && "light" in value;

/** The design system's JSON, as published: flat token names (no leading dashes) per theme. */
export const readTokenJson = (): TokenJson => {
  const parsed: unknown = JSON.parse(readSource("ki-lo.tokens.json"));
  if (!isTokenJson(parsed)) throw new Error("ki-lo.tokens.json has no dark and light themes");
  return parsed;
};

export const readCssScopes = (): CssScopes[] =>
  [
    readSource("colors.css"),
    readSource("spacing.css"),
    readSource("typography.css"),
    readSource("motion.css"),
  ].map(parseCssScopes);

/** The custom properties declared under one selector across every CSS file, without the dashes. */
export const customPropertiesUnder = (selector: string): FlatTokens =>
  Object.fromEntries(
    readCssScopes().flatMap((scopes) =>
      Object.entries(scopes[selector] ?? {})
        .filter(([property]) => property.startsWith("--"))
        .map(([property, value]) => [property.slice(2), value]),
    ),
  );
