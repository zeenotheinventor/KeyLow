import { buildWidgetSnapshot } from "@keylow/core/widgets";

import { createNonce } from "./createNonce";

import type { WidgetBridge } from "./types";
import type { WidgetSnapshot, WidgetSnapshotInput } from "@keylow/core/widgets";

/** What the screens hold, without the two things the writer adds: a nonce and the time. */
export type WidgetSnapshotSource = Omit<WidgetSnapshotInput, "nonce" | "now">;

type Options = Readonly<{
  bridge: WidgetBridge;
  /** A secure random value of at least `NONCE_MINIMUM_LENGTH` characters. */
  createNonce: () => string;
  now: () => Date;
}>;

const withoutBuildTime = (snapshot: WidgetSnapshot): string =>
  JSON.stringify({ ...snapshot, builtAt: "" });

/**
 * Builds the snapshot with core and stores it through the bridge, then asks the widgets to redraw. The
 * stored snapshot is the one source of truth for the nonce: when the new snapshot equals it (ignoring the
 * nonce and the build time) the stored nonce is kept, so a widget drawn a moment ago, or before the app was
 * restarted, still holds a nonce the app will accept. A nonce rotated by a start link is picked up the same
 * way. Writes run one after another, so two overlapping writes of the same data use one nonce. Nothing is
 * written for data that does not make a snapshot.
 */
export function createSnapshotWriter({ bridge, createNonce, now }: Options) {
  let queue: Promise<void> = Promise.resolve();

  const writeOnce = async (source: WidgetSnapshotSource): Promise<void> => {
    const stored = await bridge.readSnapshot();
    const builtAt = now();
    if (stored.status === "ready") {
      const same = buildWidgetSnapshot({ ...source, nonce: stored.snapshot.nonce, now: builtAt });
      if (same !== null && withoutBuildTime(same) === withoutBuildTime(stored.snapshot)) {
        await bridge.writeSnapshot(same);
        await bridge.requestRedraw();
        return;
      }
    }
    const snapshot = buildWidgetSnapshot({ ...source, nonce: createNonce(), now: builtAt });
    if (snapshot === null) {
      return;
    }
    await bridge.writeSnapshot(snapshot);
    await bridge.requestRedraw();
  };

  // Everything the writer does goes through one chain, so a write in flight cannot undo a rotation.
  const enqueue = (work: () => Promise<void>): Promise<void> => {
    const run = queue.then(work);
    queue = run.catch(() => undefined);
    return run;
  };

  const rotateOnce = async (): Promise<void> => {
    const stored = await bridge.readSnapshot();
    if (stored.status !== "ready") {
      return;
    }
    await bridge.writeSnapshot({ ...stored.snapshot, nonce: createNonce() });
    await bridge.requestRedraw();
  };

  return {
    write: (source: WidgetSnapshotSource): Promise<void> => enqueue(() => writeOnce(source)),
    /**
     * Stores the snapshot again under a fresh nonce and asks the widgets to redraw, so the nonce a start link
     * just used is unknown on every later read, a relaunch included, and the redrawn widget carries the new one.
     */
    rotate: (): Promise<void> => enqueue(rotateOnce),
  };
}

export type SnapshotWriter = ReturnType<typeof createSnapshotWriter>;

const writers = new WeakMap<WidgetBridge, SnapshotWriter>();

/**
 * The writer for a bridge, the same one for every caller, so the sync and a start link share one chain. It
 * makes nonces with the phone's secure random source.
 */
export function snapshotWriterFor(bridge: WidgetBridge): SnapshotWriter {
  const existing = writers.get(bridge);
  if (existing !== undefined) {
    return existing;
  }
  const created = createSnapshotWriter({ bridge, createNonce, now: () => new Date() });
  writers.set(bridge, created);
  return created;
}
