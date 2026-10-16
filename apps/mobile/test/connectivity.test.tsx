import { KeyLowProvider, useDiaryDay } from "@keylow/api-client";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";

import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  resetDiaryBackend,
  signInDiaryClient,
} from "./support/diaryBackend";
import { PROBE_INTERVAL_MS, PROBE_TIMEOUT_MS } from "../lib/connectivity/constants";
import { feedFocusManager } from "../lib/connectivity/feedFocusManager";
import { probeConnection } from "../lib/connectivity/probeConnection";
import { useIsOnline } from "../lib/connectivity/useIsOnline";
import { watchConnection } from "../lib/connectivity/watchConnection";

import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AppStateStatus, NativeEventSubscription } from "react-native";

describe("probeConnection", () => {
  it("should be online when the server answers, even with an error status, because it was reached", async () => {
    const fetchFn = jest.fn().mockResolvedValue({ status: 401 });

    await expect(probeConnection("https://example.test", fetchFn)).resolves.toBe(true);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://example.test/auth/v1/health",
      expect.objectContaining({ method: "HEAD" }),
    );
  });

  it("should be offline when the request fails to connect", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError("Network request failed"));

    await expect(probeConnection("https://example.test", fetchFn)).resolves.toBe(false);
  });

  it("should be offline when the server does not answer within the timeout", async () => {
    jest.useFakeTimers();
    try {
      // Never settles by itself, and ends when the probe aborts it.
      const fetchFn = jest.fn(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise<never>((_resolve, reject) => {
            init.signal.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          }),
      );
      const result = probeConnection("https://example.test", fetchFn);

      await jest.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);

      await expect(result).resolves.toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});

type AppStateListener = (state: AppStateStatus) => void;

function fakeAppState(initial: AppStateStatus) {
  const listeners = new Set<AppStateListener>();
  const appState = {
    currentState: initial,
    addEventListener: (_type: "change", listener: AppStateListener) => {
      listeners.add(listener);
      return {
        remove: () => {
          listeners.delete(listener);
        },
      };
    },
  };

  return {
    appState,
    listenerCount: () => listeners.size,
    change: (state: AppStateStatus) => {
      appState.currentState = state;
      listeners.forEach((listener) => {
        listener(state);
      });
    },
  };
}

