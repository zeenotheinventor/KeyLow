import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { screen, userEvent, waitFor } from "@testing-library/react-native";

import { resetRouterMock } from "./support/expoRouterMock";
import {
  clearGoogleClientIds,
  googleIdToken,
  mockGoogleSignin,
  resetGoogleSignInMock,
} from "./support/googleSignInMock";
import { renderAuthScreen } from "./support/renderAuthScreen";
import { resetSupabaseMock, mockSupabaseClient } from "./support/supabaseMock";
import SignInRoute from "../app/(auth)/sign-in";

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
  await renderAuthScreen(<SignInRoute />);
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

    expect(await screen.findByText("Enter your email address")).toBeOnTheScreen();
    expect(await screen.findByText("Enter your password")).toBeOnTheScreen();
    expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("should reject a malformed email", async () => {
    await fillAndSubmit("not-an-email", "password123");

    expect(await screen.findByText("Enter a valid email address")).toBeOnTheScreen();
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

  describe("the screen", () => {
    it("should head the screen Welcome back, under the Ki-Lo mark", async () => {
      await renderAuthScreen(<SignInRoute />);

      expect(screen.getByRole("heading", { name: "Welcome back" })).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: "Ki-Lo" })).toBeOnTheScreen();
    });

    it("should label the two fields in words, and not only with a placeholder", async () => {
      await renderAuthScreen(<SignInRoute />);

      expect(screen.getByText("Email")).toBeOnTheScreen();
      expect(screen.getByText("Password")).toBeOnTheScreen();
    });

    it("should not offer the sign up password helper", async () => {
      await renderAuthScreen(<SignInRoute />);

      expect(screen.queryByText("At least 8 characters")).not.toBeOnTheScreen();
    });

    it("should not ask for the terms to be accepted", async () => {
      await renderAuthScreen(<SignInRoute />);

      expect(screen.queryByRole("checkbox")).not.toBeOnTheScreen();
      expect(screen.queryByRole("link", { name: "Terms" })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    });

    it("should ask the person who is new to Ki-Lo to create an account", async () => {
      await renderAuthScreen(<SignInRoute />);

      expect(screen.getByText("New to Ki-Lo?")).toBeOnTheScreen();
    });
  });

  describe("when sign-in is refused", () => {
    it("should say the fixed sentence for wrong credentials, as an alert", async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {},
        error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
      });

      await fillAndSubmit("zee@example.com", "password123");

      expect(
        await screen.findByRole("alert", {
          name: "Email or password is not right. Check them and try again.",
        }),
      ).toBeOnTheScreen();
      expect(screen.queryByText("Invalid login credentials")).not.toBeOnTheScreen();
    });

    it("should say the fixed sentence for a failed connection", async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {},
        error: new AuthRetryableFetchError("Failed to fetch", 0),
      });

      await fillAndSubmit("zee@example.com", "password123");

      expect(
        await screen.findByText(
          "Ki-Lo could not reach the server. Check your connection and try again.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText("Failed to fetch")).not.toBeOnTheScreen();
    });

    it("should never show the message of an error it has no sentence for", async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {},
        error: new AuthApiError(
          "raw server text: AuthApiError 500 relation auth.users",
          500,
          "unexpected_failure",
        ),
      });

      await fillAndSubmit("zee@example.com", "password123");

      expect(await screen.findByText("Something went wrong. Try again.")).toBeOnTheScreen();
      expect(screen.queryByText(/raw server text/)).not.toBeOnTheScreen();
    });

    it("should never show the message of an error with no code at all", async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {},
        error: { message: "raw server text without a code" },
      });

      await fillAndSubmit("zee@example.com", "password123");

      expect(await screen.findByText("Something went wrong. Try again.")).toBeOnTheScreen();
      expect(screen.queryByText(/raw server text/)).not.toBeOnTheScreen();
    });

    it("should keep what was typed so the person can correct it", async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {},
        error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
      });

      await fillAndSubmit("zee@example.com", "password123");
      await screen.findByRole("alert");

      expect(screen.getByLabelText("Email")).toHaveDisplayValue("zee@example.com");
      expect(screen.getByLabelText("Password")).toHaveDisplayValue("password123");
    });

    it("should take the sentence away when the next attempt is not valid, so the notice never sits under field errors", async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: {},
        error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
      });
      const user = userEvent.setup();
      await fillAndSubmit("zee@example.com", "password123");
      await screen.findByRole("alert");

      await user.clear(screen.getByLabelText("Email"));
      await user.press(screen.getByRole("button", { name: "Sign in" }));

      expect(await screen.findByText("Enter your email address")).toBeOnTheScreen();
      expect(
        screen.queryByText("Email or password is not right. Check them and try again."),
      ).not.toBeOnTheScreen();
    });

    it("should take the sentence away when the next attempt starts", async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
        data: {},
        error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
      });
      mockSupabaseClient.auth.signInWithPassword.mockReturnValueOnce(new Promise(() => undefined));
      const user = userEvent.setup();
      await fillAndSubmit("zee@example.com", "password123");
      await screen.findByRole("alert");

      await user.press(screen.getByRole("button", { name: "Sign in" }));

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
  });

  describe("while the sign-in is under way", () => {
    beforeEach(() => {
      mockSupabaseClient.auth.signInWithPassword.mockReturnValue(new Promise(() => undefined));
    });

    it("should show the Sign in button busy, and not pressable again", async () => {
      await fillAndSubmit("zee@example.com", "password123");

      // The label stays under the spinner, so the button is still named by it.
      const button = screen.getByRole("button", { name: /Sign in/, busy: true });
      expect(button).toBeDisabled();
      expect(screen.getByRole("progressbar", { name: "Loading" })).toBeOnTheScreen();
    });

    it("should dim the Google button and stop it responding", async () => {
      await fillAndSubmit("zee@example.com", "password123");

      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    });

    it("should keep what was typed on view", async () => {
      await fillAndSubmit("zee@example.com", "password123");

      expect(screen.getByLabelText("Email")).toHaveDisplayValue("zee@example.com");
    });
  });

  it("should not send any terms version with a password sign-in", async () => {
    await fillAndSubmit("zee@example.com", "password123");

    expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "zee@example.com",
      password: "password123",
    });
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
  });

  it("should link to the sign-up screen", async () => {
    await renderAuthScreen(<SignInRoute />);

    expect(screen.getByRole("link", { name: "Create account" })).toBeOnTheScreen();
  });

  describe("Continue with Google", () => {
    async function pressGoogleButton() {
      const user = userEvent.setup();
      await renderAuthScreen(<SignInRoute />);
      await user.press(screen.getByRole("button", { name: "Continue with Google" }));
    }

    it("should be enabled", async () => {
      await renderAuthScreen(<SignInRoute />);

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

      expect(await screen.findByText("Something went wrong. Try again.")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    });

    it("should show an error when Google returns no ID token", async () => {
      mockGoogleSignin.signIn.mockResolvedValue({ type: "success", data: { idToken: null } });

      await pressGoogleButton();

      expect(await screen.findByText("Something went wrong. Try again.")).toBeOnTheScreen();
      expect(mockSupabaseClient.auth.signInWithIdToken).not.toHaveBeenCalled();
    });

    it("should never show the Supabase message when the token exchange fails", async () => {
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        data: {},
        error: new AuthApiError("Unacceptable audience in id_token", 400, "bad_jwt"),
      });

      await pressGoogleButton();

      expect(await screen.findByText("Something went wrong. Try again.")).toBeOnTheScreen();
      expect(screen.queryByText(/Unacceptable audience/)).not.toBeOnTheScreen();
    });

    it("should say the generic sentence when the Google client ids are missing", async () => {
      clearGoogleClientIds();

      await pressGoogleButton();

      expect(await screen.findByText("Something went wrong. Try again.")).toBeOnTheScreen();
      expect(mockGoogleSignin.signIn).not.toHaveBeenCalled();
    });

    it("should not record any terms acceptance after a successful sign-in", async () => {
      await pressGoogleButton();

      await waitFor(() => {
        expect(mockSupabaseClient.auth.signInWithIdToken).toHaveBeenCalled();
      });
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    it("should not show a coming soon note", async () => {
      await renderAuthScreen(<SignInRoute />);

      expect(screen.queryByText(/coming soon/i)).not.toBeOnTheScreen();
    });
  });
});
