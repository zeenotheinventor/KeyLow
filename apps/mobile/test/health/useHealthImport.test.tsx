import { useImportWeighIns, useProfileTimeZone, useSupabase } from "@keylow/api-client";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { AppState, Text } from "react-native";

import { HealthImportRunner } from "../../components/HealthImportRunner";
import { getHealthProvider, useHealthImport } from "../../lib/health";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { createFakeHealthProvider } from "../support/fakeHealthProvider";

import type { FakeHealthProvider } from "../support/fakeHealthProvider";
import type { HealthWeighInInsert, HealthWeightSample } from "@keylow/core/weight";
import type { AppStateStatus, NativeEventSubscription } from "react-native";

const mockSecureStoreItems = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStoreItems.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn(),
}));
jest.mock("@keylow/api-client", () => ({
  useImportWeighIns: jest.fn(),
  useProfileTimeZone: jest.fn(),
  useSupabase: jest.fn(),
}));
jest.mock("../../lib/useReadsEnabled", () => ({ useReadsEnabled: jest.fn() }));
jest.mock("../../lib/health/getHealthProvider", () => ({ getHealthProvider: jest.fn() }));

const importWeighIns = jest.fn<
  Promise<{ inserted: number; skipped: number }>,
  [readonly HealthWeighInInsert[]]
>();
const removeForegroundListener = jest.fn();
let foregroundListeners: ((state: AppStateStatus) => void)[];
let provider: FakeHealthProvider;
// The same object each time, as the provider's client is, so a hook that depends on it does not rerun.
const supabaseClient = {
  auth: { getSession: jest.fn() },
};

const samples: HealthWeightSample[] = [1, 2, 3].map((day) => ({
  sampleId: `sample-id-${day}`,
  measuredAt: `2026-10-0${day}T07:30:00.000Z`,
  value: 81.234,
  unit: "kilograms",
}));

const readSinces = () =>
  provider.calls.flatMap((call) => (call.method === "readWeightSince" ? [call.since] : []));

/** What the profile time zone query gives: `undefined` while it loads, null for a profile with no zone. */
function mockProfileTimeZone(data: string | null | undefined) {
  // The hook reads only `data`, so the rest of the query result is left out.
  jest
    .mocked(useProfileTimeZone)
    .mockReturnValue({ data } as ReturnType<typeof useProfileTimeZone>);
}

function mockSession(userId: string | null) {
  supabaseClient.auth.getSession.mockImplementation(() =>
    Promise.resolve({
      data: { session: userId === null ? null : { user: { id: userId } } },
    }),
  );
}

function emitForeground(state: AppStateStatus = "active") {
  return act(() => {
    foregroundListeners.forEach((listener) => {
      listener(state);
    });
  });
}

/** Lets the work started by an event run to its end. */
const settle = () => act(() => new Promise<void>((resolve) => setImmediate(resolve)));

const storedValue = (key: string) => Promise.resolve(mockSecureStoreItems.get(key) ?? null);

beforeEach(() => {
  jest.clearAllMocks();
  mockSecureStoreItems.clear();
  foregroundListeners = [];
  removeForegroundListener.mockClear();
  provider = createFakeHealthProvider({ permissionGranted: true, samples });
  jest.mocked(getHealthProvider).mockReturnValue(provider);
  jest.mocked(SecureStore.getItemAsync).mockImplementation(storedValue);
  mockSession("user-1");
  jest.mocked(useReadsEnabled).mockReturnValue(true);
  mockProfileTimeZone("Europe/London");
  importWeighIns.mockReset();
  importWeighIns.mockImplementation((rows) =>
    Promise.resolve({ inserted: rows.length, skipped: 0 }),
  );
  jest
    .mocked(useImportWeighIns)
    // The hook reads only `mutateAsync`.
    .mockReturnValue({ mutateAsync: importWeighIns } as unknown as ReturnType<
      typeof useImportWeighIns
    >);
  jest
    .mocked(useSupabase)
    // The hook reads only `auth.getSession`.
    .mockReturnValue(supabaseClient as unknown as ReturnType<typeof useSupabase>);
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_type, listener): NativeEventSubscription => {
      foregroundListeners.push(listener);
      return { remove: removeForegroundListener };
    });
});

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

