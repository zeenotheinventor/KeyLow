import { KeyLowProvider } from "@keylow/api-client";
import { widgetSnapshotSchema } from "@keylow/core/widgets";
import { QueryClient } from "@tanstack/react-query";
import { act, render } from "@testing-library/react-native";
import { AppState } from "react-native";

import { WidgetSync } from "./WidgetSync";
import {
  emitAuthStateChange,
  mockSupabaseClient,
  resetSupabaseMock,
} from "../../../test/support/supabaseMock";
import { NOW, snapshotSource } from "../../../test/support/widgetFixtures";
import { createInMemoryWidgetBridge } from "../inMemoryWidgetBridge";
import { useWidgetSnapshotSource } from "../useWidgetSnapshotSource";
import { emitWidgetActionDone } from "../widgetActionEvents";

import type { WidgetSnapshotSource } from "../snapshotWriter";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppStateStatus } from "react-native";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {},
}));
jest.mock("../useWidgetSnapshotSource");
jest.mock("../../useNow", () => ({ useNow: () => new Date("2026-11-03T12:00:00.000Z") }));

const useSourceMock = jest.mocked(useWidgetSnapshotSource);

const sourceOf = (weightUnit: "kg" | "lb" = "kg"): WidgetSnapshotSource =>
  snapshotSource({ weightUnit });

const DEBOUNCE = 1000;

async function renderSync(bridge = createInMemoryWidgetBridge()) {
  const queryClient = new QueryClient();
  const view = await render(
    <KeyLowProvider
      // The provider only hands the client on, and the sync reads its auth events.
      client={mockSupabaseClient as unknown as SupabaseClient}
      queryClient={queryClient}
    >
      <WidgetSync bridge={bridge} debounceMilliseconds={DEBOUNCE} />
    </KeyLowProvider>,
  );
  return { bridge, queryClient, ...view };
}

describe("WidgetSync", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    resetSupabaseMock();
    useSourceMock.mockReturnValue(sourceOf());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should write a snapshot that passes the schema once the data has settled", async () => {
    const { bridge } = await renderSync();

    await act(() => jest.advanceTimersByTimeAsync(DEBOUNCE));

    const stored = await bridge.readSnapshot();
    expect(stored.status).toBe("ready");
    expect(
      stored.status === "ready" && widgetSnapshotSchema.safeParse(stored.snapshot).success,
    ).toBe(true);
    expect(bridge.redrawCount()).toBe(1);
  });

  it("should write nothing before the debounce has passed", async () => {
    const { bridge } = await renderSync();

    await act(() => jest.advanceTimersByTimeAsync(DEBOUNCE - 1));

    expect(await bridge.readSnapshot()).toEqual({ status: "no_data" });
  });

  it("should write nothing while the reads have not all answered", async () => {
    useSourceMock.mockReturnValue(null);
    const { bridge } = await renderSync();

    await act(() => jest.advanceTimersByTimeAsync(DEBOUNCE * 2));

    expect(bridge.redrawCount()).toBe(0);
  });

  it("should write again when the data changes", async () => {
    const { bridge, rerender, queryClient } = await renderSync();
    await act(() => jest.advanceTimersByTimeAsync(DEBOUNCE));
    useSourceMock.mockReturnValue(sourceOf("lb"));

    await act(async () => {
      await rerender(
        <KeyLowProvider
          client={mockSupabaseClient as unknown as SupabaseClient}
          queryClient={queryClient}
        >
          <WidgetSync bridge={bridge} debounceMilliseconds={DEBOUNCE} />
        </KeyLowProvider>,
      );
    });
    await act(() => jest.advanceTimersByTimeAsync(DEBOUNCE));

    const stored = await bridge.readSnapshot();
    expect(stored.status === "ready" && stored.snapshot.weightUnit).toBe("lb");
  });

  it("should write when the app goes to the background", async () => {
    const handlers: ((state: AppStateStatus) => void)[] = [];
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      handlers.push(handler);
      return { remove: jest.fn() };
    });
    const { bridge } = await renderSync();

    await act(async () => {
      handlers.forEach((handler) => {
        handler("background");
      });
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(bridge.redrawCount()).toBe(1);
  });

  it("should write after a one-tap action has written, from the data read afterwards", async () => {
    const { bridge } = await renderSync();
    await act(() => jest.advanceTimersByTimeAsync(DEBOUNCE));
    // The action wrote a row, so the reads that follow it answer with the new data.
    useSourceMock.mockReturnValue(sourceOf("lb"));

    await act(async () => {
      emitWidgetActionDone();
      await jest.advanceTimersByTimeAsync(10);
    });

    const stored = await bridge.readSnapshot();
    expect(stored.status === "ready" && stored.snapshot.weightUnit).toBe("lb");
  });

  it("should delete the snapshot and the record when the account signs out", async () => {
    const { bridge } = await renderSync();
    await act(() => jest.advanceTimersByTimeAsync(DEBOUNCE));
    await bridge.writePendingUndo({
      action: "log_set",
      rowId: "44444444-4444-4444-8444-444444444444",
      at: NOW.toISOString(),
    });

    await act(async () => {
      emitAuthStateChange("SIGNED_OUT", null);
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(await bridge.readSnapshot()).toEqual({ status: "no_data" });
    expect(await bridge.readPendingUndo()).toBeNull();
  });
});
