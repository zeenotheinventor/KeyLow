import ts from "typescript";

/** The nodes above `node`, nearest first, each with the child it was reached through. */
export function* ancestorsOf(node: ts.Node): Generator<{ child: ts.Node; ancestor: ts.Node }> {
  let child = node;
  let ancestor = node.parent;

  while (!ts.isSourceFile(ancestor)) {
    yield { child, ancestor };
    child = ancestor;
    ancestor = ancestor.parent;
  }
}
