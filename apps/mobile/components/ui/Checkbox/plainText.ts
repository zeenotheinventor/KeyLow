import { isValidElement } from "react";

/**
 * The words of a label that may hold links, joined as they read, so a screen reader is given the
 * sentence and not its parts. Anything that is not text or an element holding text reads as nothing.
 */
export function plainText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(plainText).join("");
  }
  if (isValidElement(node) && typeof node.props === "object" && node.props !== null) {
    return "children" in node.props ? plainText(node.props.children) : "";
  }
  return "";
}