describe("the import runner", () => {
  describe("the triggers", () => {
    it("should run one import when it mounts", async () => {
      await render(<HealthImportRunner />);
      await settle();

      expect(readSinces()).toEqual([null]);
      expect(importWeighIns).toHaveBeenCalledTimes(1);
    });

    it("should run an import when the app becomes active", async () => {
      await render(<HealthImportRunner />);
      await settle();

      await emitForeground("active");
      await settle();

      expect(readSinces()).toHaveLength(2);
    });

    it.each(["background", "inactive"] as const)(
      "should not run an import when the app becomes %s",
      async (state) => {
        await render(<HealthImportRunner />);
        await settle();

        await emitForeground(state);
        await settle();

        expect(readSinces()).toHaveLength(1);
      },
    );

    it("should not run for a signed out user", async () => {
      mockSession(null);

      await render(<HealthImportRunner />);
      await settle();
      await emitForeground();
      await settle();

      expect(readSinces()).toEqual([]);
      expect(importWeighIns).not.toHaveBeenCalled();
    });

    it("should not run until the terms are accepted", async () => {
      jest.mocked(useReadsEnabled).mockReturnValue(false);

      await render(<HealthImportRunner />);
      await settle();
      await emitForeground();
      await settle();

      expect(readSinces()).toEqual([]);
      expect(jest.mocked(useProfileTimeZone)).toHaveBeenCalledWith({ enabled: false });
    });

    it("should map the samples in UTC when the profile has no time zone", async () => {
      mockProfileTimeZone(null);

      await render(<HealthImportRunner />);
      await settle();

      expect(importWeighIns).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ tz: "UTC" })]),
      );
    });

    it("should stop listening after it unmounts", async () => {
      const { unmount } = await render(<HealthImportRunner />);
      await settle();
      expect(foregroundListeners).toHaveLength(1);

      await unmount();

      expect(removeForegroundListener).toHaveBeenCalledTimes(1);
    });

    it("should mount nothing, and listen to nothing, when there is no health provider", async () => {
      jest.mocked(getHealthProvider).mockReturnValue(null);

      await render(<HealthImportRunner />);
      await settle();

      expect(foregroundListeners).toEqual([]);
      expect(jest.mocked(useImportWeighIns)).not.toHaveBeenCalled();
      expect(jest.mocked(useProfileTimeZone)).not.toHaveBeenCalled();
      expect(supabaseClient.auth.getSession).not.toHaveBeenCalled();
    });
  });

  describe("before the time zone has loaded", () => {
    it("should run nothing and publish nothing, then import once the zone arrives", async () => {
      mockProfileTimeZone(undefined);
      const runner = await render(<HealthImportRunner />);
      const reader = await renderHook(() => useHealthImport());
      await settle();
      await emitForeground();
      await settle();

      expect(readSinces()).toEqual([]);
      expect(reader.result.current.lastResult).toBeNull();

      mockProfileTimeZone("Europe/London");
      await runner.rerender(<HealthImportRunner />);
      await settle();

      expect(readSinces()).toEqual([null]);
      expect(reader.result.current.lastResult?.status).toBe("imported");
    });

    it("should import on a pull to refresh once the zone has arrived, with the runner that was mounted before it", async () => {
      mockProfileTimeZone(undefined);
      const runner = await render(<HealthImportRunner />);
      const reader = await renderHook(() => useHealthImport());
      await settle();
      mockProfileTimeZone("Europe/London");
      await runner.rerender(<HealthImportRunner />);
      await settle();
      const readsBefore = readSinces().length;

      let outcome;
      await act(async () => {
        outcome = await reader.result.current.importNow();
      });

      expect(outcome).toMatchObject({ status: "imported" });
      expect(readSinces()).toHaveLength(readsBefore + 1);
    });

    it("should keep the last import time when the zone arrives while an import is reading", async () => {
      mockSecureStoreItems.set("health-import-last.user-1", "2026-10-22T08:00:00.000Z");
      let finishRead: () => void = () => undefined;
      const heldRead = new Promise<void>((resolve) => {
        finishRead = resolve;
      });
      const read = provider.readWeightSince.bind(provider);
      provider.readWeightSince = async (since) => {
        await heldRead;
        return read(since);
      };
      const runner = await render(<HealthImportRunner />);
      const reader = await renderHook(() => useHealthImport());
      await settle();
      expect(reader.result.current.isImporting).toBe(true);
      expect(reader.result.current.lastImportedAt).toBe("2026-10-22T08:00:00.000Z");

      mockProfileTimeZone("America/New_York");
      await runner.rerender(<HealthImportRunner />);
      await settle();

      expect(reader.result.current.isImporting).toBe(true);
      expect(reader.result.current.lastImportedAt).toBe("2026-10-22T08:00:00.000Z");

      finishRead();
      await settle();
    });

    it("should answer a pull to refresh with unavailable, never a failed import", async () => {
      mockProfileTimeZone(undefined);
      await render(<HealthImportRunner />);
      const reader = await renderHook(() => useHealthImport());

      let outcome;
      await act(async () => {
        outcome = await reader.result.current.importNow();
      });

      expect(outcome).toEqual({ status: "unavailable", read: 0, skipped: 0, inserted: 0 });
      expect(readSinces()).toEqual([]);
      expect(reader.result.current.lastResult).toBeNull();
      expect(reader.result.current.isImporting).toBe(false);
    });
  });
});

