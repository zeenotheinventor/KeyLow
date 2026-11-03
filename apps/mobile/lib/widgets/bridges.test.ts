import { createAsyncStorageWidgetBridge } from "./asyncStorageWidgetBridge";
import { createInMemoryWidgetBridge } from "./inMemoryWidgetBridge";
import { PENDING_UNDO_STORAGE_KEY, SNAPSHOT_STORAGE_KEY } from "./storageKeys";
import { testSnapshot } from "../../test/support/widgetFixtures";

import type { WidgetBridge } from "./types";
import type { PendingUndo } from "@keylow/core/widgets";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {},
}));

const undo: PendingUndo = {
  action: "log_again",
  rowId: "44444444-4444-4444-8444-444444444444",
  at: "2026-11-03T12:00:00.000Z",
};

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => Promise.resolve(values.get(key) ?? null),
    setItem: (key: string, value: string) => {
      values.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      values.delete(key);
      return Promise.resolve();
    },
  };
}

const bridges: [string, () => WidgetBridge][] = [
  ["the in-memory bridge", () => createInMemoryWidgetBridge()],
  ["the AsyncStorage bridge", () => createAsyncStorageWidgetBridge({ storage: memoryStorage() })],
];

describe.each(bridges)("%s", (_name, create) => {
  it("should read no data before a snapshot is written", async () => {
    expect(await create().readSnapshot()).toEqual({ status: "no_data" });
  });

  it("should read back the snapshot it was given", async () => {
    const bridge = create();
    await bridge.writeSnapshot(testSnapshot());

    expect(await bridge.readSnapshot()).toEqual({ status: "ready", snapshot: testSnapshot() });
  });

  it("should read back the pending-undo record", async () => {
    const bridge = create();
    await bridge.writePendingUndo(undo);

    expect(await bridge.readPendingUndo()).toEqual(undo);
  });

  it("should forget the pending-undo record when it is cleared on its own", async () => {
    const bridge = create();
    await bridge.writePendingUndo(undo);
    await bridge.clearPendingUndo();

    expect(await bridge.readPendingUndo()).toBeNull();
  });

  it("should delete both the snapshot and the record on clear", async () => {
    const bridge = create();
    await bridge.writeSnapshot(testSnapshot());
    await bridge.writePendingUndo(undo);
    await bridge.clear();

    expect(await bridge.readSnapshot()).toEqual({ status: "no_data" });
    expect(await bridge.readPendingUndo()).toBeNull();
  });
});

describe("the AsyncStorage bridge", () => {
  it("should keep the snapshot and the record under two keys of their own", async () => {
    const storage = memoryStorage();
    const bridge = createAsyncStorageWidgetBridge({ storage });
    await bridge.writeSnapshot(testSnapshot());
    await bridge.writePendingUndo(undo);

    expect([...storage.values.keys()].sort()).toEqual(
      [PENDING_UNDO_STORAGE_KEY, SNAPSHOT_STORAGE_KEY].sort(),
    );
  });

  it("should read a record that no longer matches the schema as none", async () => {
    const storage = memoryStorage();
    storage.values.set(PENDING_UNDO_STORAGE_KEY, JSON.stringify({ action: "other" }));

    expect(await createAsyncStorageWidgetBridge({ storage }).readPendingUndo()).toBeNull();
  });

  it("should read text that is not JSON as none", async () => {
    const storage = memoryStorage();
    storage.values.set(PENDING_UNDO_STORAGE_KEY, "{not json");

    expect(await createAsyncStorageWidgetBridge({ storage }).readPendingUndo()).toBeNull();
  });

  it("should ask the redraw it was given to run", async () => {
    const requestRedraw = jest.fn(() => Promise.resolve());
    await createAsyncStorageWidgetBridge({
      storage: memoryStorage(),
      requestRedraw,
    }).requestRedraw();

    expect(requestRedraw).toHaveBeenCalledTimes(1);
  });
});
