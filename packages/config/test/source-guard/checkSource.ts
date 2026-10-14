import ts from "typescript";

import { isGuardedPath, isScriptPath } from "./pathPolicy";
import { checkClassNames } from "./rules/classNames";
import { checkErrorMessageInJsx } from "./rules/errorMessage";
import { checkInlineStyle } from "./rules/inlineStyle";
import { checkLightModeColouredText } from "./rules/lightModeColouredText";
import { checkLocalCoreHelper } from "./rules/localCoreHelper";
import { checkRawHex, hexColoursIn } from "./rules/rawHex";

import type { Report, RuleName, SourceContext, Violation } from "./types";

type SourceInput = {
  path: string;
  source: string;
  coreHelperNames: ReadonlySet<string>;
};

const scriptKindOf = (path: string): ts.ScriptKind => {
  if (path.endsWith("x")) {
    return ts.ScriptKind.TSX;
  }
  return /\.[cm]?js$/.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
};

// Colours are the one rule that applies to stylesheets as well. The design's colours are written once,
// in packages/tokens, and every other place reads them through a class or a variable.
const mayHoldRawColours = (path: string): boolean => !path.startsWith("packages/tokens/");

const blankedComments = (css: string): string =>
  css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));

function checkStylesheet(path: string, css: string): Violation[] {
  return blankedComments(css)
    .split("\n")
    .flatMap((text, index) =>
      hexColoursIn(text).map((colour): Violation => ({
        rule: "raw-hex",
        path,
        line: index + 1,
        detail: colour,
        message: `The raw colour ${colour} belongs in packages/tokens`,
      })),
    );
}

function checkScript({ path, source, coreHelperNames }: SourceInput): Violation[] {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindOf(path),
  );
  const context: SourceContext = { path, sourceFile, coreHelperNames };
  const violations: Violation[] = [];

  const report: Report = (rule: RuleName, node, message, detail) => {
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    violations.push(
      detail === undefined ? { rule, path, line, message } : { rule, path, line, message, detail },
    );
  };

  if (mayHoldRawColours(path)) {
    checkRawHex(context, report);
  }
  checkInlineStyle(context, report);
  checkClassNames(context, report);
  checkLightModeColouredText(context, report);
  checkErrorMessageInJsx(context, report);
  checkLocalCoreHelper(context, report);

  return violations;
}

/** Every rule applied to one file. Returns nothing for a path the guard does not read. */
export function checkSource(input: SourceInput): Violation[] {
  const { path, source } = input;

  if (!isGuardedPath(path)) {
    return [];
  }

  const violations = isScriptPath(path)
    ? checkScript(input)
    : mayHoldRawColours(path)
      ? checkStylesheet(path, source)
      : [];

  return violations.sort((first, second) => first.line - second.line);
}
