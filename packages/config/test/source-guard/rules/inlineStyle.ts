import ts from "typescript";

import { visitNodes } from "../stringPieces";

import type { Report, SourceContext } from "../types";

// Peels the wrappers a value can sit in, such as `{ "--bar": "40%" } as CSSProperties`.
function unwrap(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return unwrap(expression.expression);
  }
  return expression;
}

const isNameOf = (expression: ts.Expression, name: string): boolean =>
  ts.isIdentifier(expression) && expression.text === name;

/** `vars({ "--inset-top": top })`, the way NativeWind sets CSS custom properties from code. */
const isVarsCall = (expression: ts.Expression): boolean =>
  ts.isCallExpression(expression) && isNameOf(expression.expression, "vars");

const isCustomPropertyName = (name: ts.PropertyName): boolean =>
  (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) &&
  name.text.startsWith("--");

/** An object literal that holds CSS custom properties and nothing else. */
const isCustomPropertyObject = (expression: ts.Expression): boolean =>
  ts.isObjectLiteralExpression(expression) &&
  expression.properties.length > 0 &&
  expression.properties.every(
    (property) => ts.isPropertyAssignment(property) && isCustomPropertyName(property.name),
  );

/** True when a variable of this name is set from `vars(...)` anywhere in the file, as the theme provider does. */
function isSetFromVars(name: string, sourceFile: ts.SourceFile): boolean {
  let found = false;
  visitNodes(sourceFile, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer !== undefined
    ) {
      visitNodes(node.initializer, (inner) => {
        if (ts.isExpression(inner) && isVarsCall(inner)) {
          found = true;
        }
      });
    }
  });
  return found;
}

const tagNameOf = (attribute: ts.JsxAttribute): string => {
  const element = attribute.parent.parent;
  return element.tagName.getText();
};

const SKIA_PAINT_STYLES = new Set(["fill", "stroke"]);

// The value of a JSX `style` attribute is allowed when it is one of these, and flagged otherwise:
//  1. CSS custom properties, through `vars({...})` or an object literal of `--names`. A class reads
//     the property, as in `pt-[var(--inset-top)]`, so the value is runtime but the styling is a class.
//  2. A Reanimated animated style on an `Animated.*` view. A class and an animated style cannot share
//     an element, and the style comes from a hook such as `useAnimatedStyle`, never from a literal.
//  3. The status bar's `style`, which is the word `light` or `dark` and not a CSS style.
//  4. A variable set from `vars(...)` in the same file (the theme provider's scheme variables).
//  5. The word `fill` or `stroke` as a string literal. Skia's paint (and Victory's `Scatter` on top of it)
//     takes its paint style by that name, so it is a drawing mode and not a React Native style. Only those
//     two words as a plain string pass: `style="color: red"`, a template literal and any expression flag.
function isAllowedStyleValue(attribute: ts.JsxAttribute, sourceFile: ts.SourceFile): boolean {
  const initializer = attribute.initializer;
  if (initializer !== undefined && ts.isStringLiteral(initializer)) {
    return SKIA_PAINT_STYLES.has(initializer.text);
  }
  if (initializer === undefined || !ts.isJsxExpression(initializer) || !initializer.expression) {
    return false;
  }

  const value = unwrap(initializer.expression);
  const tagName = tagNameOf(attribute);

  return (
    isVarsCall(value) ||
    isCustomPropertyObject(value) ||
    (ts.isIdentifier(value) && tagName.startsWith("Animated.")) ||
    (tagName === "StatusBar" && !ts.isObjectLiteralExpression(value)) ||
    (ts.isIdentifier(value) && isSetFromVars(value.text, sourceFile))
  );
}

const isStyleName = (name: string): boolean => name === "style" || name.endsWith("Style");

// `style`, and every prop named for a style (`contentContainerStyle`, `columnWrapperStyle`). A prop
// that ends in `Style` but takes a word (`indicatorStyle="white"`) is not a style object, so only an
// expression is read. A style passed by spreading props (`{...{ style }}`) is beyond what is read.
const isStyleProp = (attribute: ts.JsxAttribute): boolean => {
  const name = attribute.name.getText();
  return (
    name === "style" ||
    (name.endsWith("Style") &&
      attribute.initializer !== undefined &&
      ts.isJsxExpression(attribute.initializer))
  );
};

const nameText = (name: ts.PropertyName): string =>
  ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : "";

// React Navigation takes styles in its options (`contentStyle`, `sceneStyle`). They are allowed when
// every value is read from the theme's colours (`colors.background`), so the colour stays a token.
function isThemeColourStyle(value: ts.ObjectLiteralExpression): boolean {
  return value.properties.every(
    (property) =>
      ts.isPropertyAssignment(property) &&
      ts.isPropertyAccessExpression(property.initializer) &&
      isNameOf(property.initializer.expression, "colors"),
  );
}

/** A `style` that is not a CSS custom property, an animated style or a colour from the theme. */
export function checkInlineStyle({ path, sourceFile }: SourceContext, report: Report): void {
  const readsNavigationOptions = path.startsWith("apps/");

  visitNodes(sourceFile, (node) => {
    if (ts.isJsxAttribute(node) && isStyleProp(node)) {
      if (!isAllowedStyleValue(node, sourceFile)) {
        report(
          "inline-style",
          node,
          "A style is a class, or a CSS custom property for a runtime value",
        );
      }
    } else if (
      readsNavigationOptions &&
      ts.isPropertyAssignment(node) &&
      isStyleName(nameText(node.name)) &&
      ts.isObjectLiteralExpression(node.initializer) &&
      !isThemeColourStyle(node.initializer)
    ) {
      report(
        "inline-style",
        node,
        `${nameText(node.name)} may hold only colours read from the theme`,
      );
    }
  });
}
