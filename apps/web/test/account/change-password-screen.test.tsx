import { PASSWORD_CHANGED, PASSWORD_PROBLEMS } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "../ui/appRouter";

import type { PasswordUpdateOutcome } from "@keylow/core/accounts";

import { ChangePasswordScreen } from "@/components/account";

const { mutateAsync, router } = vi.hoisted(() => ({
  mutateAsync:
    vi.fn<(input: { newPassword: string; context: "recovery" | "change" }) => Promise<unknown>>(),
  router: { push: vi.fn<(href: string) => void>() },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useUpdatePassword: () => ({ mutateAsync }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/auth/reportOtherDevicesNotSignedOut", () => ({
  reportOtherDevicesNotSignedOut: vi.fn(),
}));

// Made-up values, only for these tests.
const EMAIL = "ada@example.com";
const GOOD_PASSWORD = "correct-horse-battery";

const saved: PasswordUpdateOutcome = { kind: "saved", otherDevicesSignedOut: true };

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

describe("ChangePasswordScreen", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    router.push.mockReset();
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
  });

  describe("the page", () => {
    it("should link back to More, above the heading", () => {
      renderWithRouter(<ChangePasswordScreen email={EMAIL} />);

      expect(screen.getByRole("link", { name: "More" }).getAttribute("href")).toBe("/more");
      expect(screen.getByRole("heading", { level: 1, name: "Change password" })).toBeTruthy();
    });

    it("should say who it is for and that the other devices will be signed out", () => {
      renderWithRouter(<ChangePasswordScreen email={EMAIL} />);

      expect(
        screen.getByText("For ada@example.com. Other devices will be signed out."),
      ).toBeTruthy();
    });

    it("should ask for the new password twice, with no current password", () => {
      renderWithRouter(<ChangePasswordScreen email={EMAIL} />);

      expect(screen.getByLabelText("New password")).toBeTruthy();
      expect(screen.getByLabelText("Confirm new password")).toBeTruthy();
      expect(screen.queryByLabelText(/current password/i)).toBeNull();
      expect(screen.getByRole("button", { name: "Save password" })).toBeTruthy();
    });
  });

  describe("saving", () => {
    it("should change the password as a signed in person, and check the fields first", async () => {
      mutateAsync.mockResolvedValue(saved);
      renderWithRouter(<ChangePasswordScreen email={EMAIL} />);

      await fillAndSave("abc", "abcd");
      expect(mutateAsync).not.toHaveBeenCalled();
      expect(screen.getAllByRole("alert")).toHaveLength(2);

      await fillAndSave();
      expect(mutateAsync).toHaveBeenCalledWith({ newPassword: GOOD_PASSWORD, context: "change" });
    });

    it("should confirm the change in a status, with both fields disabled and Done in place of Save", async () => {
      mutateAsync.mockResolvedValue(saved);
      renderWithRouter(<ChangePasswordScreen email={EMAIL} />);

      await fillAndSave();

      const status = screen.getByRole("status");
      expect(status.textContent).toContain(PASSWORD_CHANGED.title);
      expect(status.textContent).toContain(PASSWORD_CHANGED.body);
      expect(screen.getByLabelText("New password").hasAttribute("disabled")).toBe(true);
      expect(screen.getByLabelText("Confirm new password").hasAttribute("disabled")).toBe(true);
      expect(screen.queryByRole("button", { name: "Save password" })).toBeNull();
    });

    it("should go back to More from Done", async () => {
      mutateAsync.mockResolvedValue(saved);
      renderWithRouter(<ChangePasswordScreen email={EMAIL} />);
      await fillAndSave();

      fireEvent.click(screen.getByRole("button", { name: "Done" }));

      expect(router.push).toHaveBeenCalledWith("/more");
    });
  });

  describe("a save that failed", () => {
    it("should show the sentence it carries and keep the fields", async () => {
      mutateAsync.mockResolvedValue({
        kind: "failed",
        reason: "samePassword",
        message: PASSWORD_PROBLEMS.samePassword,
      });
      renderWithRouter(<ChangePasswordScreen email={EMAIL} />);

      await fillAndSave();

      expect(screen.getByRole("alert").textContent).toBe(PASSWORD_PROBLEMS.samePassword);
      expect(screen.getByLabelText<HTMLInputElement>("New password").value).toBe(GOOD_PASSWORD);
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("should ask the person to sign in again when the session ended, with no link to send", async () => {
      mutateAsync.mockResolvedValue({
        kind: "failed",
        reason: "sessionEnded",
        message: PASSWORD_PROBLEMS.changeSessionEnded,
      });
      renderWithRouter(<ChangePasswordScreen email={EMAIL} />);

      await fillAndSave();

      expect(screen.getByRole("alert").textContent).toBe(PASSWORD_PROBLEMS.changeSessionEnded);
      expect(screen.queryByRole("button", { name: "Send a new link" })).toBeNull();
    });

    it("should say there is no connection when the browser is offline, without waiting for one", async () => {
      onlineManager.setOnline(false);
      renderWithRouter(<ChangePasswordScreen email={EMAIL} />);

      await fillAndSave();

      expect(mutateAsync).not.toHaveBeenCalled();
      expect(screen.getByRole("alert").textContent).toBe(
        "Ki-Lo could not reach the server. Check your connection and try again.",
      );
      expect(screen.getByRole("button", { name: "Save password" })).toBeTruthy();
    });
  });
});
