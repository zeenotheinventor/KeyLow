import ts from "typescript";

import { visitNodes } from "../stringPieces";

import type { Report, SourceContext } from "../types";

const functionsRoot = "packages/db/supabase/functions/";

// The one file that writes to the console, and the test support that swaps the console for a recorder.
const exemptPaths = new Set([
  `${functionsRoot}_shared/log.ts`,
  `${functionsRoot}_shared/assistant/testing.ts`,
]);

// The objects that hold the console as a property.
const globalObjects = new Set(["globalThis", "self", "window", "global"]);

const isGlobalObject = (node: ts.Expression): boolean =>
  ts.isIdentifier(node) && globalObjects.has(node.text);

// True when the identifier only names something: a property, a member or a declaration, not the console.
function isNameOnly(node: ts.Identifier): boolean {
  const { parent } = node;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
    return true;
  }
  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isEnumMember(parent)) &&
    parent.name === node
  ) {
    return true;
  }
  return (
    (ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isBindingElement(parent) ||
      ts.isImportSpecifier(parent)) &&
    parent.name === node
  );
}

const consoleModules = new Set(["console", "node:console"]);

const isConsoleModule = (node: ts.Node | undefined): boolean =>
  node !== undefined && ts.isStringLiteralLike(node) && consoleModules.has(node.text);

const describe = (node: ts.Node): string => node.getText().replace(/\s+/g, " ").slice(0, 40);

/**
 * Any way of reaching the console in an Edge Function: the identifier `console` anywhere it is a
 * value (called, read, passed on, spread, destructured or aliased), and the console taken from
 * `globalThis`, `self`, `window` or `global` by a name or by a computed key, and an import or
 * require of the `console` module. Every log line goes
 * through `logLine`, which takes only allow-listed fields, so a health value cannot reach the logs by
 * a free-text message. Tests are not read by the guard.
 */
export function checkRawConsole({ path, sourceFile }: SourceContext, report: Report): void {
  if (!path.startsWith(functionsRoot) || exemptPaths.has(path)) {
    return;
  }

  const flag = (node: ts.Node): void => {
    report(
      "raw-console-in-function",
      node,
      `${describe(node)} reaches the console and bypasses the allow list. Write the line with logLine from _shared/log.ts`,
      describe(node),
    );
  };

  visitNodes(sourceFile, (node) => {
    if (ts.isIdentifier(node) && node.text === "console" && !isNameOnly(node)) {
      // `console.log` reads better in the report than `console`.
      flag(ts.isPropertyAccessExpression(node.parent) ? node.parent : node);
    } else if (
      ts.isPropertyAccessExpression(node) &&
      isGlobalObject(node.expression) &&
      node.name.text === "console"
    ) {
      flag(node);
    } else if (ts.isImportDeclaration(node) && isConsoleModule(node.moduleSpecifier)) {
      flag(node);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
      isConsoleModule(node.arguments[0])
    ) {
      flag(node);
    } else if (ts.isElementAccessExpression(node) && isGlobalObject(node.expression)) {
      // A computed key on the global object can name the console, so any of them is flagged.
      flag(node);
    }
  });
}
