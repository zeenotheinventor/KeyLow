import { KeyLowProvider } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { setUser } from "@sentry/react-native";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { act, cleanup, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthGate } from "../components/AuthGate";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import {
  emitAuthStateChange,
  fakeSession,
  resetSupabaseMock,
  mockSupabaseClient,
  unsubscribeMock,
} from "./support/supabaseMock";
import {
  createTestQueryClient,
  resetTermsBackend,
  termsBackend,
  termsClient,
} from "./support/termsBackend";

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

let queryClient: QueryClient;

// A signed in user in these tests has accepted the current Terms, so the terms gate has nothing to say.
async function renderGate(
  readStoredUserId: () => Promise<string | null> = () => Promise.resolve(null),
) {
  queryClient = createTestQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={termsClient} queryClient={queryClient}>
        <AuthGate readStoredUserId={readStoredUserId}>
          <Text>Protected content</Text>
        </AuthGate>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

describe("AuthGate", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
    resetTermsBackend();
    termsBackend.row = {
      terms_accepted_at: "2026-10-15T09:30:00+00:00",
      terms_version: TERMS_VERSION,
    };
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("should redirect to sign-in when there is no session and the route is in the tabs", async () => {
    routerMock.segments = ["(tabs)", "diary"];

    await renderGate();

    expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
  });

  it("should redirect to the dashboard when a session exists and the route is in the auth group", async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
    routerMock.segments = ["(auth)", "sign-in"];

    await renderGate();

    expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/dashboard");
  });

  it("should not redirect while the session is still loading", async () => {
    mockSupabaseClient.auth.getSession.mockReturnValue(new Promise(() => undefined));
    routerMock.segments = ["(tabs)", "diary"];

    await renderGate();

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("should leave a signed-out user on the auth callback route", async () => {
    routerMock.segments = ["auth", "callback"];

    await renderGate();

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("should leave a signed-out user on the sign-in screen", async () => {
    routerMock.segments = ["(auth)", "sign-in"];

    await renderGate();

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("should leave a signed-in user in the tabs", async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
    routerMock.segments = ["(tabs)", "diary"];

    await renderGate();

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  describe("when Supabase answers with no session and an error", () => {
    it("should keep a signed in user in the tabs when the error is a lost connection", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new AuthRetryableFetchError("Network request failed", 0),
      });
      routerMock.segments = ["(tabs)", "diary"];

      await renderGate();

      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should not undo that when Supabase then repeats the first event with no session", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new AuthRetryableFetchError("Network request failed", 0),
      });
      routerMock.segments = ["(tabs)", "diary"];
      await renderGate();

      await act(() => {
        emitAuthStateChange("INITIAL_SESSION", null);
      });

      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should still sign the user out when Supabase then reports a sign out", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new AuthRetryableFetchError("Network request failed", 0),
      });
      routerMock.segments = ["(tabs)", "diary"];
      await renderGate();

      await act(() => {
        emitAuthStateChange("SIGNED_OUT", null);
      });

      expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
    });

    it("should redirect to sign-in when the error is not a lost connection", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new AuthApiError("Invalid Refresh Token", 400, "refresh_token_not_found"),
      });
      routerMock.segments = ["(tabs)", "diary"];

      await renderGate();

      expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
    });
  });

  it("should redirect to sign-in when the user signs out", async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
    routerMock.segments = ["(tabs)", "more"];
    await renderGate();

    await act(() => {
      emitAuthStateChange("SIGNED_OUT", null);
    });

    expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
  });

  describe("the user Sentry reports errors for", () => {
    beforeEach(() => {
      jest.mocked(setUser).mockClear();
    });

    it("should be the signed in account's id, and nothing else about them", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { ...fakeSession, user: { ...fakeSession.user, email: "a@b.com" } } },
        error: null,
      });
      routerMock.segments = ["(tabs)", "diary"];

      await renderGate();

      expect(setUser).toHaveBeenCalledWith({ id: "user-id" });
      expect(JSON.stringify(jest.mocked(setUser).mock.calls)).not.toContain("a@b.com");
    });

    it("should be the stored account's id while Supabase has not answered", async () => {
      mockSupabaseClient.auth.getSession.mockReturnValue(new Promise(() => undefined));
      routerMock.segments = ["(tabs)", "diary"];

      await renderGate(() => Promise.resolve("stored-user-id"));

      expect(setUser).toHaveBeenCalledWith({ id: "stored-user-id" });
    });

    it("should be the account that signs in", async () => {
      routerMock.segments = ["(auth)", "sign-in"];
      await renderGate();

      await act(() => {
        emitAuthStateChange("SIGNED_IN", fakeSession);
      });

      expect(setUser).toHaveBeenCalledWith({ id: "user-id" });
    });

    // Supabase answers after the stored id is read, as it does while it tries to refresh an expired token.
    type SessionAnswer = Awaited<ReturnType<typeof mockSupabaseClient.auth.getSession>>;
    async function renderWithStoredAccountThenAnswer(answer: SessionAnswer) {
      let answerSession: (answer: SessionAnswer) => void = () => undefined;
      mockSupabaseClient.auth.getSession.mockReturnValue(
        new Promise<SessionAnswer>((resolve) => {
          answerSession = resolve;
        }),
      );
      routerMock.segments = ["(tabs)", "diary"];
      await renderGate(() => Promise.resolve("stored-user-id"));
      expect(setUser).toHaveBeenCalledWith({ id: "stored-user-id" });

      await act(() => {
        answerSession(answer);
      });
    }

    it("should be cleared when Supabase finds no session for the stored account", async () => {
      await renderWithStoredAccountThenAnswer({
        data: { session: null },
        error: new AuthApiError("Invalid Refresh Token", 400, "refresh_token_not_found"),
      });

      expect(setUser).toHaveBeenLastCalledWith(null);
    });

    it("should be kept when Supabase cannot be reached, which leaves the stored account signed in", async () => {
      await renderWithStoredAccountThenAnswer({
        data: { session: null },
        error: new AuthRetryableFetchError("Network request failed", 0),
      });

      expect(setUser).not.toHaveBeenCalledWith(null);
    });

    it("should be set once for the account, however many times its session is refreshed", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: fakeSession },
        error: null,
      });
      routerMock.segments = ["(tabs)", "more"];
      await renderGate();

      await act(() => {
        emitAuthStateChange("TOKEN_REFRESHED", fakeSession);
      });

      expect(setUser).toHaveBeenCalledTimes(1);
    });

    it("should be cleared when the user signs out", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: fakeSession },
        error: null,
      });
      routerMock.segments = ["(tabs)", "more"];
      await renderGate();

      await act(() => {
        emitAuthStateChange("SIGNED_OUT", null);
      });

      expect(setUser).toHaveBeenLastCalledWith(null);
    });
  });

  describe("the Storybook route", () => {
    afterEach(() => {
      delete process.env.EXPO_PUBLIC_STORYBOOK;
    });

    it("should leave a signed-out user on the Storybook route when the Storybook flag is on", async () => {
      process.env.EXPO_PUBLIC_STORYBOOK = "true";
      routerMock.segments = ["storybook"];

      await renderGate();

      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should redirect a signed-out user off the Storybook route when the Storybook flag is not set", async () => {
      routerMock.segments = ["storybook"];

      await renderGate();

      expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
    });

    it("should redirect a signed-out user off the Storybook route when the Storybook flag is false", async () => {
      process.env.EXPO_PUBLIC_STORYBOOK = "false";
      routerMock.segments = ["storybook"];

      await renderGate();

      expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
    });

    it("should still redirect a signed-out user in the tabs when the Storybook flag is on", async () => {
      process.env.EXPO_PUBLIC_STORYBOOK = "true";
      routerMock.segments = ["(tabs)", "diary"];

      await renderGate();

      expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
    });
  });

  it("should cover its children with the Ki-Lo mark until the stored session is read", async () => {
    mockSupabaseClient.auth.getSession.mockReturnValue(new Promise(() => undefined));

    await renderGate();

    expect(screen.getByRole("img", { name: "Ki-Lo" })).toBeOnTheScreen();
  });

  it("should take the cover away once the stored session is read", async () => {
    await renderGate();

    expect(screen.queryByRole("img", { name: "Ki-Lo" })).not.toBeOnTheScreen();
  });

  it("should render its children", async () => {
    await renderGate();

    expect(screen.getByText("Protected content")).toBeOnTheScreen();
  });

  it("should unsubscribe from auth changes when it unmounts", async () => {
    await renderGate();

    await screen.unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });
});
