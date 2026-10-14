export type ClassToken = {
  /** The class as written, such as `hover:text-warning/80`. */
  raw: string;
  /** Every variant before the utility, such as `["hover"]`. */
  variants: string[];
  /** The utility with any important mark removed, such as `text-warning/80`. */
  utility: string;
};

// A variant can carry brackets with colons inside (`[&:not([aria-invalid=true])]:border-accent`),
// so only a colon outside every bracket separates a variant from what follows.
function splitOutsideBrackets(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "[" || character === "(") {
      depth += 1;
    } else if (character === "]" || character === ")") {
      depth -= 1;
    } else if (character === ":" && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(value.slice(start));
  return parts;
}

/** Reads the whitespace separated words of a string as Tailwind classes. */
export function classTokensOf(text: string): ClassToken[] {
  return text
    .split(/\s+/)
    .filter((word) => word !== "")
    .map((raw) => {
      const parts = splitOutsideBrackets(raw);
      const utility = (parts.pop() ?? "").replace(/^!/, "");
      return { raw, variants: parts, utility };
    });
}
