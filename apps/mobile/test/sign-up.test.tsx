import { LEGAL_URLS, TERMS_VERSION } from "@keylow/core/copy";
import { AuthApiError } from "@supabase/supabase-js";
import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";

import { resetRouterMock } from "./support/expoRouterMock";
import { googleIdToken, mockGoogleSignin, resetGoogleSignInMock } from "./support/googleSignInMock";
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

const acceptanceSentence =
  "I accept the Terms and the Privacy Policy, including storing my weight, food diary, body stats and workouts to run the app.";

async function tickAcceptance() {
  await userEvent.setup().press(screen.getByRole("checkbox", { name: acceptanceSentence }));
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await renderAuthScreen(<SignUpRoute />);
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await tickAcceptance();
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
      options: {
        emailRedirectTo: "keylow://auth/callback",
        data: { terms_version: TERMS_VERSION },
      },
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
    it("should head the screen Create account, under the Ki-Lo mark", async () => {
      await renderAuthScreen(<SignUpRoute />);

      expect(screen.getByRole("heading", { name: "Create account" })).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: "Ki-Lo" })).toBeOnTheScreen();
    });

    it("should say what Ki-Lo does under the heading", async () => {
      await renderAuthScreen(<SignUpRoute />);

      expect(
        screen.getByText("Track intake and weigh-ins. The engine estimates the rest."),
      ).toBeOnTheScreen();
    });

    it("should divide the Google button from the email fields with an or", async () => {
      await renderAuthScreen(<SignUpRoute />);

      expect(screen.getByText("or")).toBeOnTheScreen();
    });

    it("should show the example address in the email field before anything is typed", async () => {
      await renderAuthScreen(<SignUpRoute />);

      expect(screen.getByPlaceholderText("you@example.com")).toBe(screen.getByLabelText("Email"));
    });

    it("should say the password rule as the placeholder of the password field", async () => {
      await renderAuthScreen(<SignUpRoute />);

      expect(screen.getByPlaceholderText("At least 8 characters")).toBe(
        screen.getByLabelText("Password"),
      );
    });

    it("should not repeat the password rule as text under the field", async () => {
      await renderAuthScreen(<SignUpRoute />);

      expect(screen.queryByText("At least 8 characters")).not.toBeOnTheScreen();
    });

    it("should say the problem under the password field when the password is too short", async () => {
      await fillAndSubmit("zee@example.com", "abc");

      expect(await screen.findByText("Password must be at least 8 characters")).toBeOnTheScreen();
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

  describe("the acceptance checkbox", () => {
    it("should start unticked", async () => {
      await renderAuthScreen(<SignUpRoute />);

      expect(screen.getByRole("checkbox", { name: acceptanceSentence })).not.toBeChecked();
    });

    it("should tick when pressed", async () => {
      await renderAuthScreen(<SignUpRoute />);

      await tickAcceptance();

      expect(screen.getByRole("checkbox", { name: acceptanceSentence })).toBeChecked();
    });

    it("should keep Create account disabled until the box is ticked", async () => {
      await renderAuthScreen(<SignUpRoute />);
      expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();

      await tickAcceptance();

      expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
    });

    it("should keep Continue with Google disabled until the box is ticked", async () => {
      await renderAuthScreen(<SignUpRoute />);
      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();

      await tickAcceptance();

      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    });

    it("should disable both buttons again when the box is unticked", async () => {
      await renderAuthScreen(<SignUpRoute />);
      await tickAcceptance();

      await tickAcceptance();

      expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    });

    it("should not call Supabase when Create account is pressed before the box is ticked", async () => {
      const user = userEvent.setup();
      await renderAuthScreen(<SignUpRoute />);
      await user.type(screen.getByLabelText("Email"), "zee@example.com");
      await user.type(screen.getByLabelText("Password"), "password123");

      await user.press(screen.getByRole("button", { name: "Create account" }));

      expect(mockSupabaseClient.auth.signUp).not.toHaveBeenCalled();
    });

    describe("the links in the sentence", () => {
      let openURL: jest.SpyInstance;

      beforeEach(() => {
        openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      });

      afterEach(() => {
        openURL.mockRestore();
      });

      it("should open the Terms and leave the box unticked", async () => {
        const user = userEvent.setup();
        await renderAuthScreen(<SignUpRoute />);

        await user.press(screen.getByRole("link", { name: "Terms" }));

        expect(openURL).toHaveBeenCalledTimes(1);
        expect(openURL).toHaveBeenCalledWith(LEGAL_URLS.terms);
        expect(screen.getByRole("checkbox", { name: acceptanceSentence })).not.toBeChecked();
      });

      it("should open the Privacy Policy and leave the box unticked", async () => {
        const user = userEvent.setup();
        await renderAuthScreen(<SignUpRoute />);

        await user.press(screen.getByRole("link", { name: "Privacy Policy" }));

        expect(openURL).toHaveBeenCalledTimes(1);
        expect(openURL).toHaveBeenCalledWith(LEGAL_URLS.privacy);
        expect(screen.getByRole("checkbox", { name: acceptanceSentence })).not.toBeChecked();
      });

      it("should stay on the screen when the device has no browser to open a link", async () => {
        openURL.mockRejectedValue(new Error("no browser"));
        const user = userEvent.setup();
        await renderAuthScreen(<SignUpRoute />);

        await user.press(screen.getByRole("link", { name: "Terms" }));

        expect(screen.getByRole("heading", { name: "Create account" })).toBeOnTheScreen();
      });
    });
  });

  describe("Continue with Google", () => {
    async function tickAndPressGoogle() {
      const user = userEvent.setup();
      await renderAuthScreen(<SignUpRoute />);
      await tickAcceptance();
      await user.press(screen.getByRole("button", { name: "Continue with Google" }));
    }

    beforeEach(() => {
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({ data: {}, error: null });
      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should sign in with Google through the same button as the sign-in screen", async () => {
      await tickAndPressGoogle();

      expect(mockSupabaseClient.auth.signInWithIdToken).toHaveBeenCalledWith({
        provider: "google",
        token: googleIdToken,
      });
    });

    it("should record the acceptance of the exact terms version once the sign-in has succeeded", async () => {
      await tickAndPressGoogle();

      await waitFor(() => {
        expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("accept_terms", {
          p_version: TERMS_VERSION,
        });
      });
      expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(1);
      expect(mockSupabaseClient.auth.signInWithIdToken.mock.invocationCallOrder[0]).toBeLessThan(
        mockSupabaseClient.rpc.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it("should not record the acceptance when the person cancels the Google sheet", async () => {
      mockGoogleSignin.signIn.mockResolvedValue({ type: "cancelled", data: null });

      await tickAndPressGoogle();

      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    it("should not record the acceptance when Supabase refuses the token", async () => {
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        data: {},
        error: new AuthApiError("Unacceptable audience in id_token", 400, "bad_jwt"),
      });

      await tickAndPressGoogle();

      expect(await screen.findByRole("alert")).toBeOnTheScreen();
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    it("should neither block the sign-in nor show anything when recording the acceptance fails", async () => {
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: "raw database text: P0002 profile missing", code: "P0002" },
      });

      await tickAndPressGoogle();

      await waitFor(() => {
        expect(mockSupabaseClient.rpc).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
      });
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
    });

    it("should not block the sign-in when recording the acceptance throws", async () => {
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
      mockSupabaseClient.rpc.mockRejectedValue(new Error("network down"));

      await tickAndPressGoogle();

      await waitFor(() => {
        expect(mockSupabaseClient.rpc).toHaveBeenCalled();
      });
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
  });
});
