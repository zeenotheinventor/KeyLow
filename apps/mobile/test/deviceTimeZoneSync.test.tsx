import { KeyLowProvider, useProfileTimeZone, useSyncTimeZone } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react-native";
import { AppState, Text } from "react-native";

import { AuthGate } from "../components/AuthGate";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import {
  emitAuthStateChange,
  fakeSession,
  mockSupabaseClient,
  resetSupabaseMock,
} from "./support/supabaseMock";
import {
  createTestQueryClient,
  resetTermsBackend,
  termsBackend,
  termsClient,
} from "./support/termsBackend";

import type * as ApiClient from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { AppStateStatus, NativeEventSubscription } from "react-native";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));
// The hook that writes is proved in the api-client package. Here it is a spy, for what the app hands it.
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<typeof ApiClient>("@keylow/api-client"),
  useSyncTimeZone: jest.fn(),
  useProfileTimeZone: jest.fn(),
}));

const syncSpy = jest.mocked(useSyncTimeZone);
const profileTimeZoneSpy = jest.mocked(useProfileTimeZone);

let queryClient: QueryClient;
let deviceTimeZone: string;
const removeForegroundListener = jest.fn();
let foregroundListeners: ((state: AppStateStatus) => void)[];

function renderApp() {
  queryClient = createTestQueryClient();
  return render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={termsClient} queryClient={queryClient}>
        <AuthGate>
          <Text>Protected content</Text>
        </AuthGate>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

function signIn() {
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: fakeSession },
    error: null,
  });
}

const callsWithEnabled = (enabled: boolean) =>
  syncSpy.mock.calls.filter(([input]) => input.enabled === enabled);

describe("syncing the device time zone to the profile", () => {
  beforeEach(() => {
    resetRouterMock();
    routerMock.segments = ["(tabs)", "diary"];
    resetSupabaseMock();
    resetTermsBackend();
    deviceTimeZone = "Europe/London";
    foregroundListeners = [];
    removeForegroundListener.mockClear();
    syncSpy.mockReset();
    profileTimeZoneSpy.mockReset();
    profileTimeZoneSpy.mockReturnValue({ data: "UTC" } as ReturnType<typeof useProfileTimeZone>);
    jest.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(() => ({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: deviceTimeZone,
    }));
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener): NativeEventSubscription => {
        foregroundListeners.push(listener);
        return { remove: removeForegroundListener };
      });
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.restoreAllMocks();
  });

  it("should attempt the sync with the device zone and the profile zone when the app opens signed in and the terms are accepted", async () => {
    signIn();
    termsBackend.row = {
      terms_accepted_at: "2026-10-15T09:30:00+00:00",
      terms_version: TERMS_VERSION,
    };

    await renderApp();

    await waitFor(() => {
      expect(syncSpy).toHaveBeenLastCalledWith({
        deviceTimeZone: "Europe/London",
        profileTimeZone: "UTC",
        enabled: true,
      });
    });
  });

  it("should pass enabled false and read no profile zone while the terms gate is up", async () => {
    signIn();
    termsBackend.row = null;

    await renderApp();

    await waitFor(() => {
      expect(termsBackend.readCount).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Protected content")).not.toBeOnTheScreen();
    expect(syncSpy).toHaveBeenCalled();
    expect(callsWithEnabled(true)).toEqual([]);
    expect(profileTimeZoneSpy).toHaveBeenCalledWith({ enabled: false });
    expect(profileTimeZoneSpy).not.toHaveBeenCalledWith({ enabled: true });
  });

  it("should do nothing while signed out", async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await renderApp();

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
    });
    expect(syncSpy).not.toHaveBeenCalled();
    expect(profileTimeZoneSpy).not.toHaveBeenCalled();
  });

  it("should attempt the sync with the new device zone when the app returns to the foreground", async () => {
    signIn();
    termsBackend.row = {
      terms_accepted_at: "2026-10-15T09:30:00+00:00",
      terms_version: TERMS_VERSION,
    };
    await renderApp();
    await waitFor(() => {
      expect(callsWithEnabled(true)).not.toEqual([]);
    });

    deviceTimeZone = "America/New_York";
    await act(() => {
      foregroundListeners.forEach((listener) => {
        listener("active");
      });
    });

    expect(syncSpy).toHaveBeenLastCalledWith({
      deviceTimeZone: "America/New_York",
      profileTimeZone: "UTC",
      enabled: true,
    });
  });

  it("should not read the device zone again when the app goes to the background", async () => {
    signIn();
    termsBackend.row = {
      terms_accepted_at: "2026-10-15T09:30:00+00:00",
      terms_version: TERMS_VERSION,
    };
    await renderApp();
    await waitFor(() => {
      expect(callsWithEnabled(true)).not.toEqual([]);
    });

    deviceTimeZone = "America/New_York";
    await act(() => {
      foregroundListeners.forEach((listener) => {
        listener("background");
      });
    });

    expect(syncSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ deviceTimeZone: "Europe/London" }),
    );
  });

  it("should stop listening for the foreground once the user signs out", async () => {
    signIn();
    termsBackend.row = {
      terms_accepted_at: "2026-10-15T09:30:00+00:00",
      terms_version: TERMS_VERSION,
    };
    await renderApp();
    await waitFor(() => {
      expect(callsWithEnabled(true)).not.toEqual([]);
    });

    await act(() => {
      emitAuthStateChange("SIGNED_OUT", null);
    });

    expect(removeForegroundListener).toHaveBeenCalled();
  });
});
