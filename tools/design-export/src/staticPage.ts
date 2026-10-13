// Builds the standalone page for one board and checks that no runtime or network trace is left in it.

export type StaticPageInput = {
  lang: string;
  title: string;
  tokensHref: string;
  fontsHref: string;
  styles: readonly string[];
  boardHtml: string;
};

const allowedFontHost = "fonts.googleapis.com";
// Google Fonts answers with a stylesheet from one host and the font files from the other.
const allowedRequestHosts = new Set([allowedFontHost, "fonts.gstatic.com"]);

export function rewriteAssetUrls(html: string, rewrites: Readonly<Record<string, string>>): string {
  let rewritten = html;
  for (const [from, to] of Object.entries(rewrites)) {
    rewritten = rewritten.replaceAll(from, to);
  }
  return rewritten;
}

function escapeText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function buildStaticPage(input: StaticPageInput): string {
  const styleBlocks = input.styles.map((style) => `<style>\n${style}\n</style>`);
  return [
    "<!doctype html>",
    `<html lang="${input.lang}">`,
    "<head>",
    '<meta charset="utf-8">',
    `<title>${escapeText(input.title)}</title>`,
    `<link rel="stylesheet" href="${input.tokensHref}">`,
    `<link rel="stylesheet" href="${escapeText(input.fontsHref)}">`,
    ...styleBlocks,
    "</head>",
    "<body>",
    input.boardHtml,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

// Attributes that make the browser fetch something. A plain anchor to another site is not one of them.
const fetchingUrlPattern =
  /<(?:img|source|video|audio|iframe|embed|script|link)\b[^>]*?\b(?:src|href)="(https?:\/\/[^"]+)"/g;

export function findPageProblems(html: string): string[] {
  const problems: string[] = [];
  if (html.includes("<script")) {
    problems.push("contains a script tag");
  }
  if (html.includes("/_blob/")) {
    problems.push("contains a /_blob/ URL");
  }
  if (html.includes("claude.ai")) {
    problems.push("contains a claude.ai URL");
  }
  if (html.includes("sc-interp") || html.includes("data-dc-tpl") || html.includes("sc-host")) {
    problems.push("contains runtime markup (sc-interp, sc-host or data-dc-tpl)");
  }
  for (const match of html.matchAll(fetchingUrlPattern)) {
    const url = match[1];
    if (url !== undefined && new URL(url).hostname !== allowedFontHost) {
      problems.push(`requests ${url}`);
    }
  }
  if (!html.includes("var(--")) {
    problems.push("uses no design token (var(--...))");
  }
  if (!html.includes("kilo-tokens.css")) {
    problems.push("does not link kilo-tokens.css");
  }
  return problems;
}

// True for what a static page may load when opened from disk: its own files and Google Fonts.
export function isAllowedRequestUrl(url: string): boolean {
  const { protocol, hostname } = new URL(url);
  return protocol === "file:" || protocol === "data:" || allowedRequestHosts.has(hostname);
}
