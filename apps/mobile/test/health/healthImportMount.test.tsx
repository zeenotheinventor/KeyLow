import { KeyLowProvider } from "@keylow/api-client";
import { cleanup, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthGate } from "../../components/AuthGate";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { fakeSession, mockSupabaseClient, resetSupabaseMock } from "../support/supabaseMock";
import { createTestQueryClient, resetTermsBackend, termsClient } from "../support/termsBackend";

import type { QueryClient } from "@tanstack/react-query";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock("../../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("../support/supabaseMock")
    .mockSupabaseClient,
}));
// The reminders load expo-notifications, which warns outside a development build. Nothing here is about them.
jest.mock("../../components/ReminderTapRouting", () => ({ ReminderTapRouting: () => null }));
jest.mock("../../lib/reminderScheduler", () => ({
  useCancelRemindersWhenSignedOut: jest.fn(),
  useReminderScheduler: jest.fn(),
}));
// The hook is proved in useHealthImport.test.tsx. Here it is a marker, for where the gate mounts it.
jest.mock("../../components/HealthImportRunner", () => ({
  HealthImportRunner: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text: MarkerText } = require("react-native") as typeof import("react-native");
    return <MarkerText>Health import mounted</MarkerText>;
  },
}));

let queryClient: QueryClient;

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

describe("where the health import mounts", () => {
  beforeEach(() => {
    resetRouterMock();
    routerMock.segments = ["(tabs)", "diary"];
    resetSupabaseMock();
    resetTermsBackend();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("should mount for a signed in account", async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });

    await renderApp();

    await waitFor(() => {
      expect(screen.getByText("Health import mounted")).toBeOnTheScreen();
    });
  });

  it("should not mount while signed out", async () => {
    await renderApp();

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
    });
    expect(screen.queryByText("Health import mounted")).not.toBeOnTheScreen();
  });
});
