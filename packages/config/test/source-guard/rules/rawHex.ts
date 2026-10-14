import { visitStringPieces } from "../stringPieces";

import type { Report, SourceContext } from "../types";

// Three or four digits for a short colour, six or eight for a full one. The lookbehind keeps a word
// such as `item#abc1` from reading as a colour.
const hexColour = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;

export const hexColoursIn = (text: string): string[] =>
  [...text.matchAll(hexColour)].map((match) => match[0]);

/** A hex colour in a string. A comment can name one, so only strings are read. */
export function checkRawHex({ sourceFile }: SourceContext, report: Report): void {
  visitStringPieces(sourceFile, (piece) => {
    for (const colour of hexColoursIn(piece.text)) {
      report("raw-hex", piece, `The raw colour ${colour} belongs in packages/tokens`, colour);
    }
  });
}
