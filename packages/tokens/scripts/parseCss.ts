export type CssScopes = Record<string, Record<string, string>>;

const blockComment = /\/\*[\s\S]*?\*\//g;

const findClosingBrace = (text: string, openingIndex: number): number => {
  let depth = 0;
  for (let index = openingIndex; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}") depth -= 1;
    if (depth === 0) return index;
  }
  throw new Error(`Unclosed "{" in: ${text.slice(openingIndex, openingIndex + 40)}`);
};

const splitDeclarations = (body: string): string[] => {
  const declarations: string[] = [];
  let current = "";
  let parenthesisDepth = 0;
  let insideQuotes = false;
  for (const character of body) {
    if (character === '"') insideQuotes = !insideQuotes;
    if (!insideQuotes && character === "(") parenthesisDepth += 1;
    if (!insideQuotes && character === ")") parenthesisDepth -= 1;
    if (character === ";" && parenthesisDepth === 0 && !insideQuotes) {
      declarations.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  declarations.push(current);
  return declarations
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration !== "");
};

const collectScopes = (text: string, selectorPrefix: string, scopes: CssScopes): void => {
  let cursor = 0;
  while (cursor < text.length) {
    const openingIndex = text.indexOf("{", cursor);
    if (openingIndex === -1) return;
    const closingIndex = findClosingBrace(text, openingIndex);
    const header = text.slice(cursor, openingIndex).trim();
    const body = text.slice(openingIndex + 1, closingIndex);
    cursor = closingIndex + 1;

    if (header.startsWith("@keyframes")) continue;
    if (header.startsWith("@")) {
      collectScopes(body, `${selectorPrefix}${header} `, scopes);
      continue;
    }

    const scopeName = `${selectorPrefix}${header}`;
    const declarations = scopes[scopeName] ?? {};
    for (const declaration of splitDeclarations(body)) {
      const separatorIndex = declaration.indexOf(":");
      declarations[declaration.slice(0, separatorIndex).trim()] = declaration
        .slice(separatorIndex + 1)
        .trim();
    }
    scopes[scopeName] = declarations;
  }
};

/**
 * Reads a stylesheet into its declarations, keyed by selector. A rule nested in an at-rule is keyed
 * "<at-rule> <selector>". Keyframes are skipped because they hold no tokens.
 */
export const parseCssScopes = (css: string): CssScopes => {
  const scopes: CssScopes = {};
  collectScopes(css.replace(blockComment, ""), "", scopes);
  return scopes;
};
