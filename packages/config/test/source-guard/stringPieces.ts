import ts from "typescript";

/** A run of text inside the source: a string, or one part of a template literal. */
export type StringPiece =
  ts.StringLiteralLike | ts.TemplateHead | ts.TemplateMiddle | ts.TemplateTail;

export const isStringPiece = (node: ts.Node): node is StringPiece =>
  ts.isStringLiteralLike(node) ||
  ts.isTemplateHead(node) ||
  ts.isTemplateMiddle(node) ||
  ts.isTemplateTail(node);

/** Calls `visit` for every node under `root`, root included. */
export function visitNodes(root: ts.Node, visit: (node: ts.Node) => void): void {
  visit(root);
  ts.forEachChild(root, (child) => {
    visitNodes(child, visit);
  });
}

/** Calls `visit` for every string and template part under `root`. */
export function visitStringPieces(root: ts.Node, visit: (piece: StringPiece) => void): void {
  visitNodes(root, (node) => {
    if (isStringPiece(node)) {
      visit(node);
    }
  });
}