describe("useHealthImport", () => {
  describe("a reader on its own", () => {
    it("should start nothing: no provider, no listener, no read", async () => {
      const { result } = await renderHook(() => useHealthImport());
      await settle();

      expect(jest.mocked(getHealthProvider)).not.toHaveBeenCalled();
      expect(foregroundListeners).toEqual([]);
      expect(provider.calls).toEqual([]);
      expect(result.current).toMatchObject({
        isImporting: false,
        lastImportedAt: null,
        lastResult: null,
      });
    });

    it("should answer unavailable, with no read, when no runner is mounted", async () => {
      const { result } = await renderHook(() => useHealthImport());

      let outcome;
      await act(async () => {
        outcome = await result.current.importNow();
      });

      expect(outcome).toEqual({ status: "unavailable", read: 0, skipped: 0, inserted: 0 });
      expect(provider.calls).toEqual([]);
      expect(result.current.lastResult).toBeNull();
    });
  });

  describe("importNow", () => {
    it("should run an import through the mounted runner and give its result", async () => {
      await render(<HealthImportRunner />);
      const { result } = await renderHook(() => useHealthImport());
      await settle();

      let outcome;
      await act(async () => {
        outcome = await result.current.importNow();
      });

      expect(outcome).toEqual({ status: "imported", read: 3, skipped: 0, inserted: 3 });
      expect(readSinces()).toHaveLength(2);
    });

    it("should share the running import with a foreground event", async () => {
      await render(<HealthImportRunner />);
      const { result } = await renderHook(() => useHealthImport());
      await settle();
      const readsBefore = readSinces().length;

      await act(async () => {
        await emitForeground();
        await result.current.importNow();
      });

      expect(readSinces()).toHaveLength(readsBefore + 1);
    });
  });

  describe("the shared state", () => {
    function Reading({ label }: { label: string }) {
      const { isImporting, lastImportedAt, lastResult } = useHealthImport();
      return (
        <Text>
          {`${label}|${String(isImporting)}|${lastImportedAt ?? "none"}|${lastResult?.status ?? "none"}|${lastResult?.inserted ?? "none"}`}
        </Text>
      );
    }

    it("should show both readers the same import, importing and then finished", async () => {
      let finishRead: () => void = () => undefined;
      const heldRead = new Promise<void>((resolve) => {
        finishRead = resolve;
      });
      const read = provider.readWeightSince.bind(provider);
      provider.readWeightSince = async (since) => {
        await heldRead;
        return read(since);
      };

      await render(
        <>
          <HealthImportRunner />
          <Reading label="weight" />
          <Reading label="health" />
        </>,
      );
      await settle();

      expect(screen.getByText(/^weight\|true\|/)).toBeOnTheScreen();
      expect(screen.getByText(/^health\|true\|/)).toBeOnTheScreen();

      finishRead();
      await settle();

      await waitFor(() => {
        expect(screen.getByText(/^weight\|false\|/)).toBeOnTheScreen();
      });
      const weightText = String(screen.getByText(/^weight\|/).props.children);
      const healthText = String(screen.getByText(/^health\|/).props.children);
      expect(weightText.replace("weight", "")).toBe(healthText.replace("health", ""));
      expect(weightText).toMatch(/\|false\|\d{4}-\d{2}-\d{2}T[\d:.]+Z\|imported\|3$/);
      expect(readSinces()).toEqual([null]);
    });

    it("should load the last import time when the runner mounts", async () => {
      mockSecureStoreItems.set("health-import-last.user-1", "2026-10-22T08:00:00.000Z");
      provider.state.permissionGranted = false;
      await render(<HealthImportRunner />);
      const { result } = await renderHook(() => useHealthImport());
      await settle();

      expect(result.current.lastResult?.status).toBe("no-permission");
      expect(result.current.lastImportedAt).toBe("2026-10-22T08:00:00.000Z");
    });

    it("should keep the last import time through a failed import and replace it after a good one", async () => {
      mockSecureStoreItems.set("health-import-last.user-1", "2026-10-22T08:00:00.000Z");
      importWeighIns.mockRejectedValueOnce(new Error("database unavailable"));
      await render(<HealthImportRunner />);
      const { result } = await renderHook(() => useHealthImport());
      await settle();

      expect(result.current.lastResult?.status).toBe("failed");
      expect(result.current.lastImportedAt).toBe("2026-10-22T08:00:00.000Z");

      await act(async () => {
        await result.current.importNow();
      });

      expect(result.current.lastResult?.status).toBe("imported");
      expect(result.current.lastImportedAt).not.toBe("2026-10-22T08:00:00.000Z");
    });

    describe("a stored time that is read late", () => {
      const staleTime = "2026-10-01T00:00:00.000Z";
      let releaseStaleRead: () => void;

      /** Holds the first read of the last import time, which then answers with a stale one. */
      function holdFirstLastImportRead() {
        let isHeld = false;
        jest.mocked(SecureStore.getItemAsync).mockImplementation((key) => {
          if (!isHeld && key.startsWith("health-import-last.")) {
            isHeld = true;
            return new Promise((resolve) => {
              releaseStaleRead = () => {
                resolve(staleTime);
              };
            });
          }
          return storedValue(key);
        });
      }

      it("should not replace the time of an import that finished first", async () => {
        holdFirstLastImportRead();
        await render(<HealthImportRunner />);
        const { result } = await renderHook(() => useHealthImport());
        await settle();
        const finishedAt = result.current.lastImportedAt;
        expect(finishedAt).not.toBeNull();

        releaseStaleRead();
        await settle();

        expect(result.current.lastImportedAt).toBe(finishedAt);
      });

      it("should not write into the state after the runner has gone", async () => {
        holdFirstLastImportRead();
        mockSession("user-1");
        provider.state.permissionGranted = false;
        const runner = await render(<HealthImportRunner />);
        const { result } = await renderHook(() => useHealthImport());
        await settle();
        await runner.unmount();

        releaseStaleRead();
        await settle();

        expect(result.current.lastImportedAt).toBeNull();
      });
    });

    it("should not show one user's result to the next user, even before the next user is known", async () => {
      const first = await render(<HealthImportRunner />);
      const reader = await renderHook(() => useHealthImport());
      await settle();
      expect(reader.result.current.lastResult?.status).toBe("imported");
      expect(reader.result.current.lastImportedAt).not.toBeNull();
      await first.unmount();

      supabaseClient.auth.getSession.mockImplementation(() => new Promise(() => undefined));
      await render(<HealthImportRunner />);
      await settle();

      expect(reader.result.current.lastResult).toBeNull();
      expect(reader.result.current.lastImportedAt).toBeNull();
    });
  });

  describe("health data in logs", () => {
    it("should write nothing holding a weight or a sample id, and keep the state to counts and a time", async () => {
      const spies = (["log", "info", "warn", "error"] as const).map((method) =>
        jest.spyOn(console, method).mockImplementation(),
      );
      importWeighIns.mockRejectedValueOnce(new Error("could not store sample-id-2 at 81.234"));
      await render(<HealthImportRunner />);
      const { result } = await renderHook(() => useHealthImport());
      await settle();
      await act(async () => {
        await result.current.importNow();
      });

      const written = spies
        .flatMap((spy) => spy.mock.calls)
        .flat()
        .map(String)
        .join(" ");
      expect(written).not.toMatch(/81\.234|sample-id/);
      expect(JSON.stringify(result.current)).not.toMatch(/81\.234|sample-id/);
    });
  });
});
