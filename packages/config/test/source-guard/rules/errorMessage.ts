import ts from "typescript";

import { visitNodes } from "../stringPieces";

import type { Report, SourceContext } from "../types";

// The text of the thing the message belongs to, such as `offError`, `result.error` or `cause`.
const errorLikeReceiver = /(?:error|err|exception|failure|cause)$/i;

function isRawErrorText(access: ts.PropertyAccessExpression): boolean {
  const property = access.name.text;
  if (property === "debugMessage") {
    return true;
  }

  const receiver = access.expression.getText().replace(/[?!]/g, "");
  return property === "message" && errorLikeReceiver.test(receiver);
}

/**
 * The raw text of a failure rendered in JSX. It can carry upstream or database wording that means
 * nothing to a person, so a screen shows the core copy for the failure's kind and never `error.message`.
 * A message copied into a variable first is beyond what a static read can follow.
 */
export function checkErrorMessageInJsx({ sourceFile }: SourceContext, report: Report): void {
  visitNodes(sourceFile, (node) => {
    if (ts.isJsxExpression(node)) {
      visitNodes(node, (inner) => {
        if (ts.isPropertyAccessExpression(inner) && isRawErrorText(inner)) {
          report(
            "error-message-in-jsx",
            inner,
            `${inner.getText()} is raw failure text. Show the core copy for the failure's kind`,
          );
        }
      });
    }
  });
}
