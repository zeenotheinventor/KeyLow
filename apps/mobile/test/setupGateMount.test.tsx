import { KeyLowProvider } from "@keylow/api-client";
import { cleanup, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthGate } from "../components/AuthGate";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import {
  resetSetupBackend,
  savedProfile,
  setupBackend,
  setupClient,
  setupReads,
} from "./support/setupBackend";
import { fakeSession, mockSupabaseClient, resetSupabaseMock } from "./support/supabaseMock";

import type { QueryClient } from "@tanstack/react-query";

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
// The reminders load expo-notifications, which warns outside a development build. Nothing here is about them.
jest.mock("../components/ReminderTapRouting", () => ({ ReminderTapRouting: () => null }));
jest.mock("../lib/reminderScheduler", () => ({
  useCancelRemindersWhenSignedOut: jest.fn(),
  useReminderScheduler: jest.fn(),
}));
// The other runners are proved in their own tests. They have nothing to say about the setup.
jest.mock("../components/CheckinRunner", () => ({ CheckinRunner: () => null }));
jest.mock("../components/HealthImportRunner", () => ({ HealthImportRunner: () => null }));

let queryClient: QueryClient;

function renderApp() {
  queryClient = createDiaryQueryClient();
  return render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={setupClient} queryClient={queryClient}>
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

describe("where the first run setup gate mounts", () => {
  beforeEach(() => {
    resetRouterMock();
    routerMock.segments = ["(tabs)", "diary"];
    resetSupabaseMock();
    resetSetupBackend();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("should send a new account that has accepted the Terms from the tabs to the first run setup", async () => {
    signIn();

    await renderApp();

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/setup?mode=first-run");
    });
  });

  it("should leave an account that is set up where it is", async () => {
    signIn();
    setupBackend.profile = savedProfile;

    await renderApp();
    await waitFor(() => {
      expect(setupReads().map((request) => request.table)).toContain("profiles");
    });

    expect(routerMock.replace).not.toHaveBeenCalledWith("/setup?mode=first-run");
  });

  it("should send a new account nowhere before it has accepted the Terms", async () => {
    signIn();
    setupBackend.hasAcceptedTerms = false;

    await renderApp();

    expect(routerMock.replace).not.toHaveBeenCalledWith("/setup?mode=first-run");
    expect(setupReads()).toEqual([]);
  });

  it("should not mount, and so read nothing, while signed out", async () => {
    await renderApp();
    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
    });

    expect(setupReads()).toEqual([]);
    expect(routerMock.replace).not.toHaveBeenCalledWith("/setup?mode=first-run");
  });
});
