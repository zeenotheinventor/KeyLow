import { KeyLowProvider } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthGate } from "../../components/AuthGate";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { fakeSession, mockSupabaseClient, resetSupabaseMock } from "../support/supabaseMock";
import {
  createTestQueryClient,
  resetTermsBackend,
  termsBackend,
  termsClient,
} from "../support/termsBackend";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock("../../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("../support/supabaseMock")
    .mockSupabaseClient,
}));

async function renderGate() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={termsClient} queryClient={createTestQueryClient()}>
        <AuthGate>
          <Text>Food screen</Text>
        </AuthGate>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

// The root layout wraps the whole stack in AuthGate, so the food routes need no guard of their own.
// These cases pin that a deep link to keylow://foods/new is covered by it.
describe("food routes behind the auth gate", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
    resetTermsBackend();
    // A signed in user here has accepted the current Terms, so the terms gate stays out of the way.
    termsBackend.row = {
      terms_accepted_at: "2026-10-15T09:30:00+00:00",
      terms_version: TERMS_VERSION,
    };
    routerMock.segments = ["foods", "new"];
  });

  it("should send a signed-out deep link to the new food screen to sign-in", async () => {
    await renderGate();

    expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
  });

  it("should send a signed-out deep link to the edit screen to sign-in", async () => {
    routerMock.segments = ["foods", "[id]", "edit"];

    await renderGate();

    expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
  });

  it("should leave a signed-in user on the food screen", async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });

    await renderGate();

    // The screen shows once the terms gate has read the acceptance.
    expect(await screen.findByText("Food screen")).toBeOnTheScreen();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
