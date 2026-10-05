import { render, screen, userEvent, waitFor } from "@testing-library/react-native";

import { resetRouterMock } from "./support/expoRouterMock";
import {
  clearGoogleClientIds,
  googleIdToken,
  mockGoogleSignin,
  resetGoogleSignInMock,
} from "./support/googleSignInMock";
import { resetSupabaseMock, mockSupabaseClient } from "./support/supabaseMock";
import SignInRoute from "../app/(auth)/sign-in";

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
  await render(<SignInRoute />);
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.press(screen.getByRole("button", { name: "Sign in" }));
}

describe("sign-in screen", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
    resetGoogleSignInMock();
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should ask for an email and a password when the form is empty", async () => {
    await fillAndSubmit("", "");

    expect(screen.getByText("Enter your email address")).toBeOnTheScreen();
    expect(screen.getByText("Enter your password")).toBeOnTheScreen();
    expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("should reject a malformed email", async () => {
    await fillAndSubmit("not-an-email", "password123");

    expect(screen.getByText("Enter a valid email address")).toBeOnTheScreen();
    expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("should submit a password shorter than eight characters", async () => {
    await fillAndSubmit("zee@example.com", "abc123");

    expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "zee@example.com",
      password: "abc123",
    });
  });

  it("should re-enable the button and show an error when sign-in throws", async () => {
    mockSupabaseClient.auth.signInWithPassword.mockRejectedValue(new Error("network down"));

    await fillAndSubmit("zee@example.com", "password123");

    expect(await screen.findByText("Something went wrong. Try again.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("should sign in with the typed email and password", async () => {
    await fillAndSubmit("zee@example.com", "password123");

    expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "zee@example.com",
      password: "password123",
    });
  });

  it("should show the error message when sign-in fails", async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: "Invalid login credentials" },
    });

    await fillAndSubmit("zee@example.com", "password123");

    expect(await screen.findByText("Invalid login credentials")).toBeOnTheScreen();
  });

  it("should link to the sign-up screen", async () => {
    await render(<SignInRoute />);

    expect(screen.getByRole("link", { name: "Create account" })).toBeOnTheScreen();
  });

  describe("Continue with Google", () => {
    async function pressGoogleButton() {
      const user = userEvent.setup();
      await render(<SignInRoute />);
      await user.press(screen.getByRole("button", { name: "Continue with Google" }));
    }

    it("should be enabled", async () => {
      await render(<SignInRoute />);

      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    });

    it("should exchange the native ID token with Supabase after the native sheet returns", async () => {
      await pressGoogleButton();

      expect(mockGoogleSignin.signIn).toHaveBeenCalledTimes(1);
      expect(mockSupabaseClient.auth.signInWithIdToken).toHaveBeenCalledWith({
        provider: "google",
        token: googleIdToken,
      });
      expect(mockGoogleSignin.signIn.mock.invocationCallOrder[0]).toBeLessThan(
        mockSupabaseClient.auth.signInWithIdToken.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it("should disable both buttons while the native sheet is open", async () => {
      let finishSignIn: (response: unknown) => void = () => undefined;
      mockGoogleSignin.signIn.mockReturnValue(
        new Promise((resolve) => {
          finishSignIn = resolve;
        }),
      );

      await pressGoogleButton();

      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();

      finishSignIn({ type: "cancelled", data: null });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
      });
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    });

    it("should show nothing and skip Supabase when the user cancels the sheet", async () => {
      mockGoogleSignin.signIn.mockResolvedValue({ type: "cancelled", data: null });

      await pressGoogleButton();

      expect(mockSupabaseClient.auth.signInWithIdToken).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    });

    it("should show an error and re-enable the buttons when the native sheet rejects", async () => {
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
      mockGoogleSignin.signIn.mockRejectedValue(new Error("DEVELOPER_ERROR"));

      await pressGoogleButton();

      expect(await screen.findByText("Google sign-in failed. Try again.")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    });

    it("should show an error when Google returns no ID token", async () => {
      mockGoogleSignin.signIn.mockResolvedValue({ type: "success", data: { idToken: null } });

      await pressGoogleButton();

      expect(
        await screen.findByText("Google did not return an ID token. Try again."),
      ).toBeOnTheScreen();
      expect(mockSupabaseClient.auth.signInWithIdToken).not.toHaveBeenCalled();
    });

    it("should show the Supabase error message when the token exchange fails", async () => {
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        data: {},
        error: { message: "Unacceptable audience in id_token" },
      });

      await pressGoogleButton();

      expect(await screen.findByText("Unacceptable audience in id_token")).toBeOnTheScreen();
    });

    it("should explain that Google sign-in is not configured when the client ids are missing", async () => {
      clearGoogleClientIds();

      await pressGoogleButton();

      expect(await screen.findByText("Google sign-in is not configured yet")).toBeOnTheScreen();
      expect(mockGoogleSignin.signIn).not.toHaveBeenCalled();
    });

    it("should not show a coming soon note", async () => {
      await render(<SignInRoute />);

      expect(screen.queryByText(/coming soon/i)).not.toBeOnTheScreen();
    });
  });
});
