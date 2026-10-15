import { KeyLowProvider } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { act, cleanup, render, waitFor } from "@testing-library/react-native";
import { AppState, Text } from "react-native";

import { AuthGate } from "../components/AuthGate";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import {
  profileBackend,
  profileClient,
  resetProfileBackend,
  signInProfileClient,
} from "./support/profileBackend";
import { fakeSession, mockSupabaseClient, resetSupabaseMock } from "./support/supabaseMock";
import { createTestQueryClient } from "./support/termsBackend";

import type { QueryClient } from "@tanstack/react-query";
import type { AppStateStatus } from "react-native";

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

let queryClient: QueryClient;
let foregroundListeners: ((state: AppStateStatus) => void)[];

// Nothing is written, so there is no event to wait for: give a stray request time to arrive.
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

function changeAppState(state: AppStateStatus) {
  return act(() => {
    foregroundListeners.forEach((listener) => {
      listener(state);
    });
  });
}

describe("retrying a failed time zone save", () => {
  beforeEach(async () => {
    resetRouterMock();
    routerMock.segments = ["(tabs)", "diary"];
    resetSupabaseMock();
    resetProfileBackend();
    await signInProfileClient();
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
    foregroundListeners = [];
    jest.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(() => ({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "Europe/London",
    }));
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      foregroundListeners.push(listener);
      return { remove: jest.fn() };
    });
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.restoreAllMocks();
  });

  it("should try a failed save again when the app returns to the foreground, and not when it goes to the background", async () => {
    profileBackend.terms = {
      terms_accepted_at: "2026-10-15T09:30:00+00:00",
      terms_version: TERMS_VERSION,
    };
    profileBackend.updateFails = true;
    queryClient = createTestQueryClient();
    await render(
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={profileClient} queryClient={queryClient}>
          <AuthGate>
            <Text>Protected content</Text>
          </AuthGate>
        </KeyLowProvider>
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(profileBackend.updateRequests).toEqual([{ timezone: "Europe/London" }]);
    });

    await changeAppState("background");
    await settle();
    expect(profileBackend.updateRequests).toHaveLength(1);

    await changeAppState("active");
    await waitFor(() => {
      expect(profileBackend.updateRequests).toHaveLength(2);
    });
  });
});
