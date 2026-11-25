import {
  CHANGE_PASSWORD_SCREEN,
  GENERIC_ERROR,
  PASSWORD_CHANGED,
  PASSWORD_PROBLEMS,
  RESET_LINK_INVALID,
  SET_PASSWORD_SCREEN,
} from "@keylow/core/copy";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NewPasswordFormProps } from "@/components/auth/NewPasswordForm";
import type { PasswordUpdateOutcome } from "@keylow/core/accounts";

import { NewPasswordForm } from "@/components/auth/NewPasswordForm";

const { reportOtherDevicesNotSignedOut } = vi.hoisted(() => ({
  reportOtherDevicesNotSignedOut: vi.fn(),
}));

vi.mock("@/lib/auth/reportOtherDevicesNotSignedOut", () => ({ reportOtherDevicesNotSignedOut }));

// Made-up passwords, only for these tests.
const GOOD_PASSWORD = "correct-horse-battery";

const saved: PasswordUpdateOutcome = { kind: "saved", otherDevicesSignedOut: true };

const onSave = vi.fn<NewPasswordFormProps["onSave"]>();

function renderForm(props: Partial<NewPasswordFormProps> = {}) {
  return render(<NewPasswordForm copy={SET_PASSWORD_SCREEN} onSave={onSave} {...props} />);
}

function fill(newPassword: string, confirmation: string) {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: newPassword } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: confirmation },
  });
}

// Clicks, then lets the save's promises settle inside act, as a person waiting would.
function save() {
  return act(() => {
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));
    return Promise.resolve();
  });
}

