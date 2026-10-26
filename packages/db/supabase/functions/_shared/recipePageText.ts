// Reads the words a person would see on a fetched page, for the model fallback when the page has no
// recipe JSON-LD. The page is untrusted data, so this only removes what is hidden and decodes
// entities. Decoded text is never read as markup, and nothing in it is interpreted. Pure string work
// with no network, no logging and no dependency.

const namedEntities = new Map<string, string>([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["nbsp", String.fromCodePoint(0xa0)],
  ["ndash", "–"],
  ["mdash", String.fromCodePoint(0x2014)],
  ["lsquo", "‘"],
  ["rsquo", "’"],
  ["ldquo", "“"],
  ["rdquo", "”"],
  ["hellip", "…"],
  ["deg", "°"],
  ["times", "×"],
  ["frac12", "½"],
  ["frac14", "¼"],
  ["frac34", "¾"],
  ["eacute", "é"],
  ["egrave", "è"],
  ["agrave", "à"],
  ["acirc", "â"],
  ["ccedil", "ç"],
  ["ntilde", "ñ"],
  ["ouml", "ö"],
  ["uuml", "ü"],
  ["auml", "ä"],
]);

const maximumCodePoint = 0x10ffff;
const firstSurrogate = 0xd800;
const lastSurrogate = 0xdfff;

function isDecodableCodePoint(codePoint: number): boolean {
  return (
    codePoint > 0 &&
    codePoint <= maximumCodePoint &&
    (codePoint < firstSurrogate || codePoint > lastSurrogate)
  );
}

// One pass only, so an entity that was itself encoded stays as text. An entity this does not know,
// or a numeric reference that is not a real character, is left exactly as written.
export function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z][a-zA-Z0-9]*));/g,
    (match: string, decimal?: string, hexadecimal?: string, name?: string) => {
      if (name !== undefined) {
        return namedEntities.get(name) ?? match;
      }
      const codePoint =
        decimal !== undefined
          ? Number.parseInt(decimal, 10)
          : Number.parseInt(hexadecimal ?? "", 16);
      return isDecodableCodePoint(codePoint) ? String.fromCodePoint(codePoint) : match;
    },
  );
}

// NUL cannot be stored in Postgres text or jsonb, and the other C0 and C1 controls are never part
// of a recipe. They are removed so the words around them join up. Normal whitespace (tab, line
// feed, vertical tab, form feed, carriage return) stays for the caller to collapse. Right-to-left
// marks such as U+202E and zero-width characters stay as ordinary text, because removing them would
// alter the words of an instruction and they cannot corrupt storage.
export function stripControlCharacters(text: string): string {
  let result = "";
  let runStart = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    const isControl = code < 9 || (code > 13 && code < 32) || (code >= 127 && code <= 159);
    if (isControl) {
      result += text.slice(runStart, index);
      runStart = index + 1;
    }
  }
  return runStart === 0 ? text : result + text.slice(runStart);
}

// Elements whose whole subtree is not part of the visible page.
const droppedElements = new Set(["head", "noscript", "template", "svg", "iframe"]);
// Elements whose content is raw text, not markup. Everything up to the closing tag is skipped.
const rawTextElements = new Set(["script", "style"]);
const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);
const lineBreakingElements = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "br",
  "dd",
  "details",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tr",
  "ul",
]);
const cellElements = new Set(["td", "th"]);
// An element of one of these kinds ends an open one of the same kind that is still on top.
const impliedEndElements = new Set(["li", "p", "dd", "dt", "td", "th", "tr", "option"]);

const tagNamePattern = /[a-zA-Z][a-zA-Z0-9:-]*/y;
const hiddenStylePattern = /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i;
const attributePattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function isMarkedHidden(attributeText: string): boolean {
  for (const match of attributeText.matchAll(attributePattern)) {
    const name = match[1].toLowerCase();
    const value = (match[2] ?? match[3] ?? match[4] ?? "").trim();
    if (name === "hidden") {
      return true;
    }
    if (name === "aria-hidden" && value.toLowerCase() === "true") {
      return true;
    }
    if (name === "style" && hiddenStylePattern.test(value)) {
      return true;
    }
  }
  return false;
}

// The index just past the end of `<!-- ... -->` or of a raw text element, or the end of the page when
// it is never closed.
function indexAfter(html: string, closing: RegExp, from: number): number {
  closing.lastIndex = from;
  const found = closing.exec(html);
  return found === null ? html.length : found.index + found[0].length;
}

// Cuts `text` to at most `maxChars` UTF-16 units without leaving half of a surrogate pair behind.
export function cutToLimit(text: string, maxChars: number): string {
  if (maxChars <= 0) {
    return "";
  }
  if (text.length <= maxChars) {
    return text;
  }
  const lastKept = text.charCodeAt(maxChars - 1);
  const endsInsidePair = lastKept >= 0xd800 && lastKept <= 0xdbff;
  return text.slice(0, endsInsidePair ? maxChars - 1 : maxChars);
}