describe("watchConnection", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should probe at once and report the answer", async () => {
    const probe = jest.fn().mockResolvedValue(false);
    const onChange = jest.fn();
    const { appState } = fakeAppState("active");

    watchConnection({ probe, onChange, appState });
    await jest.advanceTimersByTimeAsync(0);

    expect(probe).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("should probe again every interval while the app is in the foreground", async () => {
    const probe = jest.fn().mockResolvedValue(true);
    const { appState } = fakeAppState("active");
    watchConnection({ probe, onChange: jest.fn(), appState });

    await jest.advanceTimersByTimeAsync(PROBE_INTERVAL_MS * 2);

    expect(probe).toHaveBeenCalledTimes(3);
  });

  it("should recover when a later probe gets through", async () => {
    const probe = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const onChange = jest.fn();
    const { appState } = fakeAppState("active");
    watchConnection({ probe, onChange, appState });

    await jest.advanceTimersByTimeAsync(PROBE_INTERVAL_MS);

    expect(onChange).toHaveBeenNthCalledWith(1, false);
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("should stop probing in the background and probe at once when the app returns", async () => {
    const probe = jest.fn().mockResolvedValue(true);
    const { appState, change } = fakeAppState("active");
    watchConnection({ probe, onChange: jest.fn(), appState });
    await jest.advanceTimersByTimeAsync(0);

    change("background");
    await jest.advanceTimersByTimeAsync(PROBE_INTERVAL_MS * 3);
    expect(probe).toHaveBeenCalledTimes(1);

    change("active");
    await jest.advanceTimersByTimeAsync(0);
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it("should not probe at the start when the app is not in the foreground", async () => {
    const probe = jest.fn().mockResolvedValue(true);
    const { appState } = fakeAppState("background");

    watchConnection({ probe, onChange: jest.fn(), appState });
    await jest.advanceTimersByTimeAsync(PROBE_INTERVAL_MS);

    expect(probe).not.toHaveBeenCalled();
  });

  it("should stop everything when it is stopped", async () => {
    const probe = jest.fn().mockResolvedValue(true);
    const { appState, listenerCount } = fakeAppState("active");
    const stop = watchConnection({ probe, onChange: jest.fn(), appState });
    await jest.advanceTimersByTimeAsync(0);

    stop();
    await jest.advanceTimersByTimeAsync(PROBE_INTERVAL_MS * 3);

    expect(probe).toHaveBeenCalledTimes(1);
    expect(listenerCount()).toBe(0);
  });

  it("should ignore an answer that arrives after it was stopped", async () => {
    let answer: (online: boolean) => void = () => undefined;
    const probe = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    );
    const onChange = jest.fn();
    const { appState } = fakeAppState("active");
    const stop = watchConnection({ probe, onChange, appState });

    stop();
    answer(false);
    await jest.advanceTimersByTimeAsync(0);

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("useIsOnline", () => {
  afterEach(async () => {
    await act(() => {
      onlineManager.setOnline(true);
    });
  });

  it("should report online, and offline once React Query's online manager says so, and online again", async () => {
    const { result } = await renderHook(() => useIsOnline());
    expect(result.current).toBe(true);

    await act(() => {
      onlineManager.setOnline(false);
    });
    expect(result.current).toBe(false);

    await act(() => {
      onlineManager.setOnline(true);
    });
    expect(result.current).toBe(true);
  });
});

describe("feedFocusManager", () => {
  const removeSubscription = jest.fn();
  let appStateListeners: ((state: AppStateStatus) => void)[];
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <KeyLowProvider client={diaryClient} queryClient={queryClient}>
      {children}
    </KeyLowProvider>
  );
  const renderDiaryDay = ({ enabled }: { enabled: boolean }) =>
    renderHook(() => useDiaryDay("2026-10-15", { enabled }), { wrapper });
  const changeAppState = (state: AppStateStatus) =>
    act(() => {
      appStateListeners.forEach((listener) => {
        listener(state);
      });
    });

  beforeEach(async () => {
    resetDiaryBackend();
    await signInDiaryClient();
    // The sign in asked the fake server who the user is, which is not what the tests count.
    diaryBackend.requests = [];
    queryClient = createDiaryQueryClient();
    appStateListeners = [];
    removeSubscription.mockClear();
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener): NativeEventSubscription => {
        appStateListeners.push(listener);
        return { remove: removeSubscription };
      });
    feedFocusManager();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    queryClient.clear();
    // The browser's own listener, which the manager had before the app replaced it.
    focusManager.setEventListener(() => undefined);
    focusManager.setFocused(undefined);
  });

  it("should refetch a stale diary read once when the app comes back to the foreground", async () => {
    const { result } = await renderDiaryDay({ enabled: true });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const requestsPerRead = diaryBackend.requests.length;

    await changeAppState("background");
    await changeAppState("active");

    await waitFor(() => {
      expect(diaryBackend.requests).toHaveLength(requestsPerRead * 2);
    });
    expect(result.current.isFetching).toBe(false);
  });

  it("should not refetch when the app goes to the background", async () => {
    const { result } = await renderDiaryDay({ enabled: true });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const requestsAfterTheFirstRead = diaryBackend.requests.length;

    await changeAppState("background");

    expect(result.current.isFetching).toBe(false);
    expect(diaryBackend.requests).toHaveLength(requestsAfterTheFirstRead);
  });

  it("should fetch nothing on return to the foreground while the reads are disabled, as under the terms gate", async () => {
    await renderDiaryDay({ enabled: false });

    await changeAppState("background");
    await changeAppState("active");

    expect(diaryBackend.requests).toHaveLength(0);
  });

  it("should remove its subscription to the app state when the last query goes", async () => {
    const { unmount } = await renderDiaryDay({ enabled: true });
    expect(appStateListeners).toHaveLength(1);
    expect(removeSubscription).not.toHaveBeenCalled();

    await unmount();

    expect(removeSubscription).toHaveBeenCalledTimes(1);
  });
});
