import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "@/app/forgot-password/ForgotPasswordForm";
import { setForgotPasswordEmail } from "@/lib/auth/forgotPasswordEmail";

const { resetPasswordForEmail, captureMessage, createClient } = vi.hoisted(() => {
  const resetPasswordForEmail = vi.fn();

  return {
    resetPasswordForEmail,
    captureMessage: vi.fn(),
    createClient: vi.fn(() => ({ auth: { resetPasswordForEmail } })),
  };
});

vi.mock("@/lib/supabase/client", () => ({ createClient }));
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

const EMAIL = "ada@example.com";
const NO_CONNECTION = "Ki-Lo could not reach the server. Check your connection and try again.";
const COOKIE_NAME = "kl-recovery-requested";

const answered = { error: null };
const noConnection = { error: { code: "network" } };

function clearCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}

function typeEmail(value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value } });
}

// Clicks, then lets the request's promises settle inside act, as a person waiting would.
function clickAndSettle(button: HTMLElement) {
  return act(() => {
    fireEvent.click(button);
    return Promise.resolve();
  });
}

async function sendLink() {
  await clickAndSettle(screen.getByRole("button", { name: "Send link" }));
}

async function reachTheSentPage() {
  resetPasswordForEmail.mockResolvedValueOnce(answered);
  render(<ForgotPasswordForm />);
  typeEmail(EMAIL);
  await sendLink();
}

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    resetPasswordForEmail.mockReset();
    captureMessage.mockReset();
    createClient.mockClear();
    sessionStorage.clear();
    clearCookie();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("the form", () => {
    it("should ask for the email under the reset heading", () => {
      render(<ForgotPasswordForm />);

      expect(screen.getByRole("heading", { level: 1, name: "Reset your password" })).toBeTruthy();
      expect(
        screen.getByText(
          "Enter the email you use for Ki-Lo. Ki-Lo will send a link to set a new password.",
        ),
      ).toBeTruthy();
      expect(screen.getByRole("textbox", { name: "Email" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Send link" })).toBeTruthy();
    });

    it("should link back to sign in", () => {
      render(<ForgotPasswordForm />);

      expect(screen.getByText(/Remembered it\?/)).toBeTruthy();
      expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    });

    it("should centre the footer with a 44 px link in the primary text", () => {
      render(<ForgotPasswordForm />);

      const link = screen.getByRole("link", { name: "Sign in" });
      expect(link.className).toContain("min-h-touch-target");
      expect(link.className).toContain("text-text-primary");
      expect(link.className).toContain("font-semibold");
    });

    it("should offer no navigation to the dashboard", () => {
      render(<ForgotPasswordForm />);

      expect(screen.queryByRole("navigation")).toBeNull();
    });

    it("should fill the email from the sign in page and clear the hand-off", () => {
      setForgotPasswordEmail(EMAIL);

      render(<ForgotPasswordForm />);

      expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Email" }).value).toBe(EMAIL);
      expect(sessionStorage.length).toBe(0);
    });

    it("should leave the field empty when nothing was handed over", () => {
      render(<ForgotPasswordForm />);

      expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Email" }).value).toBe("");
    });
  });

  describe("a malformed address", () => {
    it("should show the field error as an alert and send nothing", async () => {
      render(<ForgotPasswordForm />);
      typeEmail("qa@");

      await sendLink();

      expect(screen.getByRole("alert").textContent).toBe("Enter a valid email address");
      expect(screen.getByRole("textbox", { name: "Email" }).getAttribute("aria-invalid")).toBe(
        "true",
      );
      expect(resetPasswordForEmail).not.toHaveBeenCalled();
    });

    it("should ask for an address when the field is empty", async () => {
      render(<ForgotPasswordForm />);

      await sendLink();

      expect(screen.getByRole("alert").textContent).toBe("Enter your email address");
      expect(resetPasswordForEmail).not.toHaveBeenCalled();
    });

    it("should show the field error when the server refuses the address", async () => {
      resetPasswordForEmail.mockResolvedValueOnce({ error: { code: "email_address_invalid" } });
      render(<ForgotPasswordForm />);
      typeEmail(EMAIL);

      await sendLink();

      expect(screen.getByRole("alert").textContent).toBe("Enter a valid email address");
      expect(document.cookie).not.toContain(COOKIE_NAME);
    });
  });

  describe("while sending", () => {
    it("should show the spinner on the button and hold it inert", async () => {
      resetPasswordForEmail.mockReturnValueOnce(new Promise(() => undefined));
      render(<ForgotPasswordForm />);
      typeEmail(EMAIL);

      await sendLink();

      const button = screen.getByRole<HTMLButtonElement>("button", { name: "Sending link" });
      expect(button.disabled).toBe(true);
    });
  });

  describe("a request that is sent", () => {
    it("should ask for a link back to the callback of this origin, for the trimmed address", async () => {
      resetPasswordForEmail.mockResolvedValueOnce(answered);
      render(<ForgotPasswordForm />);
      typeEmail(`  ${EMAIL}  `);

      await sendLink();

      expect(resetPasswordForEmail).toHaveBeenCalledWith(EMAIL, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
    });

    it("should show the sent page with the address in its sentence", async () => {
      await reachTheSentPage();

      expect(screen.getByRole("status", { name: "Check your email" })).toBeTruthy();
      expect(
        screen.getByText(
          `If ${EMAIL} has a Ki-Lo account, a link to set a new password is on its way. Open it in this browser. It works once, for one hour.`,
        ),
      ).toBeTruthy();
      expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe(
        "/login",
      );
      expect(screen.getByText("No email? Check your spam folder, or send it again.")).toBeTruthy();
    });

    it("should move focus to the title of the sent page", async () => {
      await reachTheSentPage();

      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Check your email" }),
      );
    });

    it("should record the request time in the cookie", async () => {
      await reachTheSentPage();

      expect(document.cookie).toMatch(new RegExp(`${COOKIE_NAME}=\\d+`));
    });

    it("should leave the cookie unset when the request failed", async () => {
      resetPasswordForEmail.mockResolvedValueOnce(noConnection);
      render(<ForgotPasswordForm />);
      typeEmail(EMAIL);

      await sendLink();

      expect(document.cookie).not.toContain(COOKIE_NAME);
    });
  });

  describe("a request that fails", () => {
    it("should show the error banner as an alert and keep the field", async () => {
      resetPasswordForEmail.mockResolvedValueOnce(noConnection);
      render(<ForgotPasswordForm />);
      typeEmail(EMAIL);

      await sendLink();

      expect(screen.getByRole("alert").textContent).toBe(NO_CONNECTION);
      expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Email" }).value).toBe(EMAIL);
    });

    it("should show the generic sentence when the client cannot be made", async () => {
      createClient.mockImplementationOnce(() => {
        throw new Error("no environment");
      });
      render(<ForgotPasswordForm />);
      typeEmail(EMAIL);

      await sendLink();

      expect(screen.getByRole("alert").textContent).toBe("Something went wrong. Try again.");
    });
  });

  describe("an address with no account, and any other code", () => {
    async function renderedAfter(answer: unknown) {
      resetPasswordForEmail.mockResolvedValueOnce(answer);
      const { container, unmount } = render(<ForgotPasswordForm />);
      typeEmail(EMAIL);
      await sendLink();
      // React numbers the generated ids by render, so they are left out of the comparison.
      const markup = container.innerHTML.replace(/_r_\w+_/g, "id");
      unmount();

      return markup;
    }

    it("should render the same page for a known address, an unknown one and an unexpected code", async () => {
      const known = await renderedAfter(answered);
      const unknown = await renderedAfter({ error: { code: "user_not_found" } });
      const unexpected = await renderedAfter({ error: { code: "unexpected_failure" } });

      expect(unknown).toBe(known);
      expect(unexpected).toBe(known);
    });

    it("should report only the code, and only for an unexpected one", async () => {
      await renderedAfter(answered);
      await renderedAfter({ error: { code: "user_not_found" } });
      expect(captureMessage).not.toHaveBeenCalled();

      await renderedAfter({ error: { code: "unexpected_failure" } });

      expect(captureMessage).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(captureMessage.mock.calls)).not.toContain(EMAIL);
      expect(JSON.stringify(captureMessage.mock.calls)).toContain("unexpected_failure");
    });
  });

  describe("Send again", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-25T10:00:00Z"));
    });

    async function passSeconds(seconds: number) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(seconds * 1000);
      });
    }

    it("should wait out the first minute with the seconds left", async () => {
      await reachTheSentPage();

      const button = screen.getByRole<HTMLButtonElement>("button", { name: "Send again in 60 s" });
      expect(button.disabled).toBe(true);

      await passSeconds(15);

      expect(screen.getByRole("button", { name: "Send again in 45 s" })).toBeTruthy();
    });

    it("should unlock when the minute has passed", async () => {
      await reachTheSentPage();

      await passSeconds(59);
      expect(
        screen.getByRole<HTMLButtonElement>("button", { name: "Send again in 1 s" }).disabled,
      ).toBe(true);

      await passSeconds(1);

      expect(screen.getByRole<HTMLButtonElement>("button", { name: "Send again" }).disabled).toBe(
        false,
      );
    });

    it("should send again for the same address, set the cookie again and restart the count", async () => {
      await reachTheSentPage();
      await passSeconds(60);
      resetPasswordForEmail.mockResolvedValueOnce(answered);
      clearCookie();

      await clickAndSettle(screen.getByRole("button", { name: "Send again" }));

      expect(resetPasswordForEmail).toHaveBeenCalledTimes(2);
      expect(resetPasswordForEmail).toHaveBeenLastCalledWith(EMAIL, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      expect(document.cookie).toMatch(new RegExp(`${COOKIE_NAME}=\\d+`));
      expect(screen.getByRole("button", { name: "Send again in 60 s" })).toBeTruthy();
    });

    it("should move focus to the title again after a resend", async () => {
      await reachTheSentPage();
      await passSeconds(60);
      resetPasswordForEmail.mockResolvedValueOnce(answered);
      screen.getByRole<HTMLButtonElement>("button", { name: "Send again" }).focus();

      await clickAndSettle(screen.getByRole("button", { name: "Send again" }));

      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "Check your email" }),
      );
    });

    it("should return to the form with the address kept and the error when the resend fails", async () => {
      await reachTheSentPage();
      await passSeconds(60);
      resetPasswordForEmail.mockResolvedValueOnce(noConnection);

      await clickAndSettle(screen.getByRole("button", { name: "Send again" }));

      expect(screen.getByRole("heading", { level: 1, name: "Reset your password" })).toBeTruthy();
      expect(screen.getByRole("alert").textContent).toBe(NO_CONNECTION);
      expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Email" }).value).toBe(EMAIL);
      expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Email" }));
    });
  });
});
