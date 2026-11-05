/**
 * Wraps a read so it runs once however many ask, and every caller gets the same promise. A read that fails is
 * forgotten, so the next ask tries again.
 */
export function readOnce<Value>(read: () => Promise<Value>): () => Promise<Value> {
  let pending: Promise<Value> | undefined;
  return () => {
    pending ??= read().catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
}
