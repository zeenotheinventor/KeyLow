import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/app/login/LoginForm";

const { signInWithPassword, signUp, push, refresh } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword, signUp } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

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
      expect(signInWithPassword).not.toHaveBeenCalled();
    });

    it("should let a password shorter than 8 characters sign in", async () => {
      signInWithPassword.mockResolvedValue({ data: {}, error: null });
      render(<LoginForm />);
      fillForm("ada@example.com", "short");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/diary");
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
    it("should call signInWithPassword with the entered values and open the diary", async () => {
      signInWithPassword.mockResolvedValue({ data: {}, error: null });
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/diary");
      });
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "password123",
      });
      expect(refresh).toHaveBeenCalled();
    });

    it("should show the error message and stay on the page when sign-in fails", async () => {
      signInWithPassword.mockResolvedValue({
        data: {},
        error: { message: "Invalid login credentials" },
      });
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      expect(await screen.findByText("Invalid login credentials")).toBeTruthy();
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe("creating an account", () => {
    it("should call signUp with the entered values and open the diary when a session is returned", async () => {
      signUp.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Create account" }));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/diary");
      });
      expect(signUp).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "password123",
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      expect(refresh).toHaveBeenCalled();
    });

    it("should ask the user to confirm their email when no session is returned", async () => {
      signUp.mockResolvedValue({ data: { session: null }, error: null });
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Create account" }));

      expect(await screen.findByText("Check your email to confirm your account")).toBeTruthy();
      expect(push).not.toHaveBeenCalled();
    });

    it("should show the error message when sign-up fails", async () => {
      signUp.mockResolvedValue({
        data: { session: null },
        error: { message: "User already registered" },
      });
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Create account" }));

      expect(await screen.findByText("User already registered")).toBeTruthy();
    });
  });

  describe("pending state", () => {
    it("should enable the buttons again and show an error when the request throws", async () => {
      signInWithPassword.mockRejectedValue(new Error("network down"));
      render(<LoginForm />);
      fillForm("ada@example.com", "password123");

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      expect(await screen.findByText("Something went wrong. Please try again.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Sign in" }).hasAttribute("disabled")).toBe(false);
      expect(screen.getByRole("button", { name: "Create account" }).hasAttribute("disabled")).toBe(
        false,
      );
    });
  });

  describe("Google sign-in", () => {
    it("should show a disabled Google button with a note that it arrives later", () => {
      render(<LoginForm />);

      const googleButton = screen.getByRole("button", { name: "Continue with Google" });

      expect(googleButton.hasAttribute("disabled")).toBe(true);
      expect(screen.getByText("Google sign-in is coming soon.")).toBeTruthy();
    });
  });

  describe("link errors", () => {
    it("should show the link error passed in by the page", () => {
      render(<LoginForm linkError="We could not verify that link. Please try again." />);

      expect(screen.getByText("We could not verify that link. Please try again.")).toBeTruthy();
    });
  });
});
