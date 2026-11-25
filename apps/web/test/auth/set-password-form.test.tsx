import { PASSWORD_PROBLEMS, PASSWORD_SAVED } from "@keylow/core/copy";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SetPasswordForm } from "@/app/set-password/SetPasswordForm";

const { updateUser, signOut, createClient, replace, captureException, captureMessage } = vi.hoisted(
  () => {
    const updateUser = vi.fn();
    const signOut = vi.fn();

    return {
      updateUser,
      signOut,
      createClient: vi.fn(() => ({ auth: { updateUser, signOut } })),
      replace: vi.fn(),
      captureException: vi.fn(),
      captureMessage: vi.fn(),
    };
  },
);

vi.mock("@/lib/supabase/client", () => ({ createClient }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, prefetch: vi.fn() }) }));
vi.mock("@sentry/nextjs", () => ({ captureException, captureMessage }));

// Made-up values, only for these tests.
const EMAIL = "ada@example.com";
const GOOD_PASSWORD = "correct-horse-battery";

const answered = { error: null };

function fillAndSave(newPassword = GOOD_PASSWORD, confirmation = GOOD_PASSWORD) {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: newPassword } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: confirmation },
  });

  return act(() => {
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));
    return Promise.resolve();
  });
}

describe("SetPasswordForm", () => {
  beforeEach(() => {
    updateUser.mockReset();
    signOut.mockReset();
    signOut.mockResolvedValue({ error: null });
    replace.mockReset();
    captureException.mockReset();
    captureMessage.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  describe("the form", () => {
    it("should be titled Set a new password, with who it is for in the caption", () => {
      render(<SetPasswordForm email={EMAIL} />);

      expect(screen.getByRole("heading", { level: 1, name: "Set a new password" })).toBeTruthy();
      expect(
        screen.getByText("For ada@example.com. Other devices will be signed out."),
      ).toBeTruthy();
    });

    it("should ask for the new password twice and offer Save password", () => {
      render(<SetPasswordForm email={EMAIL} />);

      expect(screen.getByLabelText("New password")).toBeTruthy();
      expect(screen.getByLabelText("Confirm new password")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Save password" })).toBeTruthy();
    });

    it("should be a card with no navigation", () => {
      render(<SetPasswordForm email={EMAIL} />);

      expect(screen.queryByRole("navigation")).toBeNull();
      expect(screen.queryByRole("link")).toBeNull();
    });
  });

  describe("saving", () => {
    it("should set the password for the reset session and sign out the other devices", async () => {
      updateUser.mockResolvedValue(answered);
      render(<SetPasswordForm email={EMAIL} />);

      await fillAndSave();

      expect(updateUser).toHaveBeenCalledWith({ password: GOOD_PASSWORD });
      expect(signOut).toHaveBeenCalledWith({ scope: "others" });
    });

    it("should check the fields first and send nothing when they are wrong", async () => {
      render(<SetPasswordForm email={EMAIL} />);

      await fillAndSave("abc", "abcd");

      expect(screen.getAllByRole("alert")).toHaveLength(2);
      expect(updateUser).not.toHaveBeenCalled();
    });

    it("should say the password is saved, as a status, and replace the form", async () => {
      updateUser.mockResolvedValue(answered);
      render(<SetPasswordForm email={EMAIL} />);

      await fillAndSave();

      expect(screen.getByRole("status", { name: PASSWORD_SAVED.title })).toBeTruthy();
      expect(screen.getByText(PASSWORD_SAVED.body)).toBeTruthy();
      expect(screen.queryByLabelText("New password")).toBeNull();
      expect(screen.queryByRole("button", { name: "Save password" })).toBeNull();
    });

    it("should move focus to the Password saved heading once saved", async () => {
      updateUser.mockResolvedValue(answered);
      render(<SetPasswordForm email={EMAIL} />);

      await fillAndSave();

      expect(screen.getByRole("heading", { name: PASSWORD_SAVED.title })).toBe(
        document.activeElement,
      );
    });

    it("should offer Continue to the dashboard once saved", async () => {
      updateUser.mockResolvedValue(answered);
      render(<SetPasswordForm email={EMAIL} />);

      await fillAndSave();

      expect(screen.getByRole("link", { name: "Continue" }).getAttribute("href")).toBe(
        "/dashboard",
      );
    });

    it("should still show saved when the other devices could not be signed out, and report it with no data", async () => {
      updateUser.mockResolvedValue(answered);
      signOut.mockResolvedValue({ error: { code: "unexpected_failure" } });
      render(<SetPasswordForm email={EMAIL} />);

      await fillAndSave();

      expect(screen.getByRole("status", { name: PASSWORD_SAVED.title })).toBeTruthy();
      expect(captureMessage).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(captureMessage.mock.calls)).not.toContain(GOOD_PASSWORD);
      expect(JSON.stringify(captureMessage.mock.calls)).not.toContain(EMAIL);
    });
  });

  describe("a save that failed", () => {
    it("should say it is the current password, and keep the fields", async () => {
      updateUser.mockResolvedValue({ error: { code: "same_password" } });
      render(<SetPasswordForm email={EMAIL} />);

      await fillAndSave();

      expect(screen.getByRole("alert").textContent).toBe(PASSWORD_PROBLEMS.samePassword);
      expect(screen.getByLabelText<HTMLInputElement>("New password").value).toBe(GOOD_PASSWORD);
    });

    it("should say the password is too weak", async () => {
      updateUser.mockResolvedValue({ error: { code: "weak_password" } });
      render(<SetPasswordForm email={EMAIL} />);

      await fillAndSave();

      expect(screen.getByRole("alert").textContent).toBe(PASSWORD_PROBLEMS.weakPassword);
    });
  });

  describe("a reset that timed out", () => {
    async function reachTimedOut() {
      updateUser.mockResolvedValue({ error: { code: "session_not_found" } });
      render(<SetPasswordForm email={EMAIL} />);
      await fillAndSave();
    }

    it("should say the reset timed out and offer a new link", async () => {
      await reachTimedOut();

      expect(screen.getByRole("alert").textContent).toContain(PASSWORD_PROBLEMS.resetTimedOut);
      expect(screen.getByRole("button", { name: "Send a new link" })).toBeTruthy();
    });

    it("should sign out before it opens the forgot password page", async () => {
      await reachTimedOut();
      signOut.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Send a new link" }));
        await Promise.resolve();
      });

      expect(signOut).toHaveBeenCalledWith({ scope: "local" });
      expect(replace).toHaveBeenCalledWith("/forgot-password");
      const signOutOrder = signOut.mock.invocationCallOrder[0] ?? Infinity;
      const replaceOrder = replace.mock.invocationCallOrder[0] ?? -Infinity;
      expect(signOutOrder).toBeLessThan(replaceOrder);
    });

    it("should stay on the page and tell Sentry when the sign out fails", async () => {
      await reachTimedOut();
      signOut.mockRejectedValue(new Error("unreachable"));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Send a new link" }));
        await Promise.resolve();
      });

      expect(replace).not.toHaveBeenCalled();
      expect(captureException).toHaveBeenCalledTimes(1);
    });
  });
});