describe("NewPasswordForm", () => {
  beforeEach(() => {
    onSave.mockReset();
    reportOtherDevicesNotSignedOut.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  describe("the form", () => {
    it("should ask for the new password twice, as password fields for a new password", () => {
      renderForm();

      const newPassword = screen.getByLabelText("New password");
      const confirmation = screen.getByLabelText("Confirm new password");
      expect(newPassword.getAttribute("type")).toBe("password");
      expect(newPassword.getAttribute("autocomplete")).toBe("new-password");
      expect(confirmation.getAttribute("type")).toBe("password");
      expect(confirmation.getAttribute("autocomplete")).toBe("new-password");
    });

    it("should say what the rule is under the new password", () => {
      renderForm();

      expect(screen.getByLabelText("New password").getAttribute("aria-describedby")).not.toBeNull();
      expect(screen.getByText(SET_PASSWORD_SCREEN.helper)).toBeTruthy();
    });

    it("should have a Save password button", () => {
      renderForm();

      expect(screen.getByRole("button", { name: "Save password" })).toBeTruthy();
    });

    it("should use the labels it is given", () => {
      renderForm({ copy: { ...CHANGE_PASSWORD_SCREEN, helper: SET_PASSWORD_SCREEN.helper } });

      expect(screen.getByLabelText(CHANGE_PASSWORD_SCREEN.newPasswordLabel)).toBeTruthy();
      expect(screen.getByLabelText(CHANGE_PASSWORD_SCREEN.confirmPasswordLabel)).toBeTruthy();
    });
  });

  describe("checking the fields on Save", () => {
    it("should show both field errors at once and save nothing", async () => {
      renderForm();
      fill("abc", "abcd");

      await save();

      const alerts = screen.getAllByRole("alert").map((alert) => alert.textContent);
      expect(alerts).toEqual([
        "Password must be at least 8 characters",
        "The passwords do not match",
      ]);
      expect(screen.getByLabelText("New password").getAttribute("aria-invalid")).toBe("true");
      expect(screen.getByLabelText("Confirm new password").getAttribute("aria-invalid")).toBe(
        "true",
      );
      expect(onSave).not.toHaveBeenCalled();
    });

    it("should ask for a password when both fields are empty", async () => {
      renderForm();

      await save();

      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(screen.getByLabelText("New password").getAttribute("aria-invalid")).toBe("true");
      expect(onSave).not.toHaveBeenCalled();
    });

    it("should take the errors away once the fields are right and saved again", async () => {
      onSave.mockResolvedValue(saved);
      renderForm();
      fill("abc", "abcd");
      await save();

      fill(GOOD_PASSWORD, GOOD_PASSWORD);
      await save();

      expect(screen.queryAllByRole("alert")).toHaveLength(0);
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  describe("saving", () => {
    it("should send the password as typed, with nothing trimmed", async () => {
      onSave.mockResolvedValue(saved);
      renderForm();
      fill(" spaced password ", " spaced password ");

      await save();

      expect(onSave).toHaveBeenCalledWith(" spaced password ");
    });

    it("should show the button's spinner while it saves, and ignore a second press", async () => {
      onSave.mockReturnValue(new Promise(() => undefined));
      renderForm();
      fill(GOOD_PASSWORD, GOOD_PASSWORD);

      await save();

      expect(screen.getByRole("img", { name: "Saving password" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Saving password" }).hasAttribute("disabled")).toBe(
        true,
      );
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it("should tell the page it saved", async () => {
      const onSaved = vi.fn();
      onSave.mockResolvedValue(saved);
      renderForm({ onSaved });
      fill(GOOD_PASSWORD, GOOD_PASSWORD);

      await save();

      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(reportOtherDevicesNotSignedOut).not.toHaveBeenCalled();
    });

    it("should still say it saved, and report it, when the other devices could not be signed out", async () => {
      const onSaved = vi.fn();
      onSave.mockResolvedValue({ kind: "saved", otherDevicesSignedOut: false });
      renderForm({ onSaved });
      fill(GOOD_PASSWORD, GOOD_PASSWORD);

      await save();

      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(reportOtherDevicesNotSignedOut).toHaveBeenCalledTimes(1);
      expect(reportOtherDevicesNotSignedOut).toHaveBeenCalledWith();
    });
  });

  describe("a save that failed", () => {
    it.each([
      ["samePassword", PASSWORD_PROBLEMS.samePassword],
      ["weakPassword", PASSWORD_PROBLEMS.weakPassword],
      ["other", GENERIC_ERROR],
    ] as const)(
      "should show the sentence for %s in an alert and keep the fields",
      async (reason, message) => {
        onSave.mockResolvedValue({ kind: "failed", reason, message });
        const onSaved = vi.fn();
        renderForm({ onSaved });
        fill(GOOD_PASSWORD, GOOD_PASSWORD);

        await save();

        expect(screen.getByRole("alert").textContent).toBe(message);
        expect(screen.getByLabelText<HTMLInputElement>("New password").value).toBe(GOOD_PASSWORD);
        expect(screen.getByLabelText<HTMLInputElement>("Confirm new password").value).toBe(
          GOOD_PASSWORD,
        );
        expect(screen.getByRole("button", { name: "Save password" })).toBeTruthy();
        expect(onSaved).not.toHaveBeenCalled();
      },
    );

    it("should show a general sentence when the save throws, and keep the fields", async () => {
      onSave.mockRejectedValue(new Error("unreachable"));
      renderForm();
      fill(GOOD_PASSWORD, GOOD_PASSWORD);

      await save();

      expect(screen.getByRole("alert").textContent).toBe(GENERIC_ERROR);
      expect(screen.getByLabelText<HTMLInputElement>("New password").value).toBe(GOOD_PASSWORD);
    });

    it("should take the failure away when saving again", async () => {
      onSave.mockResolvedValueOnce({ kind: "failed", reason: "other", message: GENERIC_ERROR });
      onSave.mockResolvedValueOnce(saved);
      renderForm();
      fill(GOOD_PASSWORD, GOOD_PASSWORD);
      await save();

      await save();

      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("a reset that timed out", () => {
    const timedOut: PasswordUpdateOutcome = {
      kind: "failed",
      reason: "sessionEnded",
      message: PASSWORD_PROBLEMS.resetTimedOut,
    };

    it("should offer Send a new link beside the sentence, and run what it is given", async () => {
      const onSendNewLink = vi.fn();
      onSave.mockResolvedValue(timedOut);
      renderForm({ onSendNewLink });
      fill(GOOD_PASSWORD, GOOD_PASSWORD);

      await save();

      expect(screen.getByRole("alert").textContent).toContain(PASSWORD_PROBLEMS.resetTimedOut);
      fireEvent.click(screen.getByRole("button", { name: RESET_LINK_INVALID.sendNewLinkLabel }));
      expect(onSendNewLink).toHaveBeenCalledTimes(1);
    });

    it("should show the sentence alone when the page has no new link to send", async () => {
      onSave.mockResolvedValue({
        kind: "failed",
        reason: "sessionEnded",
        message: PASSWORD_PROBLEMS.changeSessionEnded,
      });
      renderForm();
      fill(GOOD_PASSWORD, GOOD_PASSWORD);

      await save();

      expect(screen.getByRole("alert").textContent).toBe(PASSWORD_PROBLEMS.changeSessionEnded);
      expect(
        screen.queryByRole("button", { name: RESET_LINK_INVALID.sendNewLinkLabel }),
      ).toBeNull();
    });

    it("should offer no new link for a failure that is not a timed out session", async () => {
      onSave.mockResolvedValue({
        kind: "failed",
        reason: "samePassword",
        message: PASSWORD_PROBLEMS.samePassword,
      });
      renderForm({ onSendNewLink: vi.fn() });
      fill(GOOD_PASSWORD, GOOD_PASSWORD);

      await save();

      expect(
        screen.queryByRole("button", { name: RESET_LINK_INVALID.sendNewLinkLabel }),
      ).toBeNull();
    });
  });

  describe("once it is done", () => {
    const onDone = vi.fn();
    const completed = {
      title: PASSWORD_CHANGED.title,
      body: PASSWORD_CHANGED.body,
      doneLabel: PASSWORD_CHANGED.doneLabel,
      onDone,
    };

    beforeEach(() => {
      onDone.mockReset();
    });

    it("should say so in a status, with its body", () => {
      renderForm({ completed });

      const status = screen.getByRole("status");
      expect(status.textContent).toContain(PASSWORD_CHANGED.title);
      expect(status.textContent).toContain(PASSWORD_CHANGED.body);
    });

    it("should disable both fields", () => {
      renderForm({ completed });

      expect(screen.getByLabelText("New password").hasAttribute("disabled")).toBe(true);
      expect(screen.getByLabelText("Confirm new password").hasAttribute("disabled")).toBe(true);
    });

    it("should swap Save password for Done, which runs what it is given", () => {
      renderForm({ completed });

      expect(screen.queryByRole("button", { name: "Save password" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: PASSWORD_CHANGED.doneLabel }));
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onSave).not.toHaveBeenCalled();
    });

    it("should take the failure away", async () => {
      onSave.mockResolvedValue({ kind: "failed", reason: "other", message: GENERIC_ERROR });
      const { rerender } = renderForm();
      fill(GOOD_PASSWORD, GOOD_PASSWORD);
      await save();
      expect(screen.getByRole("alert")).toBeTruthy();

      rerender(
        <NewPasswordForm copy={SET_PASSWORD_SCREEN} onSave={onSave} completed={completed} />,
      );

      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
