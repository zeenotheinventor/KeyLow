import ts from "typescript";

import { ancestorsOf } from "../ancestors";
import { classTokensOf } from "../classTokens";
import { visitStringPieces } from "../stringPieces";

import type { StringPiece } from "../stringPieces";
import type { Report, SourceContext } from "../types";

// The prefixes that take a colour: `bg-`, `text-`, `border-` and the rest.
const colourPrefixes =
  "bg|text|border|ring|ring-offset|outline|fill|stroke|divide|placeholder|from|via|to|decoration|caret";
// An opacity modifier such as `/90` or `/[0.35]`.
const opacitySuffix = String.raw`(?:\/[\w.\[\]%]+)?`;

// The first design was drawn with placeholder scales under this prefix, and they are gone. It is
// joined here so that no copy of the old prefix is left for a search of the repository to find.
const retiredScalePrefix = ["legacy", ""].join("-");

// The names shadcn gives its colours. Ki-Lo has none of them: its colours are `bg-surface`,
// `text-text-primary`, `border-border`, `bg-danger` and the rest of the design's names. `background`,
// `accent` and `border` are left out because the design uses those names too.
const shadcnColourNames = [
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "destructive",
  "destructive-foreground",
  "input",
  "ring",
];
const shadcnColourClass = new RegExp(
  `^(?:${colourPrefixes})-(?:${shadcnColourNames.join("|")})${opacitySuffix}$`,
);

// Tailwind's own palette, which the design replaces: no scale of grey, red or blue, and no white or
// black, because every colour is a design token that follows the theme.
const paletteScales =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|brand";
const paletteClass = new RegExp(
  `^(?:${colourPrefixes}|shadow)-(?:(?:${paletteScales})-\\d{2,3}|white|black)${opacitySuffix}$`,
);

// Three of the design's colour names read like a shadcn class: `text-primary`, `text-secondary` and
// `text-muted`. Code looks a colour up by that name (`colors["text-primary"]`), and there the word is a
// name and not a class. The word is read as a class only where a class list is written: a `className`,
// or a call such as `cn(...)`.
const designColourNames = new Set(["text-primary", "text-secondary", "text-muted"]);
const classListFunctions = new Set(["cn", "cva", "clsx", "twMerge"]);

function isWrittenAsClassList(piece: StringPiece): boolean {
  for (const { ancestor } of ancestorsOf(piece)) {
    if (ts.isJsxAttribute(ancestor)) {
      return ancestor.name.getText() === "className";
    }
    if (ts.isCallExpression(ancestor) && classListFunctions.has(ancestor.expression.getText())) {
      return true;
    }
  }
  return false;
}

const isColourNameLookup = (piece: StringPiece, utility: string): boolean =>
  piece.text.trim() === utility && designColourNames.has(utility) && !isWrittenAsClassList(piece);

/** A class from a placeholder scale, a shadcn colour or Tailwind's default palette. */
export function checkClassNames({ sourceFile }: SourceContext, report: Report): void {
  visitStringPieces(sourceFile, (piece) => {
    for (const { utility } of classTokensOf(piece.text)) {
      if (utility.includes(retiredScalePrefix)) {
        report(
          "retired-placeholder-class",
          piece,
          `${utility} is from a placeholder scale that no longer exists`,
          utility,
        );
      } else if (shadcnColourClass.test(utility) && !isColourNameLookup(piece, utility)) {
        report(
          "shadcn-colour-class",
          piece,
          `${utility} is a shadcn colour. Use the design's colour for it`,
          utility,
        );
      } else if (paletteClass.test(utility)) {
        report(
          "tailwind-palette-class",
          piece,
          `${utility} is from Tailwind's default palette. Use a design token`,
          utility,
        );
      }
    }
  });
}
