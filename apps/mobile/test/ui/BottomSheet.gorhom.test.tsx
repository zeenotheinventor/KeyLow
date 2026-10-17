import { act, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BottomSheet } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// Stands in for gorhom so a test can see which calls the kit's sheet makes on it, and play the library's
// own report of a close, which it makes when a drag down ends. What gorhom does on a device is in the
// library's own tests and on the device.
const mockSheet: { calls: string[]; reportClose: () => void; canDragDown: boolean | undefined } = {
  calls: [],
  reportClose: jest.fn(),
  canDragDown: undefined,
};

jest.mock("@gorhom/bottom-sheet", () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual<typeof import("react")>("react");
  const FakeSheet = forwardRef<
    unknown,
    { children: React.ReactNode; onClose: () => void; enablePanDownToClose: boolean }
  >(function FakeSheet({ children, onClose, enablePanDownToClose }, ref) {
    mockSheet.reportClose = onClose;
    mockSheet.canDragDown = enablePanDownToClose;
    useImperativeHandle(ref, () => ({
      close: () => mockSheet.calls.push("close"),
      snapToIndex: (index: number) => mockSheet.calls.push(`snapToIndex(${index})`),
    }));
    return children;
  });
  return {
    __esModule: true,
    default: FakeSheet,
    BottomSheetView: ({ children }: never) => children,
    BottomSheetTextInput: () => null,
  };
});

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };

function sheetElement(open: boolean, onClose: () => void, isDismissible?: boolean) {
  return (
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <ThemeProvider fixedPreference="dark">
        <BottomSheet isDismissible={isDismissible} open={open} title="Log weight" onClose={onClose}>
          {null}
        </BottomSheet>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

describe("BottomSheet on the library's ref", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSheet.calls = [];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should close the library's sheet when the screen closes it", async () => {
    const view = await render(sheetElement(true, () => undefined));

    await view.rerender(sheetElement(false, () => undefined));

    expect(mockSheet.calls).toEqual(["close"]);
  });

  it("should snap the sheet back up when it opens again while it is still closing", async () => {
    const view = await render(sheetElement(true, () => undefined));
    await view.rerender(sheetElement(false, () => undefined));
    await advance(100);

    await view.rerender(sheetElement(true, () => undefined));

    expect(mockSheet.calls).toEqual(["close", "snapToIndex(0)"]);
  });

  it("should not snap anywhere when it opens again after the exit has finished", async () => {
    const view = await render(sheetElement(true, () => undefined));
    await view.rerender(sheetElement(false, () => undefined));
    await advance(1000);

    await view.rerender(sheetElement(true, () => undefined));

    expect(mockSheet.calls).toEqual(["close"]);
  });

  it("should let a drag down close the sheet unless the screen says it cannot be closed yet", async () => {
    const view = await render(sheetElement(true, () => undefined));
    expect(mockSheet.canDragDown).toBe(true);

    await view.rerender(sheetElement(true, () => undefined, false));
    expect(mockSheet.canDragDown).toBe(false);

    await view.rerender(sheetElement(true, () => undefined, true));
    expect(mockSheet.canDragDown).toBe(true);
  });

  it("should not snap anywhere on the first open", async () => {
    await render(sheetElement(true, () => undefined));

    expect(mockSheet.calls).toEqual([]);
  });

  it("should call onClose once when the library reports a close the user made, as a drag down does", async () => {
    const onClose = jest.fn();
    await render(sheetElement(true, onClose));

    await act(() => {
      mockSheet.reportClose();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should not call onClose when the library reports the close the screen asked for", async () => {
    const onClose = jest.fn();
    const view = await render(sheetElement(true, onClose));
    await view.rerender(sheetElement(false, onClose));

    await act(() => {
      mockSheet.reportClose();
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
