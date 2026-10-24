import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";

import { useBodyCompositionAccess } from "../../components/WeightScreen/useBodyCompositionAccess";
import { getHealthProvider } from "../../lib/health";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { createFakeHealthProvider } from "../support/fakeHealthProvider";

import type { FakeHealthProvider } from "../support/fakeHealthProvider";
import type { AppStateStatus, NativeEventSubscription } from "react-native";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock("../../lib/health/getHealthProvider", () => ({ getHealthProvider: jest.fn() }));

let provider: FakeHealthProvider;
let foregroundListeners: ((state: AppStateStatus) => void)[];

describe("useBodyCompositionAccess", () => {
  beforeEach(() => {
    resetRouterMock();
    provider = createFakeHealthProvider();
    jest.mocked(getHealthProvider).mockReturnValue(provider);
    foregroundListeners = [];
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener): NativeEventSubscription => {
        foregroundListeners.push(listener);
        return { remove: jest.fn() };
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be unread until the provider has answered", async () => {
    let answer: (access: { bodyFat: boolean; leanMass: boolean }) => void = () => undefined;
    provider.bodyCompositionAccess = () =>
      new Promise((resolve) => {
        answer = resolve;
      });

    const { result } = await renderHook(() => useBodyCompositionAccess());

    expect(result.current).toBeNull();

    await act(() => {
      answer({ bodyFat: true, leanMass: false });
    });

    await waitFor(() => {
      expect(result.current).toEqual({ bodyFat: true, leanMass: false });
    });
  });

  it("should stay unread where there is no provider", async () => {
    jest.mocked(getHealthProvider).mockReturnValue(null);

    const { result } = await renderHook(() => useBodyCompositionAccess());

    expect(result.current).toBeNull();
  });

  it.each([
    { bodyFat: true, leanMass: true },
    { bodyFat: true, leanMass: false },
    { bodyFat: false, leanMass: true },
    { bodyFat: false, leanMass: false },
  ])("should read what the provider says is allowed: %j", async (access) => {
    provider.state.bodyCompositionAccess = access;

    const { result } = await renderHook(() => useBodyCompositionAccess());

    await waitFor(() => {
      expect(result.current).toEqual(access);
    });
  });

  it("should read a provider that throws as nothing granted", async () => {
    provider.bodyCompositionAccess = () => Promise.reject(new Error("not today"));

    const { result } = await renderHook(() => useBodyCompositionAccess());

    await waitFor(() => {
      expect(result.current).toEqual({ bodyFat: false, leanMass: false });
    });
  });

  it("should never ask for permission or read a sample", async () => {
    provider.state.bodyCompositionAccess = { bodyFat: true, leanMass: true };

    const { result } = await renderHook(() => useBodyCompositionAccess());
    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    const methods = provider.calls.map((call) => call.method);

    expect(methods).not.toContain("requestPermission");
    expect(methods).not.toContain("requestBodyCompositionPermission");
    expect(methods).not.toContain("readWeightSince");
    expect(methods).not.toContain("readBodyCompositionSince");
  });

  it("should read again on returning to the foreground", async () => {
    const { result } = await renderHook(() => useBodyCompositionAccess());
    await waitFor(() => {
      expect(result.current).toEqual({ bodyFat: false, leanMass: false });
    });
    provider.state.bodyCompositionAccess = { bodyFat: true, leanMass: true };

    await act(() => {
      foregroundListeners.forEach((listener) => {
        listener("active");
      });
    });

    await waitFor(() => {
      expect(result.current).toEqual({ bodyFat: true, leanMass: true });
    });
  });

  it("should read again when the screen is focused again, as after the permission flow closes", async () => {
    const { result, rerender } = await renderHook(() => useBodyCompositionAccess());
    await waitFor(() => {
      expect(result.current).toEqual({ bodyFat: false, leanMass: false });
    });
    provider.state.bodyCompositionAccess = { bodyFat: false, leanMass: true };

    routerMock.isFocused = false;
    await rerender({});
    routerMock.isFocused = true;
    await rerender({});

    await waitFor(() => {
      expect(result.current).toEqual({ bodyFat: false, leanMass: true });
    });
  });

  it("should not read again for a change to the background", async () => {
    const { result } = await renderHook(() => useBodyCompositionAccess());
    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });
    const readsBefore = provider.calls.filter((call) => call.method === "bodyCompositionAccess");

    await act(() => {
      foregroundListeners.forEach((listener) => {
        listener("background");
      });
    });

    expect(provider.calls.filter((call) => call.method === "bodyCompositionAccess")).toHaveLength(
      readsBefore.length,
    );
  });
});