type OpenElement = { name: string; hidden: boolean };

// The index of the `>` that ends a tag whose name has already been read, or -1 when the tag is
// never closed. A quote opens an attribute value only straight after `=`, as in HTML, and a value
// with no closing quote runs to the end of the page. One pass, so a hostile page cannot make it
// slow.
function findTagEnd(html: string, from: number): number {
  let index = from;
  while (index < html.length) {
    const character = html[index];
    if (character === ">") {
      return index;
    }
    index += 1;
    if (character === "=") {
      while (index < html.length && /\s/.test(html[index])) {
        index += 1;
      }
      const quote = html[index];
      if (quote === '"' || quote === "'") {
        const closingQuote = html.indexOf(quote, index + 1);
        if (closingQuote === -1) {
          return -1;
        }
        index = closingQuote + 1;
      }
    }
  }
  return -1;
}

// The text of the page that a person would see, one line per block, cut to `maxChars`. Script,
// style, head, noscript, template, svg, iframe, comments and anything marked hidden (the `hidden`
// attribute, `aria-hidden="true"`, `display: none`, `visibility: hidden`) are dropped, with
// everything inside them. Control characters are removed. The work is linear in the page.
export function visibleText(html: string, maxChars: number): string {
  const openElements: OpenElement[] = [];
  // How many elements of each name are open, so a closing tag that matches nothing costs nothing.
  const openCounts = new Map<string, number>();
  const pieces: string[] = [];
  const isHidden = () => openElements.at(-1)?.hidden ?? false;
  const open = (element: OpenElement) => {
    openElements.push(element);
    openCounts.set(element.name, (openCounts.get(element.name) ?? 0) + 1);
  };
  const closeTop = (): string | undefined => {
    const element = openElements.pop();
    if (element !== undefined) {
      openCounts.set(element.name, (openCounts.get(element.name) ?? 1) - 1);
    }
    return element?.name;
  };
  // Closes the nearest open element called `name` and everything inside it. Each element is closed
  // once, so the total work over a page is linear.
  const closeThrough = (name: string) => {
    if ((openCounts.get(name) ?? 0) === 0) {
      return;
    }
    while (closeTop() !== name) {
      // keep closing the elements inside it
    }
  };
  let position = 0;

  while (position < html.length) {
    const nextTag = html.indexOf("<", position);
    const textEnd = nextTag === -1 ? html.length : nextTag;
    if (textEnd > position && !isHidden()) {
      const text = stripControlCharacters(decodeHtmlEntities(html.slice(position, textEnd)));
      pieces.push(text.replace(/\s+/g, " "));
    }
    if (nextTag === -1) {
      break;
    }
    position = nextTag;

    if (html.startsWith("<!--", position)) {
      position = indexAfter(html, /-->/g, position + 4);
      continue;
    }
    const isClosing = html[position + 1] === "/";
    tagNamePattern.lastIndex = position + (isClosing ? 2 : 1);
    const tagName = tagNamePattern.exec(html);
    if (tagName === null) {
      // Not a tag: a doctype, a processing instruction or a stray `<`.
      if (html.startsWith("<!", position) || html.startsWith("<?", position)) {
        const close = html.indexOf(">", position);
        position = close === -1 ? html.length : close + 1;
      } else {
        if (!isHidden()) {
          pieces.push("<");
        }
        position += 1;
      }
      continue;
    }
    const tagEnd = findTagEnd(html, tagNamePattern.lastIndex);
    if (tagEnd === -1) {
      // A tag that never ends takes the rest of the page with it, as it does in a browser.
      break;
    }
    const attributeText = html.slice(tagNamePattern.lastIndex, tagEnd);
    position = tagEnd + 1;
    const name = tagName[0].toLowerCase();

    if (isClosing) {
      closeThrough(name);
    } else if (rawTextElements.has(name)) {
      position = indexAfter(html, new RegExp(`</${name}\\s*>`, "gi"), position);
    } else if (!voidElements.has(name)) {
      if (impliedEndElements.has(name) && openElements.at(-1)?.name === name) {
        closeTop();
      }
      if (name === "body") {
        // A page may leave out </head>. The body starting ends it.
        closeThrough("head");
      }
      const hidden = isHidden() || droppedElements.has(name) || isMarkedHidden(attributeText);
      open({ name, hidden });
    }

    if (lineBreakingElements.has(name)) {
      pieces.push("\n");
    } else if (cellElements.has(name)) {
      pieces.push(" ");
    }
  }

  const lines = pieces
    .join("")
    .split("\n")
    .map((line) => line.replace(/ +/g, " ").trim())
    .filter((line) => line !== "");
  // A lone surrogate is replaced with U+FFFD, because Postgres text and jsonb refuse it.
  return cutToLimit(lines.join("\n").toWellFormed(), maxChars);
}
