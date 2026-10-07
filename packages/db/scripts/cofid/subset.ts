const foodCodePattern = /^\d{2}-\d+$/;

/** Reads a codes file: one CoFID food code per line, `#` starts a comment, blank lines are ignored. */
export function parseSubsetFile(text: string): string[] {
  const codes: string[] = [];

  text.split(/\r?\n/).forEach((line, index) => {
    const code = (line.split("#")[0] ?? "").trim();
    if (code === "") {
      return;
    }
    if (!foodCodePattern.test(code)) {
      throw new Error(
        `The codes file has no food code on line ${index + 1}: ${JSON.stringify(code)}`,
      );
    }
    if (!codes.includes(code)) {
      codes.push(code);
    }
  });

  return codes;
}
