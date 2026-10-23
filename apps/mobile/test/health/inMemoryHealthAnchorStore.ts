import type { HealthAnchorStore } from "../../lib/health/healthAnchorStore";

export type InMemoryHealthAnchorStore = HealthAnchorStore & {
  /** Every write in order, so a test can tell a write that never happened from one that did. */
  writes: { kind: "anchor" | "lastImport"; userId: string; value: string }[];
};

/** The anchor store without SecureStore, for tests of the runner and the hook. */
export function createInMemoryHealthAnchorStore(): InMemoryHealthAnchorStore {
  const anchors = new Map<string, string>();
  const lastImports = new Map<string, string>();
  const writes: InMemoryHealthAnchorStore["writes"] = [];

  return {
    writes,
    getAnchor: (userId) => Promise.resolve(anchors.get(userId) ?? null),
    setAnchor: (userId, value) => {
      writes.push({ kind: "anchor", userId, value });
      anchors.set(userId, value);
      return Promise.resolve();
    },
    getLastImport: (userId) => Promise.resolve(lastImports.get(userId) ?? null),
    setLastImport: (userId, value) => {
      writes.push({ kind: "lastImport", userId, value });
      lastImports.set(userId, value);
      return Promise.resolve();
    },
  };
}
