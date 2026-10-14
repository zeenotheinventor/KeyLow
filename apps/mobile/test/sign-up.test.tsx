import { AuthApiError } from "@supabase/supabase-js";
import { screen, userEvent } from "@testing-library/react-native";

import { resetRouterMock } from "./support/expoRouterMock";
import { googleIdToken, resetGoogleSignInMock } from "./support/googleSignInMock";
import { renderAuthScreen } from "./support/renderAuthScreen";
import { fakeSession, resetSupabaseMock, mockSupabaseClient } from "./support/supabaseMock";
import SignUpRoute from "../app/(auth)/sign-up";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
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

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await renderAuthScreen(<SignUpRoute />);
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

  it("should ask the user to confirm their email when no session comes back, naming the address", async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });

    await fillAndSubmit("zee@example.com", "password123");

    expect(
      await screen.findByRole("status", {
        name: "Check your email Open the confirmation link sent to zee@example.com to finish creating your account.",
      }),
    ).toBeOnTheScreen();
  });

  it("should name the address as it was sent, without the spaces round it that were typed", async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });

    await fillAndSubmit("  zee@example.com ", "password123");

    expect(
      await screen.findByText(
        "Open the confirmation link sent to zee@example.com to finish creating your account.",
      ),
    ).toBeOnTheScreen();
  });

  it("should not ask for confirmation when a session comes back", async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });

    await fillAndSubmit("zee@example.com", "password123");

    expect(mockSupabaseClient.auth.signUp).toHaveBeenCalled();
    expect(screen.queryByText("Check your email")).not.toBeOnTheScreen();
  });

  it("should say the fixed sentence for an account that already exists", async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError("User already registered", 422, "user_already_exists"),
    });

    await fillAndSubmit("zee@example.com", "password123");

    expect(
      await screen.findByRole("alert", {
        name: "An account with this email already exists. Sign in instead.",
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByText("User already registered")).not.toBeOnTheScreen();
  });

  it("should never show the message of an error it has no sentence for", async () => {
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: { message: "raw server text: Password is too weak" },
    });

    await fillAndSubmit("zee@example.com", "password123");

    expect(await screen.findByText("Something went wrong. Try again.")).toBeOnTheScreen();
    expect(screen.queryByText(/raw server text/)).not.toBeOnTheScreen();
  });

  describe("the screen", () => {
    it("should head the screen Create your account, under the Ki-Lo mark", async () => {
      await renderAuthScreen(<SignUpRoute />);

      expect(screen.getByRole("heading", { name: "Create your account" })).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: "Ki-Lo" })).toBeOnTheScreen();
    });

    it("should say the password rule under the password field", async () => {
      await renderAuthScreen(<SignUpRoute />);

      expect(screen.getByText("At least 8 characters")).toBeOnTheScreen();
    });

    it("should replace the rule with the problem when the password is too short", async () => {
      await fillAndSubmit("zee@example.com", "abc");

      expect(await screen.findByText("Password must be at least 8 characters")).toBeOnTheScreen();
      expect(screen.queryByText("At least 8 characters")).not.toBeOnTheScreen();
    });

    it("should ask for an email address when it is left empty", async () => {
      await fillAndSubmit("", "password123");

      expect(await screen.findByText("Enter your email address")).toBeOnTheScreen();
    });

    it("should ask the person who has an account to sign in", async () => {
      await renderAuthScreen(<SignUpRoute />);

      expect(screen.getByText("Already have an account?")).toBeOnTheScreen();
    });
  });

  it("should link back to the sign-in screen", async () => {
    await renderAuthScreen(<SignUpRoute />);

    expect(screen.getByRole("link", { name: "Sign in" })).toBeOnTheScreen();
  });

  it("should sign in with Google through the same button as the sign-in screen", async () => {
    mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    await renderAuthScreen(<SignUpRoute />);

    await user.press(screen.getByRole("button", { name: "Continue with Google" }));

    expect(mockSupabaseClient.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: "google",
      token: googleIdToken,
    });
  });
});
