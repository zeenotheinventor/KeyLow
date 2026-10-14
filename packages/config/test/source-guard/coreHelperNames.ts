import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

// The barrels of core that hold what the apps display: format, copy, search and the food helpers.
const helperBarrels = ["format", "copy", "search", "foods"];

/** The functions a barrel exports by name. Constants are upper case, and types are `export type`. */
export function exportedFunctionNames(source: string): string[] {
  const sourceFile = ts.createSourceFile("index.ts", source, ts.ScriptTarget.Latest, true);
  const names: string[] = [];

  for (const statement of sourceFile.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.exportClause !== undefined &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const specifier of statement.exportClause.elements) {
        if (!specifier.isTypeOnly && /^[a-z]/.test(specifier.name.text)) {
          names.push(specifier.name.text);
        }
      }
    }
  }

  return names;
}

/** The names no app or package may declare for itself, read from core's barrels. */
export function readCoreHelperNames(root: string): Set<string> {
  return new Set(
    helperBarrels.flatMap((barrel) =>
      exportedFunctionNames(
        readFileSync(join(root, "packages/core/src", barrel, "index.ts"), "utf8"),
      ),
    ),
  );
}
