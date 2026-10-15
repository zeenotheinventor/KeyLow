import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

// The barrels of core that hold what the apps display: format, copy, search and the food helpers.
const helperBarrels = ["format", "copy", "search", "foods"];

/** The lower-case names a module exports as a function or a `const`. Constants are upper case. */
function lowerCaseExportNames(source: string): string[] {
  const sourceFile = ts.createSourceFile("module.ts", source, ts.ScriptTarget.Latest, true);
  const names: string[] = [];

  for (const statement of sourceFile.statements) {
    const isExported = ts
      .getModifiers(statement as ts.HasModifiers)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) {
      continue;
    }
    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
      names.push(statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          names.push(declaration.name.text);
        }
      }
    }
  }

  return names.filter((name) => /^[a-z]/.test(name));
}

/**
 * The functions a barrel exports: the ones it names, and, for an `export * from "./module"` line, the
 * lower-case functions of that module, read through `readModuleSource`. Constants are upper case, and
 * types are `export type`.
 */
export function exportedFunctionNames(
  source: string,
  readModuleSource: (specifier: string) => string,
): string[] {
  const sourceFile = ts.createSourceFile("index.ts", source, ts.ScriptTarget.Latest, true);
  const names: string[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) {
      continue;
    }
    if (statement.exportClause === undefined) {
      if (
        statement.moduleSpecifier !== undefined &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        names.push(...lowerCaseExportNames(readModuleSource(statement.moduleSpecifier.text)));
      }
    } else if (ts.isNamedExports(statement.exportClause)) {
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
    helperBarrels.flatMap((barrel) => {
      const barrelDirectory = join(root, "packages/core/src", barrel);
      return exportedFunctionNames(
        readFileSync(join(barrelDirectory, "index.ts"), "utf8"),
        (specifier) => readFileSync(join(barrelDirectory, `${specifier}.ts`), "utf8"),
      );
    }),
  );
}
