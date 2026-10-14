import { screen, userEvent, waitFor } from "@testing-library/react-native";

import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { renderAuthScreen } from "./support/renderAuthScreen";
import { resetSupabaseMock, mockSupabaseClient } from "./support/supabaseMock";
import CallbackRoute from "../app/auth/callback";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

describe("auth callback route", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    mockSupabaseClient.auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
  });

  it("should exchange the PKCE code for a session and go to the dashboard", async () => {
    routerMock.searchParams = { code: "pkce-code" };

    await renderAuthScreen(<CallbackRoute />);

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/dashboard");
    });
    expect(mockSupabaseClient.auth.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
  });

  it("should verify a token hash link and go to the dashboard", async () => {
    routerMock.searchParams = { token_hash: "hash", type: "email" };

    await renderAuthScreen(<CallbackRoute />);

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/dashboard");
    });
    expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash",
      type: "email",
    });
  });

  describe("while the link is being opened", () => {
    beforeEach(() => {
      mockSupabaseClient.auth.exchangeCodeForSession.mockReturnValue(new Promise(() => undefined));
      routerMock.searchParams = { code: "pkce-code" };
    });

    it("should say Signing you in, as a status", async () => {
      await renderAuthScreen(<CallbackRoute />);

      expect(screen.getByRole("status", { name: "Signing you in" })).toBeOnTheScreen();
    });

    it("should show no error and no way back yet", async () => {
      await renderAuthScreen(<CallbackRoute />);

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Back to sign in" })).not.toBeOnTheScreen();
    });
  });

  describe("when the link cannot be used", () => {
    it("should say the link is not valid, as an alert, and never the server's message", async () => {
      mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({
        data: {},
        error: { message: "Code expired" },
      });
      routerMock.searchParams = { code: "stale" };

      await renderAuthScreen(<CallbackRoute />);

      expect(
        await screen.findByRole("alert", {
          name: "Link not valid This sign-in link is not valid. It may have expired or already been used.",
        }),
      ).toBeOnTheScreen();
      expect(screen.queryByText("Code expired")).not.toBeOnTheScreen();
      expect(routerMock.replace).not.toHaveBeenCalled();
      expect(mockSupabaseClient.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    });

    it("should stop saying Signing you in", async () => {
      mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({
        data: {},
        error: { message: "Code expired" },
      });
      routerMock.searchParams = { code: "stale" };

      await renderAuthScreen(<CallbackRoute />);
      await screen.findByRole("alert");

      expect(screen.queryByRole("status", { name: "Signing you in" })).not.toBeOnTheScreen();
    });

    it("should say the link is not valid when the code exchange throws, and not spin for ever", async () => {
      mockSupabaseClient.auth.exchangeCodeForSession.mockRejectedValue(new Error("network down"));
      routerMock.searchParams = { code: "pkce-code" };

      await renderAuthScreen(<CallbackRoute />);

      expect(await screen.findByRole("alert", { name: /^Link not valid/ })).toBeOnTheScreen();
      expect(screen.queryByRole("status", { name: "Signing you in" })).not.toBeOnTheScreen();
      expect(screen.queryByText(/network down/)).not.toBeOnTheScreen();
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should say the link is not valid when the token hash check throws, and not spin for ever", async () => {
      mockSupabaseClient.auth.verifyOtp.mockRejectedValue(new Error("network down"));
      routerMock.searchParams = { token_hash: "hash", type: "email" };

      await renderAuthScreen(<CallbackRoute />);

      expect(await screen.findByRole("alert", { name: /^Link not valid/ })).toBeOnTheScreen();
      expect(screen.queryByRole("status", { name: "Signing you in" })).not.toBeOnTheScreen();
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should go back to sign-in from the button", async () => {
      const user = userEvent.setup();
      await renderAuthScreen(<CallbackRoute />);

      await user.press(await screen.findByRole("button", { name: "Back to sign in" }));

      expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
    });

    it("should never show the message of a failed token hash either", async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: {},
        error: { message: "Token has expired or is invalid" },
      });
      routerMock.searchParams = { token_hash: "hash", type: "email" };

      await renderAuthScreen(<CallbackRoute />);

      expect(await screen.findByRole("alert", { name: /^Link not valid/ })).toBeOnTheScreen();
      expect(screen.queryByText(/Token has expired/)).not.toBeOnTheScreen();
    });
  });

  it("should reject a token hash link with an unknown type", async () => {
    routerMock.searchParams = { token_hash: "hash", type: "bogus" };

    await renderAuthScreen(<CallbackRoute />);

    expect(await screen.findByRole("alert", { name: /^Link not valid/ })).toBeOnTheScreen();
    expect(mockSupabaseClient.auth.verifyOtp).not.toHaveBeenCalled();
  });
});
