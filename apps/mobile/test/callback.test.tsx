import { render, screen, waitFor } from "@testing-library/react-native";

import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { resetSupabaseMock, mockSupabaseClient } from "./support/supabaseMock";
import CallbackRoute from "../app/auth/callback";

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

  it("should exchange the PKCE code for a session and go to the diary", async () => {
    routerMock.searchParams = { code: "pkce-code" };

    await render(<CallbackRoute />);

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/diary");
    });
    expect(mockSupabaseClient.auth.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
  });

  it("should verify a token hash link and go to the diary", async () => {
    routerMock.searchParams = { token_hash: "hash", type: "email" };

    await render(<CallbackRoute />);

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/diary");
    });
    expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash",
      type: "email",
    });
  });

  it("should show the error and stay put when the code exchange fails", async () => {
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { message: "Code expired" },
    });
    routerMock.searchParams = { code: "stale" };

    await render(<CallbackRoute />);

    expect(await screen.findByText("Code expired")).toBeOnTheScreen();
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(mockSupabaseClient.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it("should explain when the link carries no code", async () => {
    await render(<CallbackRoute />);

    expect(await screen.findByText("This sign-in link is not valid")).toBeOnTheScreen();
    expect(mockSupabaseClient.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockSupabaseClient.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("should reject a token hash link with an unknown type", async () => {
    routerMock.searchParams = { token_hash: "hash", type: "bogus" };

    await render(<CallbackRoute />);

    expect(await screen.findByText("This sign-in link is not valid")).toBeOnTheScreen();
    expect(mockSupabaseClient.auth.verifyOtp).not.toHaveBeenCalled();
  });
});
