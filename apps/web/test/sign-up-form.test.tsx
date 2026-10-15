import { TERMS_VERSION } from "@keylow/core/copy";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SignUpForm } from "@/app/sign-up/SignUpForm";

const { signUp, signInWithOAuth, push, refresh } = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signUp, signInWithOAuth } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const GENERIC_ERROR = "Something went wrong. Try again.";
const ACCEPTANCE_NAME =
  "I accept the Terms and the Privacy Policy, including storing my weight, food diary and body stats to run the app.";

function fillForm(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
}

const acceptTerms = () => {
  fireEvent.click(screen.getByRole("checkbox", { name: ACCEPTANCE_NAME }));
};
const createAccountButton = () => screen.getByRole("button", { name: "Create account" });
const googleButton = () => screen.getByRole("button", { name: "Continue with Google" });

describe("SignUpForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    document.cookie = "kl-terms-pending=; path=/; max-age=0";
  });

  afterEach(() => {
    cleanup();
  });

  describe("accepting the Terms", () => {
    it("should offer an unticked checkbox named by the whole sentence", () => {
      render(<SignUpForm />);

      expect(screen.getByRole("checkbox", { name: ACCEPTANCE_NAME })).toHaveProperty(
        "checked",
        false,
      );
    });

    it("should link the Terms and the Privacy Policy from the sentence", () => {
      render(<SignUpForm />);

      expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms");
      expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe(
        "/privacy",
      );
    });

    it("should keep Create account and Google disabled until the box is ticked", () => {
      render(<SignUpForm />);

      expect(createAccountButton().hasAttribute("disabled")).toBe(true);
      expect(googleButton().hasAttribute("disabled")).toBe(true);
    });

    it("should enable Create account and Google once the box is ticked", () => {
      render(<SignUpForm />);

      acceptTerms();

      expect(createAccountButton().hasAttribute("disabled")).toBe(false);
      expect(googleButton().hasAttribute("disabled")).toBe(false);
    });

    it("should disable them again when the box is unticked", () => {
      render(<SignUpForm />);
      acceptTerms();

      acceptTerms();

      expect(createAccountButton().hasAttribute("disabled")).toBe(true);
      expect(googleButton().hasAttribute("disabled")).toBe(true);
    });

    it("should not create an account when Enter is pressed in a field before the box is ticked", () => {
      render(<SignUpForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.submit(screen.getByLabelText("Email"));

      expect(signUp).not.toHaveBeenCalled();
    });
  });

  describe("a ticked box left behind by a Google attempt", () => {
    const leaveGoogleAttemptBehind = async () => {
      signInWithOAuth.mockReturnValue(new Promise(() => undefined));
      acceptTerms();
      fireEvent.click(googleButton());
      await screen.findByRole("button", { name: "Opening Google" });
      expect(document.cookie).toContain("kl-terms-pending");
    };

    it("should clear the cookie when the box is unticked", () => {
      document.cookie = `kl-terms-pending=${TERMS_VERSION}; path=/`;
      render(<SignUpForm />);
      acceptTerms();

      acceptTerms();

      expect(document.cookie).not.toContain("kl-terms-pending");
    });

    it("should clear the cookie when the email form is submitted", async () => {
      document.cookie = `kl-terms-pending=${TERMS_VERSION}; path=/`;
      signUp.mockResolvedValue({ data: { session: null }, error: null });
      render(<SignUpForm />);
      fillForm("ada@example.com", "password123");
      acceptTerms();

      fireEvent.click(createAccountButton());

      await screen.findByRole("status");
      expect(document.cookie).not.toContain("kl-terms-pending");
    });

    it("should clear the cookie when the email form is submitted with a problem in a field", () => {
      document.cookie = `kl-terms-pending=${TERMS_VERSION}; path=/`;
      render(<SignUpForm />);
      fillForm("", "password123");
      acceptTerms();

      fireEvent.click(createAccountButton());

      expect(document.cookie).not.toContain("kl-terms-pending");
    });

    it("should leave the cookie alone while the box stays ticked", async () => {
      render(<SignUpForm />);

      await leaveGoogleAttemptBehind();
    });
  });

  describe("the fields", () => {
    it("should hint at the password length and the email shape with placeholders", () => {
      render(<SignUpForm />);

      expect(screen.getByLabelText("Email").getAttribute("placeholder")).toBe("you@example.com");
      expect(screen.getByLabelText("Password").getAttribute("placeholder")).toBe(
        "At least 8 characters",
      );
    });

    it("should show an error and not create an account when the email is empty", () => {
      render(<SignUpForm />);
      fillForm("", "password123");
      acceptTerms();

      fireEvent.click(createAccountButton());

      expect(screen.getByText("Enter your email address")).toBeTruthy();
      expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
      expect(signUp).not.toHaveBeenCalled();
    });

    it("should show an error and not create an account when the email is malformed", () => {
      render(<SignUpForm />);
      fillForm("not-an-email", "password123");
      acceptTerms();

      fireEvent.click(createAccountButton());

      expect(screen.getByText("Enter a valid email address")).toBeTruthy();
      expect(signUp).not.toHaveBeenCalled();
    });

    it("should show an error and not create an account when the password is shorter than 8 characters", () => {
      render(<SignUpForm />);
      fillForm("ada@example.com", "short");
      acceptTerms();

      fireEvent.click(createAccountButton());

      expect(screen.getByText("Password must be at least 8 characters")).toBeTruthy();
      expect(signUp).not.toHaveBeenCalled();
    });
  });

  describe("creating an account", () => {
    it("should call signUp with the entered values and the accepted version, and open the dashboard when a session is returned", async () => {
      signUp.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
      render(<SignUpForm />);
      fillForm(" ada@example.com ", "password123");
      acceptTerms();

      fireEvent.click(createAccountButton());

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/dashboard");
      });
      expect(signUp).toHaveBeenCalledTimes(1);
      expect(signUp).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "password123",
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { terms_version: TERMS_VERSION },
        },
      });
      expect(refresh).toHaveBeenCalled();
    });

    it("should tell the user to check their email, naming the address, when no session is returned", async () => {
      signUp.mockResolvedValue({ data: { session: null }, error: null });
      render(<SignUpForm />);
      fillForm("ada@example.com", "password123");
      acceptTerms();

      fireEvent.click(createAccountButton());

      const notice = await screen.findByRole("status");
      expect(notice.textContent).toBe(
        "Check your emailOpen the confirmation link sent to ada@example.com to finish creating your account.",
      );
      expect(push).not.toHaveBeenCalled();
    });

    it("should show the fixed sentence when the account already exists", async () => {
      signUp.mockResolvedValue({
        data: { session: null },
        error: { message: "User already registered", code: "user_already_exists" },
      });
      render(<SignUpForm />);
      fillForm("ada@example.com", "password123");
      acceptTerms();

      fireEvent.click(createAccountButton());

      expect((await screen.findByRole("alert")).textContent).toBe(
        "An account with this email already exists. Sign in instead.",
      );
      expect(screen.queryByText("User already registered")).toBeNull();
    });

    it("should show a spinner on Create account and hold Google back while it runs", async () => {
      signUp.mockReturnValue(new Promise(() => undefined));
      render(<SignUpForm />);
      fillForm("ada@example.com", "password123");
      acceptTerms();

      fireEvent.click(createAccountButton());

      const creating = await screen.findByRole("button", { name: "Creating account" });
      expect(creating.getAttribute("aria-busy")).toBe("true");
      expect(googleButton().hasAttribute("disabled")).toBe(true);
    });

    it("should show the generic sentence and enable the buttons again when the request throws", async () => {
      signUp.mockRejectedValue(new Error("network down"));
      render(<SignUpForm />);
      fillForm("ada@example.com", "password123");
      acceptTerms();

      fireEvent.click(createAccountButton());

      expect((await screen.findByRole("alert")).textContent).toBe(GENERIC_ERROR);
      expect(createAccountButton().hasAttribute("disabled")).toBe(false);
    });
  });

  describe("Google sign-up", () => {
    it("should mark the accepted version in a short-lived cookie and start the OAuth flow", async () => {
      signInWithOAuth.mockResolvedValue({ data: {}, error: null });
      render(<SignUpForm />);
      acceptTerms();

      fireEvent.click(googleButton());

      await waitFor(() => {
        expect(signInWithOAuth).toHaveBeenCalledTimes(1);
      });
      expect(document.cookie).toContain(`kl-terms-pending=${TERMS_VERSION}`);
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: "http://localhost:3000/auth/callback" },
      });
    });

    it("should set no cookie and start nothing while the box is unticked", () => {
      render(<SignUpForm />);

      fireEvent.click(googleButton());

      expect(document.cookie).not.toContain("kl-terms-pending");
      expect(signInWithOAuth).not.toHaveBeenCalled();
    });

    it("should show the generic sentence and remove the cookie when Google sign-in fails", async () => {
      signInWithOAuth.mockResolvedValue({
        data: {},
        error: { message: "Unsupported provider: provider is not enabled" },
      });
      render(<SignUpForm />);
      acceptTerms();

      fireEvent.click(googleButton());

      expect((await screen.findByRole("alert")).textContent).toBe(GENERIC_ERROR);
      expect(document.cookie).not.toContain("kl-terms-pending");
    });

    it("should hold Create account back while the Google request runs", async () => {
      signInWithOAuth.mockReturnValue(new Promise(() => undefined));
      render(<SignUpForm />);
      acceptTerms();

      fireEvent.click(googleButton());

      const opening = await screen.findByRole("button", { name: "Opening Google" });
      expect(opening.hasAttribute("disabled")).toBe(true);
      expect(createAccountButton().hasAttribute("disabled")).toBe(true);
    });
  });
});
