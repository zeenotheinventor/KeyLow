import { clearWidgets } from "./clearWidgets";
import { createInMemoryWidgetBridge } from "./inMemoryWidgetBridge";
import { NOW, testSnapshot } from "../../test/support/widgetFixtures";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {},
}));

describe("clearWidgets", () => {
  it("should delete the snapshot and the record and ask for a redraw", async () => {
    const bridge = createInMemoryWidgetBridge();
    await bridge.writeSnapshot(testSnapshot());
    await bridge.writePendingUndo({
      action: "log_set",
      rowId: "44444444-4444-4444-8444-444444444444",
      at: NOW.toISOString(),
    });

    await clearWidgets(bridge);

    expect(await bridge.readSnapshot()).toEqual({ status: "no_data" });
    expect(await bridge.readPendingUndo()).toBeNull();
    expect(bridge.redrawCount()).toBe(1);
  });
});
