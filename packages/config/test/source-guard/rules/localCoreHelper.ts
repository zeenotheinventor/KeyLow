import ts from "typescript";

import { visitNodes } from "../stringPieces";

import type { Report, SourceContext } from "../types";

const isFunctionValue = (node: ts.Expression | undefined): boolean =>
  node !== undefined && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));

/**
 * A function declared under the name of a core helper. Format and copy live in `@keylow/core`, once,
 * so a second one in an app or package is a copy that drifts. Core's own files are not read.
 */
export function checkLocalCoreHelper(
  { path, sourceFile, coreHelperNames }: SourceContext,
  report: Report,
): void {
  if (path.startsWith("packages/core/")) {
    return;
  }

  visitNodes(sourceFile, (node) => {
    const name =
      ts.isFunctionDeclaration(node) && node.name !== undefined
        ? node.name.text
        : ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            isFunctionValue(node.initializer)
          ? node.name.text
          : undefined;

    if (name !== undefined && coreHelperNames.has(name)) {
      report(
        "local-core-helper",
        node,
        `${name} is a core helper. Import it from @keylow/core instead of declaring it here`,
        name,
      );
    }
  });
}
