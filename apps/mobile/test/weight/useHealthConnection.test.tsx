import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";

import { useHealthConnection } from "../../components/WeightScreen/useHealthConnection";
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

describe("useHealthConnection", () => {
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

  it("should be checking until the provider has answered", async () => {
    let answer: (availability: "available") => void = () => undefined;
    provider.availability = () =>
      new Promise((resolve) => {
        answer = resolve;
      });

    const { result } = await renderHook(() => useHealthConnection());

    expect(result.current).toBe("checking");

    await act(() => {
      answer("available");
    });

    await waitFor(() => {
      expect(result.current).toBe("not-connected");
    });
  });

  it("should be unavailable where there is no provider", async () => {
    jest.mocked(getHealthProvider).mockReturnValue(null);

    const { result } = await renderHook(() => useHealthConnection());

    expect(result.current).toBe("unavailable");
  });

  it("should be unavailable where Health Connect is unsupported", async () => {
    provider.state.availability = "unsupported";

    const { result } = await renderHook(() => useHealthConnection());

    await waitFor(() => {
      expect(result.current).toBe("unavailable");
    });
  });

  it("should be connected when Health Connect is available and permission is held", async () => {
    provider.state.permissionGranted = true;

    const { result } = await renderHook(() => useHealthConnection());

    await waitFor(() => {
      expect(result.current).toBe("connected");
    });
  });

  it.each(["available", "needs-install"] as const)(
    "should be not connected when permission is not held and Health Connect is %s",
    async (availability) => {
      provider.state.availability = availability;

      const { result } = await renderHook(() => useHealthConnection());

      await waitFor(() => {
        expect(result.current).toBe("not-connected");
      });
    },
  );

  it("should be not connected when hasPermission rejects", async () => {
    provider.state.failures.hasPermission = "failed";

    const { result } = await renderHook(() => useHealthConnection());

    await waitFor(() => {
      expect(result.current).toBe("not-connected");
    });
  });

  it("should be unavailable when availability rejects", async () => {
    provider.availability = () => Promise.reject(new Error("unavailable"));

    const { result } = await renderHook(() => useHealthConnection());

    await waitFor(() => {
      expect(result.current).toBe("unavailable");
    });
  });

  it("should never ask for permission or read weight", async () => {
    const { result } = await renderHook(() => useHealthConnection());
    await waitFor(() => {
      expect(result.current).toBe("not-connected");
    });

    expect(provider.calls.map((call) => call.method)).not.toContain("requestPermission");
    expect(provider.calls.map((call) => call.method)).not.toContain("readWeightSince");
  });

  it("should check again on returning to the foreground", async () => {
    const { result } = await renderHook(() => useHealthConnection());
    await waitFor(() => {
      expect(result.current).toBe("not-connected");
    });
    provider.state.permissionGranted = true;

    await act(() => {
      foregroundListeners.forEach((listener) => {
        listener("active");
      });
    });

    await waitFor(() => {
      expect(result.current).toBe("connected");
    });
  });

  it("should check again when the screen is focused again, as after the permission flow closes", async () => {
    const { result, rerender } = await renderHook(() => useHealthConnection());
    await waitFor(() => {
      expect(result.current).toBe("not-connected");
    });
    provider.state.permissionGranted = true;

    routerMock.isFocused = false;
    await rerender({});
    routerMock.isFocused = true;
    await rerender({});

    await waitFor(() => {
      expect(result.current).toBe("connected");
    });
  });
});
