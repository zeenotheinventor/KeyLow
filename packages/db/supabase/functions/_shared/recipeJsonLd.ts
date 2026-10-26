// Reads the schema.org Recipe from a fetched page's JSON-LD, so most imports need no model at all.
// The page is untrusted data. Every string in it is content: this decodes entities and tidies
// whitespace and nothing else, so an instruction hidden in an ingredient line comes back as that
// line, word for word. Nothing here is interpreted, executed or logged.
import { cutToLimit, decodeHtmlEntities, stripControlCharacters } from "./recipePageText.ts";

export type RecipeJsonLd = {
  name: string;
  // The first number in the yield ("Serves 6" is 6), or null when the yield has none.
  servings: number | null;
  // The yield as the page wrote it, for the person to see.
  yieldText: string | null;
  ingredientLines: string[];
  // Steps in order, with HowToSection groups flattened and their headings dropped.
  steps: string[];
};

type JsonObject = Record<string, unknown>;

// Deep enough for any real @graph, shallow enough that a hostile page cannot exhaust the stack.
const maximumDepth = 8;

// A hostile page can hold two million bytes of lines, so the reader stays within these. A real recipe
// is far smaller.
const maximumLines = 100;
const maximumLineCharacters = 500;
// A yield is a count of servings, so a number above this is something else.
const maximumServings = 100;

const numberPattern = /\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi;
const unitAfterNumberPattern =
  /^\s*(?:g|kg|mg|ml|l|oz|lbs?|cups?|tbsp|tsp|litres?|liters?|pounds?|ounces?|pints?|quarts?|kilos?)\b/i;
const typeAttributePattern = /(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const recipeTypePattern = /^(?:https?:\/\/schema\.org\/)?Recipe$/;
const lineBreakPattern = /\r\n|\r|\n/;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Entities decoded, control characters (NUL above all) removed, lone surrogates replaced with U+FFFD
// (Postgres rejects both), whitespace collapsed and the line cut to the cap. Nothing else changes,
// so the words of an instruction come back as written.
function normaliseText(text: string): string {
  const tidy = stripControlCharacters(decodeHtmlEntities(text))
    .replace(/\s+/g, " ")
    .trim()
    .toWellFormed();
  return cutToLimit(tidy, maximumLineCharacters).trimEnd();
}

function isNotEmpty(text: string): boolean {
  return text !== "";
}

// Lower-cases A to Z only, so every index in the copy is an index in the page.
function asciiLowerCase(text: string): string {
  return text.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

// The text of each `<script type="application/ld+json">` block. Found with a single forward scan:
// when a tag has no `>` or a script has no closing tag, no later script can succeed either, so the
// scan stops. That keeps a page of broken tags linear.
function jsonLdScriptBodies(html: string): string[] {
  const lowerCase = asciiLowerCase(html);
  const bodies: string[] = [];
  let position = 0;
  for (;;) {
    const start = lowerCase.indexOf("<script", position);
    if (start === -1) {
      break;
    }
    const attributesStart = start + "<script".length;
    if (!/[\s>/]/.test(lowerCase.charAt(attributesStart))) {
      position = attributesStart;
      continue;
    }
    const tagEnd = lowerCase.indexOf(">", attributesStart);
    if (tagEnd === -1) {
      break;
    }
    const closing = lowerCase.indexOf("</script", tagEnd + 1);
    if (closing === -1) {
      break;
    }
    const type = typeAttributePattern.exec(html.slice(attributesStart, tagEnd));
    const typeValue = (type?.[1] ?? type?.[2] ?? type?.[3] ?? "").trim().toLowerCase();
    if (typeValue === "application/ld+json") {
      bodies.push(html.slice(tagEnd + 1, closing));
    }
    position = closing + "</script".length;
  }
  return bodies;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isRecipe(node: JsonObject): boolean {
  const type = node["@type"];
  const types = Array.isArray(type) ? type : [type];
  return types.some((name) => typeof name === "string" && recipeTypePattern.test(name));
}

// Every Recipe node reachable through arrays and @graph, in document order.
function* recipeNodes(value: unknown, depth = 0): Generator<JsonObject> {
  if (depth > maximumDepth) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      yield* recipeNodes(item, depth + 1);
    }
  } else if (isObject(value)) {
    if (isRecipe(value)) {
      yield value;
    }
    yield* recipeNodes(value["@graph"], depth + 1);
  }
}

function textList(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : [value];
  return entries
    .filter((entry): entry is string => typeof entry === "string")
    .map(normaliseText)
    .filter(isNotEmpty)
    .slice(0, maximumLines);
}

function stepsFrom(value: unknown, depth = 0): string[] {
  if (depth > maximumDepth) {
    return [];
  }
  if (typeof value === "string") {
    return [normaliseText(value)].filter(isNotEmpty);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => stepsFrom(item, depth + 1));
  }
  if (!isObject(value)) {
    return [];
  }
  if (value.itemListElement !== undefined) {
    return stepsFrom(value.itemListElement, depth + 1);
  }
  const hasText = typeof value.text === "string" && normaliseText(value.text) !== "";
  return stepsFrom(hasText ? value.text : value.name, depth + 1);
}

function readSteps(instructions: unknown): string[] {
  const steps =
    typeof instructions === "string"
      ? instructions.split(lineBreakPattern).map(normaliseText).filter(isNotEmpty)
      : stepsFrom(instructions);
  return steps.slice(0, maximumLines);
}

// The first number in a yield that can be a count of servings: not an amount ("500 g"), and from 1
// to 100. "Serves 6" gives 6, "1.5 kg, serves 6" gives 6 and "500 g" gives null.
function firstServingsNumber(text: string): number | null {
  for (const match of text.matchAll(numberPattern)) {
    const followedByUnit = unitAfterNumberPattern.test(text.slice(match.index + match[0].length));
    const value = Number(match[0]);
    if (!followedByUnit && value >= 1 && value <= maximumServings) {
      return value;
    }
  }
  return null;
}

function readYield(recipeYield: unknown): Pick<RecipeJsonLd, "servings" | "yieldText"> {
  const entries = Array.isArray(recipeYield) ? recipeYield : [recipeYield];
  const texts = entries
    .map((entry) => (typeof entry === "number" ? String(entry) : entry))
    .filter((entry): entry is string => typeof entry === "string")
    .map(normaliseText)
    .filter(isNotEmpty);
  for (const text of texts) {
    const servings = firstServingsNumber(text);
    if (servings !== null) {
      return { servings, yieldText: texts[0] };
    }
  }
  return { servings: null, yieldText: texts[0] ?? null };
}

function readRecipe(node: JsonObject): RecipeJsonLd | null {
  const name = typeof node.name === "string" ? normaliseText(node.name) : "";
  const ingredientLines = textList(node.recipeIngredient);
  // A Recipe with no name or no ingredients gives the import nothing to work with, so the reader
  // moves on and the model fallback can still read the page.
  if (name === "" || ingredientLines.length === 0) {
    return null;
  }
  return {
    name,
    ...readYield(node.recipeYield),
    ingredientLines,
    steps: readSteps(node.recipeInstructions),
  };
}

// The first usable Recipe in the page's JSON-LD, or null when there is none. A script block that is
// not valid JSON is skipped, and nothing here throws on a hostile page.
export function readRecipeJsonLd(html: string): RecipeJsonLd | null {
  for (const body of jsonLdScriptBodies(html)) {
    for (const node of recipeNodes(parseJson(body))) {
      const recipe = readRecipe(node);
      if (recipe !== null) {
        return recipe;
      }
    }
  }
  return null;
}
