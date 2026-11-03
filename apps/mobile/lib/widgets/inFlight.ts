const running = new Set<string>();

/**
 * Runs `work` unless one with the same key is already under way, in which case it returns undefined and
 * runs nothing. The key is taken before the first await, so two taps in the same tick write once.
 */
export async function runOnce<Result>(
  key: string,
  work: () => Promise<Result>,
): Promise<Result | undefined> {
  if (running.has(key)) {
    return undefined;
  }
  running.add(key);
  try {
    return await work();
  } finally {
    running.delete(key);
  }
}
