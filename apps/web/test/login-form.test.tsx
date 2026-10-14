import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/app/login/LoginForm";

const { signInWithPassword, signUp, signInWithOAuth, push, refresh } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword, signUp, signInWithOAuth } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const SIGN_IN_REFUSED = "Email or password is not right. Check them and try again.";
const GENERIC_ERROR = "Something went wrong. Try again.";

function fillForm(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("client-side validation", () => {
    it("should show an error and not sign in when the email is empty", () => {
      render(<LoginForm />);
      fillForm("", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      expect(screen.getByText("Enter your email address")).toBeTruthy();
      expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
      expect(signInWithPassword).not.toHaveBeenCalled();
    });

    it("should show an error and not sign in when the email is malformed", () => {
      render(<LoginForm />);
      fillForm("not-an-email", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      expect(screen.getByText("Enter a valid email address")).toBeTruthy();
      expect(signInWithPassword).not.toHaveBeenCalled();
    });

    it("should show an error and not sign in when the password is empty", () => {
      render(<LoginForm />);
      fillForm("ada@example.com", "");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      expect(screen.getByText("Enter your password")).toBeTruthy();
      expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBe("true");
      expect(signInWithPassword).not.toHaveBeenCalled();
    });

    it("should name each field error as the description of its field", () => {
      render(<LoginForm />);
      fillForm("", "");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      expect(screen.getByLabelText("Email").getAttribute("aria-describedby")).toBe(
        screen.getByText("Enter your email address").id,
      );
      expect(screen.getByLabelText("Password").getAttribute("aria-describedby")).toBe(
        screen.getByText("Enter your password").id,
      );
    });

    it("should let a password shorter than 8 characters sign in", async () => {
      signInWithPassword.mockResolvedValue({ data: {}, error: null });
      render(<LoginForm />);
      fillForm("ada@example.com", "short");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/dashboard");
      });
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "short",
      });
    });

    it("should show an error and not create an account when the password is shorter than 8 characters", () => {
      render(<LoginForm />);
      fillForm("ada@example.com", "short");

      fireEvent.click(screen.getByRole("button", { name: "Create account" }));

      expect(screen.getByText("Password must be at least 8 characters")).toBeTruthy();
      expect(signUp).not.toHaveBeenCalled();
    });
  });

  describe("signing in", () => {
    it("should call signInWithPassword with the entered values and open the dashboard", async () => {
      signInWithPassword.mockResolvedValue({ data: {}, error: null });
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/dashboard");
      });
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "password123",
      });
      expect(refresh).toHaveBeenCalled();
    });

    it("should show the fixed sentence for refused credentials and stay on the page", async () => {
      signInWithPassword.mockResolvedValue({
        data: {},
        error: { message: "Invalid login credentials", code: "invalid_credentials" },
      });
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      expect((await screen.findByRole("alert")).textContent).toBe(SIGN_IN_REFUSED);
      expect(screen.queryByText("Invalid login credentials")).toBeNull();
      expect(push).not.toHaveBeenCalled();
    });

    it("should never show a message the server sent that has no sentence of its own", async () => {
      signInWithPassword.mockResolvedValue({
        data: {},
        error: { message: "pg timeout reading auth.users at 10.0.0.4", code: "unexpected_failure" },
      });
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      expect((await screen.findByRole("alert")).textContent).toBe(GENERIC_ERROR);
      expect(document.body.textContent).not.toContain("10.0.0.4");
    });

    it("should say the server could not be reached when the request failed to send", async () => {
      signInWithPassword.mockResolvedValue({
        data: {},
        error: new AuthRetryableFetchError("Failed to fetch", 0),
      });
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Ki-Lo could not reach the server. Check your connection and try again.",
      );
    });
  });

  describe("creating an account", () => {
    it("should call signUp with the entered values and open the dashboard when a session is returned", async () => {
      signUp.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Create account" }));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/dashboard");
      });
      expect(signUp).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "password123",
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      expect(refresh).toHaveBeenCalled();
    });

    it("should tell the user to check their email, naming the address, when no session is returned", async () => {
      signUp.mockResolvedValue({ data: { session: null }, error: null });
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Create account" }));

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
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Create account" }));

      expect((await screen.findByRole("alert")).textContent).toBe(
        "An account with this email already exists. Sign in instead.",
      );
      expect(screen.queryByText("User already registered")).toBeNull();
    });

    it("should clear the check-your-email notice when signing in again", async () => {
      signUp.mockResolvedValue({ data: { session: null }, error: null });
      signInWithPassword.mockResolvedValue({
        data: {},
        error: { message: "Email not confirmed", code: "email_not_confirmed" },
      });
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");
      fireEvent.click(screen.getByRole("button", { name: "Create account" }));
      await screen.findByRole("status");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      await screen.findByRole("alert");
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  describe("pending state", () => {
    it("should show a spinner on Sign in and disable the other two buttons", async () => {
      signInWithPassword.mockReturnValue(new Promise(() => undefined));
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      const signingIn = await screen.findByRole("button", { name: "Signing in" });
      expect(signingIn.getAttribute("aria-busy")).toBe("true");
      expect(screen.getByRole("button", { name: "Create account" }).hasAttribute("disabled")).toBe(
        true,
      );
      expect(
        screen.getByRole("button", { name: "Continue with Google" }).hasAttribute("disabled"),
      ).toBe(true);
    });

    it("should enable the buttons again and show an error when the request throws", async () => {
      signInWithPassword.mockRejectedValue(new Error("network down"));
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      expect((await screen.findByRole("alert")).textContent).toBe(GENERIC_ERROR);
      expect(screen.getByRole("button", { name: "Sign in" }).hasAttribute("disabled")).toBe(false);
      expect(screen.getByRole("button", { name: "Create account" }).hasAttribute("disabled")).toBe(
        false,
      );
    });
  });

  describe("Google sign-in", () => {
    it("should show an enabled Google button", () => {
      render(<LoginForm />);

      const googleButton = screen.getByRole("button", { name: "Continue with Google" });

      expect(googleButton.hasAttribute("disabled")).toBe(false);
    });

    it("should carry the Google mark as a decorative image", () => {
      render(<LoginForm />);

      const mark = screen
        .getByRole("button", { name: "Continue with Google" })
        .querySelector("img");

      expect(mark?.getAttribute("alt")).toBe("");
      expect(mark?.getAttribute("src")).toContain("google-g.svg");
    });

    it("should start the Google OAuth flow with the callback route as the redirect", async () => {
      signInWithOAuth.mockResolvedValue({ data: {}, error: null });
      render(<LoginForm />);

      fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

      await waitFor(() => {
        expect(signInWithOAuth).toHaveBeenCalledTimes(1);
      });
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: "http://localhost:3000/auth/callback" },
      });
    });

    it("should show the generic sentence, not the server message, when Google sign-in fails", async () => {
      signInWithOAuth.mockResolvedValue({
        data: {},
        error: { message: "Unsupported provider: provider is not enabled" },
      });
      render(<LoginForm />);

      fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

      expect((await screen.findByRole("alert")).textContent).toBe(GENERIC_ERROR);
      expect(push).not.toHaveBeenCalled();
    });

    it("should disable all three buttons while the Google request runs", async () => {
      signInWithOAuth.mockReturnValue(new Promise(() => undefined));
      render(<LoginForm />);

      fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

      const opening = await screen.findByRole("button", { name: "Opening Google" });
      expect(opening.hasAttribute("disabled")).toBe(true);
      expect(screen.getByRole("button", { name: "Sign in" }).hasAttribute("disabled")).toBe(true);
      expect(screen.getByRole("button", { name: "Create account" }).hasAttribute("disabled")).toBe(
        true,
      );
    });

    it("should show an error and enable the buttons again when the request throws", async () => {
      signInWithOAuth.mockRejectedValue(new Error("network down"));
      render(<LoginForm />);

      fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

      expect((await screen.findByRole("alert")).textContent).toBe(GENERIC_ERROR);
      expect(
        screen.getByRole("button", { name: "Continue with Google" }).hasAttribute("disabled"),
      ).toBe(false);
    });
  });

  describe("link errors", () => {
    it("should show the link error passed in by the page", () => {
      render(<LoginForm linkError="That sign-in link could not be verified." />);

      expect(screen.getByRole("alert").textContent).toBe(
        "That sign-in link could not be verified.",
      );
    });
  });
});
