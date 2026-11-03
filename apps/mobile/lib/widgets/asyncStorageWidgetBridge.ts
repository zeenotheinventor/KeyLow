import { parseWidgetSnapshot, pendingUndoSchema } from "@keylow/core/widgets";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { PENDING_UNDO_STORAGE_KEY, SNAPSHOT_STORAGE_KEY } from "./storageKeys";

import type { WidgetBridge } from "./types";

type WidgetStorage = Readonly<{
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}>;

type Options = Readonly<{
  storage?: WidgetStorage;
  /** Draws the widgets again. The default does nothing until the Android bridge (KEY-805) gives one. */
  requestRedraw?: () => Promise<void>;
}>;

const parsedJson = (stored: string | null): unknown => {
  if (stored === null) {
    return null;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

/**
 * The bridge the app uses: the snapshot and the pending-undo record in AsyncStorage under two keys, and a
 * redraw that does nothing until KEY-805. Nothing read back is trusted: the snapshot goes through core's
 * parser and the record through its schema, and what does not match is none.
 */
export function createAsyncStorageWidgetBridge({
  storage = AsyncStorage,
  requestRedraw = () => Promise.resolve(),
}: Options = {}): WidgetBridge {
  return {
    writeSnapshot: (snapshot) => storage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot)),
    readSnapshot: async () => parseWidgetSnapshot(await storage.getItem(SNAPSHOT_STORAGE_KEY)),
    writePendingUndo: (undo) => storage.setItem(PENDING_UNDO_STORAGE_KEY, JSON.stringify(undo)),
    readPendingUndo: async () => {
      const parsed = pendingUndoSchema.safeParse(
        parsedJson(await storage.getItem(PENDING_UNDO_STORAGE_KEY)),
      );
      return parsed.success ? parsed.data : null;
    },
    clearPendingUndo: () => storage.removeItem(PENDING_UNDO_STORAGE_KEY),
    clear: async () => {
      await Promise.all([
        storage.removeItem(SNAPSHOT_STORAGE_KEY),
        storage.removeItem(PENDING_UNDO_STORAGE_KEY),
      ]);
    },
    requestRedraw,
  };
}
