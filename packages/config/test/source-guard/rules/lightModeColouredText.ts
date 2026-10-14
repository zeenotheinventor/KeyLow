import ts from "typescript";

import { ancestorsOf } from "../ancestors";
import { classTokensOf } from "../classTokens";
import { visitStringPieces } from "../stringPieces";

import type { ClassToken } from "../classTokens";
import type { StringPiece } from "../stringPieces";
import type { Report, SourceContext } from "../types";

// Light-mode colour treatment (Q14): light-mode small text is not coloured. The accent, the status
// colours and the macro colours are a dot, a bar, a border or a `*-muted` fill, and the words stay in
// the text colours. In dark every pair passes 4.5:1, so coloured text is fine there. A coloured text
// class is therefore allowed only when something scopes it to dark. These are the patterns that do.
const colouredTextClass =
  /^text-(?:danger|warning|success|accent|protein|carbs|fat|calories)(?:\/[\w.[\]%]+)?$/;

const withoutOpacity = (utility: string): string => utility.replace(/\/.*$/, "");

// 1. `dark:text-warning`: the variant itself, on mobile, where NativeWind follows the app's scheme.
//    On web it is not accepted: Tailwind compiles `dark:` to `prefers-color-scheme`, so a person who
//    picks Light on a dark system would still see coloured text. Web scopes with `light-theme:` (2).
const isDarkVariant = (token: ClassToken, path: string): boolean =>
  path.startsWith("apps/mobile/") && token.variants.includes("dark");

// 2. `text-warning light-theme:text-text-primary`: the web's way. The same class string takes the
//    colour back in light with a text colour that is not coloured, so the colour only shows in dark.
function hasLightTextOverride(tokens: ClassToken[]): boolean {
  return tokens.some(
    (token) =>
      token.variants.includes("light-theme") &&
      token.utility.startsWith("text-") &&
      !colouredTextClass.test(token.utility),
  );
}

// 3. `scheme === "light" ? "text-text-primary" : "text-accent"`: the mobile way. The colour sits in
//    the branch that only runs in dark. The check is read for what it implies about the scheme.
const schemeName = /scheme|theme/i;

function impliesDark(condition: ts.Expression, whenTruthy: boolean): boolean {
  if (ts.isParenthesizedExpression(condition)) {
    return impliesDark(condition.expression, whenTruthy);
  }

  if (
    ts.isPrefixUnaryExpression(condition) &&
    condition.operator === ts.SyntaxKind.ExclamationToken
  ) {
    return impliesDark(condition.operand, !whenTruthy);
  }

  if (!ts.isBinaryExpression(condition)) {
    return false;
  }

  const operator = condition.operatorToken.kind;

  if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
    return whenTruthy
      ? impliesDark(condition.left, true) || impliesDark(condition.right, true)
      : impliesDark(condition.left, false) && impliesDark(condition.right, false);
  }

  if (operator === ts.SyntaxKind.BarBarToken) {
    return whenTruthy
      ? impliesDark(condition.left, true) && impliesDark(condition.right, true)
      : impliesDark(condition.left, false) || impliesDark(condition.right, false);
  }

  const isEquality =
    operator === ts.SyntaxKind.EqualsEqualsEqualsToken ||
    operator === ts.SyntaxKind.EqualsEqualsToken;
  const isInequality =
    operator === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
    operator === ts.SyntaxKind.ExclamationEqualsToken;
  if (!isEquality && !isInequality) {
    return false;
  }

  const isLiteralOnTheRight = ts.isStringLiteral(condition.right);
  const literal = isLiteralOnTheRight ? condition.right : condition.left;
  const other = isLiteralOnTheRight ? condition.left : condition.right;
  if (!ts.isStringLiteral(literal) || !schemeName.test(other.getText())) {
    return false;
  }

  const darkWhenEqual = literal.text === "dark";
  const lightWhenEqual = literal.text === "light";
  if (!darkWhenEqual && !lightWhenEqual) {
    return false;
  }

  // `scheme === "dark"` is dark when true. `scheme !== "light"` is the same. The falsy cases mirror them.
  const isDarkWhenTrue = isEquality ? darkWhenEqual : lightWhenEqual;
  return whenTruthy ? isDarkWhenTrue : !isDarkWhenTrue;
}

function isInDarkOnlyBranch(piece: StringPiece): boolean {
  for (const { child, ancestor } of ancestorsOf(piece)) {
    if (ts.isConditionalExpression(ancestor)) {
      if (child === ancestor.whenTrue && impliesDark(ancestor.condition, true)) {
        return true;
      }
      if (child === ancestor.whenFalse && impliesDark(ancestor.condition, false)) {
        return true;
      }
    }
  }

  return false;
}

// 4. `darkTextClassName: "text-accent"`: a property that is named for dark and used only there.
function isInDarkNamedProperty(piece: StringPiece): boolean {
  for (const { ancestor } of ancestorsOf(piece)) {
    if (
      ts.isPropertyAssignment(ancestor) &&
      ts.isIdentifier(ancestor.name) &&
      /^dark[A-Z]/.test(ancestor.name.text)
    ) {
      return true;
    }
  }
  return false;
}

// 5. A field's error caption. The approved boards draw it in danger text in light as well as dark: the
//    sign-in and sign-up field errors, the food form's validation errors, the barcode lookup's
//    "invalid" message, and the scan screen's. It is small text with `role="alert"`, so the pattern is
//    exactly that: danger text, a `text-caption` size, and an alert role on the same element.
function classAttributeOf(piece: StringPiece): ts.JsxAttribute | undefined {
  for (const { ancestor } of ancestorsOf(piece)) {
    if (ts.isJsxAttribute(ancestor)) {
      return ancestor.name.getText() === "className" ? ancestor : undefined;
    }
  }
  return undefined;
}

function isAlertCaption(piece: StringPiece, utility: string): boolean {
  const attribute = classAttributeOf(piece);
  if (attribute === undefined || withoutOpacity(utility) !== "text-danger") {
    return false;
  }

  const role = attribute.parent.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.getText() === "role",
  );
  const isCaption = /(?:^|[\s"'`])text-caption(?![\w-])/.test(attribute.getText());

  return isCaption && role !== undefined && role.getText().includes("alert");
}

/** Coloured text in light mode: a coloured text class nothing scopes to dark. */
export function checkLightModeColouredText(
  { path, sourceFile }: SourceContext,
  report: Report,
): void {
  // Only the apps draw text. A package can name a class in data without it being on screen.
  if (!path.startsWith("apps/")) {
    return;
  }

  visitStringPieces(sourceFile, (piece) => {
    const tokens = classTokensOf(piece.text);
    const isTakenBackInLight = hasLightTextOverride(tokens);

    for (const token of tokens) {
      if (!colouredTextClass.test(token.utility) || isDarkVariant(token, path)) {
        continue;
      }

      const isLightVariant = token.variants.includes("light-theme");
      const isScoped =
        !isLightVariant &&
        (isTakenBackInLight ||
          isInDarkOnlyBranch(piece) ||
          isInDarkNamedProperty(piece) ||
          isAlertCaption(piece, token.utility));

      if (!isScoped) {
        const className = withoutOpacity(token.utility);
        report(
          "light-mode-coloured-text",
          piece,
          `${token.raw} is coloured small text in light mode. Use a dot, bar, border or muted fill, with the words in text-text-primary or text-text-secondary`,
          className,
        );
      }
    }
  });
}
