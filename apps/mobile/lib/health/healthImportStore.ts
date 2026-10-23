import { getLastImport, getAnchor, setAnchor, setLastImport } from "./healthAnchorStore";
import { runHealthImport } from "./importRunner";

import type { HealthImportDependencies, HealthImportResult } from "./importRunner";

export type HealthImportState = Readonly<{
  /** Whose state this is, so a result is never shown to the next person on the phone. */
  userId: string | null;
  isImporting: boolean;
  /** When an import last ended as imported or nothing-new. */
  lastImportedAt: string | null;
  lastResult: HealthImportResult | null;
}>;

/*
 * One copy of the import's state for the whole app, because the root layout starts imports and the Weight
 * screen and the Health flow read the same state. It is fed by `startHealthImport` and by nothing else, and
 * it holds counts, a status and a time, never a weight.
 *
 * The root layout's runner registers the function that imports, and a screen asks for an import through
 * `importHealthNow`, which calls it. With no runner mounted there is nothing to call.
 */
const noState: HealthImportState = {
  userId: null,
  isImporting: false,
  lastImportedAt: null,
  lastResult: null,
};

let state = noState;
// Moves on each reset, so a read that started before it does not write into the state after it.
let generation = 0;
let registeredImporter: (() => Promise<HealthImportResult>) | null = null;
const listeners = new Set<() => void>();

function publish(next: HealthImportState): void {
  state = next;
  listeners.forEach((listener) => {
    listener();
  });
}

/** Starts the state of `userId` over when it was another person's. */
function stateOf(userId: string): HealthImportState {
  return state.userId === userId ? state : { ...noState, userId };
}

export function subscribeToHealthImport(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Puts the state back to empty, as when nobody is signed in. */
export function resetHealthImport(): void {
  generation += 1;
  publish(noState);
}

const unavailableResult: HealthImportResult = {
  status: "unavailable",
  read: 0,
  skipped: 0,
  inserted: 0,
};

/**
 * Makes `importer` what `importHealthNow` calls. The returned function removes it, unless another has
 * replaced it, and empties the state, because what it holds belongs to the person who was signed in.
 */
export function registerHealthImporter(importer: () => Promise<HealthImportResult>): () => void {
  registeredImporter = importer;
  return () => {
    if (registeredImporter === importer) {
      registeredImporter = null;
    }
    resetHealthImport();
  };
}

/**
 * Asks the mounted runner for an import, which joins one that is running. It is `unavailable`, and
 * touches nothing, when no runner is mounted.
 */
export function importHealthNow(): Promise<HealthImportResult> {
  return registeredImporter === null ? Promise.resolve(unavailableResult) : registeredImporter();
}

export function getHealthImportState(): HealthImportState {
  return state;
}

/** Reads the stored last import time into the state, unless an import has already set one. */
export async function loadLastImport(userId: string): Promise<void> {
  const startedIn = generation;
  const stored = await getLastImport(userId);
  const current = stateOf(userId);
  if (startedIn === generation && current.lastImportedAt === null && stored !== null) {
    publish({ ...current, lastImportedAt: stored });
  }
}

/** The anchor store the app uses, in the shape the runner takes. */
const storedAnchors = { getAnchor, setAnchor, getLastImport, setLastImport };

type StartHealthImportInputs = Omit<HealthImportDependencies, "anchorStore">;

/**
 * Runs an import through the runner's single flight and publishes it: importing while it runs, then the
 * result. A request that joins a running import gets its result and publishes nothing a second time.
 */
export async function startHealthImport(
  inputs: StartHealthImportInputs,
): Promise<HealthImportResult> {
  const { userId } = inputs;
  if (!stateOf(userId).isImporting) {
    publish({ ...stateOf(userId), isImporting: true });
  }

  const result = await runHealthImport({ ...inputs, anchorStore: storedAnchors });

  // The runner decides whether an import counts (it writes the time only when one ended well), so the
  // time is read back from where it wrote it, and not worked out again here.
  const lastImportedAt = await getLastImport(userId);

  if (state.userId === userId && (state.isImporting || state.lastResult !== result)) {
    publish({
      ...state,
      isImporting: false,
      lastImportedAt: lastImportedAt ?? state.lastImportedAt,
      lastResult: result,
    });
  }
  return result;
}
