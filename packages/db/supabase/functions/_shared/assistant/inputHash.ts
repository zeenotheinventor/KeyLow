// A confirmation is tied to the exact input it was asked for, so the executor stores a hash of that
// input and nothing else of it (the turn row holds no health value). Keys are sorted, so two inputs
// that differ only in key order hash alike.
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const members = Object.keys(value)
      .sort()
      .flatMap((key) => {
        const child: unknown = Reflect.get(value, key);
        return child === undefined ? [] : [`${JSON.stringify(key)}:${canonical(child)}`];
      });
    return `{${members.join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function inputHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
