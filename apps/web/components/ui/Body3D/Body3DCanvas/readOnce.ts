/**
 * Wraps a read so it runs once however many ask, and every caller gets the same promise, which stays rejected if the
 * read failed. A failure is kept on purpose: `use` asks again on every render, and a read that was forgotten would
 * start again each time and never hand the boundary an error. Nothing here retries. A later visit to the page loads
 * the module afresh and so reads again.
 */
export function readOnce<Value>(read: () => Promise<Value>): () => Promise<Value> {
  let pending: Promise<Value> | undefined;
  return () => (pending ??= read());
}
