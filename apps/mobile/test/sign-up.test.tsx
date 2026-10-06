import { render, screen, userEvent } from "@testing-library/react-native";

import { resetRouterMock } from "./support/expoRouterMock";
import { googleIdToken, resetGoogleSignInMock } from "./support/googleSignInMock";
import { fakeSession, resetSupabaseMock, mockSupabaseClient } from "./support/supabaseMock";
import SignUpRoute from "../app/(auth)/sign-up";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: jest.requireActual<{ mockGoogleSignin: unknown }>("./support/googleSignInMock")
    .mockGoogleSignin,
}));
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

const confirmMessage = "Check your email to confirm your account";

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await render(<SignUpRoute />);
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.press(screen.getByRole("button", { name: "Create account" }));
}

describe("sign-up screen", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
    resetGoogleSignInMock();
  });

  it("should reject a malformed email and a short password without calling Supabase", async () => {
    await fillAndSubmit("nope", "short");

    expect(await screen.findByText("Enter a valid email address")).toBeOnTheScreen();
    expect(await screen.findByText("Password must be at least 8 characters")).toBeOnTheScreen();
    expect(mockSupabaseClient.auth.signUp).not.toHaveBeenCalled();
  });

  it("should sign up with the typed values and the app callback URL", async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });

    await fillAndSubmit("zee@example.com", "password123");

    expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
      email: "zee@example.com",
      password: "password123",
      options: { emailRedirectTo: "keylow://auth/callback" },
    });
  });

  it("should ask the user to confirm their email when no session comes back", async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });

    await fillAndSubmit("zee@example.com", "password123");

    expect(await screen.findByText(confirmMessage)).toBeOnTheScreen();
  });

  it("should not ask for confirmation when a session comes back", async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });

    await fillAndSubmit("zee@example.com", "password123");

    expect(mockSupabaseClient.auth.signUp).toHaveBeenCalled();
    expect(screen.queryByText(confirmMessage)).not.toBeOnTheScreen();
  });

  it("should show the error message when sign-up fails", async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: { message: "Password is too weak" },
    });

    await fillAndSubmit("zee@example.com", "password123");

    expect(await screen.findByText("Password is too weak")).toBeOnTheScreen();
  });

  it("should link back to the sign-in screen", async () => {
    await render(<SignUpRoute />);

    expect(screen.getByRole("link", { name: "Sign in" })).toBeOnTheScreen();
  });

  it("should sign in with Google through the same button as the sign-in screen", async () => {
    mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    await render(<SignUpRoute />);

    await user.press(screen.getByRole("button", { name: "Continue with Google" }));

    expect(mockSupabaseClient.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: "google",
      token: googleIdToken,
    });
  });
});
