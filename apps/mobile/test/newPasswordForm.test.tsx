import { captureMessage } from "@sentry/react-native";
import { onlineManager } from "@tanstack/react-query";
import { act, screen, userEvent, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { resetRouterMock } from "./support/expoRouterMock";
import {
  passwordUpdateBackend,
  renderWithPasswordUpdate,
  resetPasswordUpdateBackend,
} from "./support/passwordUpdateBackend";
import { resetSupabaseMock } from "./support/supabaseMock";
import { NewPasswordForm } from "../components/NewPasswordForm";

import type { NewPasswordFormProps } from "../components/NewPasswordForm";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.resolve(),
    removeItem: () => Promise.resolve(),
  },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

const newPassword = "test-only-new-password";
const tooShort = "Password must be at least 8 characters";
const mismatch = "The passwords do not match";

const onSaved = jest.fn();
const onSendNewLink = jest.fn();
const onDone = jest.fn();

async function renderForm(props: NewPasswordFormProps) {
  await renderWithPasswordUpdate(<NewPasswordForm {...props} />);
}

const recovery: NewPasswordFormProps = { context: "recovery", onSaved, onSendNewLink };
const change: NewPasswordFormProps = { context: "change", onDone };

async function typePasswords(password: string, confirmation: string) {
  const user = userEvent.setup();
  if (password !== "") {
    await user.type(screen.getByLabelText("New password"), password);
  }
  if (confirmation !== "") {
    await user.type(screen.getByLabelText("Confirm new password"), confirmation);
  }
}

async function save() {
  const user = userEvent.setup();
  await user.press(screen.getByRole("button", { name: "Save password" }));
}

describe("the new password form", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
    resetPasswordUpdateBackend();
    onSaved.mockReset();
    onSendNewLink.mockReset();
    onDone.mockReset();
    jest.mocked(captureMessage).mockClear();
  });

  describe("offline", () => {
    afterEach(() => {
      onlineManager.setOnline(true);
    });

    it("should say the server cannot be reached and send nothing, so no save waits to run later", async () => {
      onlineManager.setOnline(false);
      await renderForm(recovery);
      await typePasswords(newPassword, newPassword);

      await save();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Ki-Lo could not reach the server. Check your connection and try again.",
      );
      expect(passwordUpdateBackend.updates).toHaveLength(0);
      expect(screen.getByRole("button", { name: "Save password" })).toBeEnabled();
    });
  });

  describe("its fields", () => {
    it("should ask for the new password and its confirmation, as password fields", async () => {
      await renderForm(recovery);

      expect(screen.getByLabelText("New password")).toBeOnTheScreen();
      expect(screen.getByLabelText("Confirm new password")).toBeOnTheScreen();
      expect(screen.getByLabelText("New password").props.secureTextEntry).toBe(true);
      expect(screen.getByLabelText("Confirm new password").props.secureTextEntry).toBe(true);
    });

    it("should say the length rule under the new password, and not under the confirmation", async () => {
      await renderForm(recovery);

      expect(screen.getAllByText("At least 8 characters")).toHaveLength(1);
    });

    it("should have a Save password button", async () => {
      await renderForm(recovery);

      expect(screen.getByRole("button", { name: "Save password" })).toBeEnabled();
    });
  });

  describe("saving something that is not valid", () => {
    it("should show both problems at once and send nothing", async () => {
      await renderForm(recovery);
      await typePasswords("abc", "abcd");

      await save();

      const alerts = screen.getAllByRole("alert");
      expect(alerts).toHaveLength(2);
      expect(alerts[0]).toHaveTextContent(tooShort);
      expect(alerts[1]).toHaveTextContent(mismatch);
      expect(passwordUpdateBackend.updates).toHaveLength(0);
    });

    it("should show only the mismatch when the password is long enough", async () => {
      await renderForm(recovery);
      await typePasswords(newPassword, `${newPassword}x`);

      await save();

      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(screen.getByText(mismatch)).toBeOnTheScreen();
      expect(passwordUpdateBackend.updates).toHaveLength(0);
    });

    it("should replace the length rule with the problem under the new password", async () => {
      await renderForm(recovery);
      await typePasswords("abc", "abc");

      await save();

      expect(screen.queryByText("At least 8 characters")).not.toBeOnTheScreen();
      expect(screen.getByText(tooShort)).toBeOnTheScreen();
    });

    it("should clear the problems once the next save is valid", async () => {
      await renderForm(recovery);
      await typePasswords("abc", "abcd");
      await save();
      const user = userEvent.setup();
      await user.clear(screen.getByLabelText("New password"));
      await user.clear(screen.getByLabelText("Confirm new password"));
      await typePasswords(newPassword, newPassword);

      await save();

      await waitFor(() => {
        expect(onSaved).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
  });

  describe("saving", () => {
    it("should send the new password once", async () => {
      await renderForm(recovery);
      await typePasswords(newPassword, newPassword);

      await save();

      await waitFor(() => {
        expect(passwordUpdateBackend.updates).toMatchObject([{ body: { password: newPassword } }]);
      });
    });

    it("should show a busy button named Saving password while the server is answering", async () => {
      passwordUpdateBackend.answer = { kind: "held" };
      await renderForm(recovery);
      await typePasswords(newPassword, newPassword);

      await save();

      expect(await screen.findByRole("button", { name: "Saving password" })).toBeBusy();
      expect(screen.queryByRole("button", { name: "Save password" })).not.toBeOnTheScreen();

      await act(() => {
        passwordUpdateBackend.release();
      });
      await waitFor(() => {
        expect(onSaved).toHaveBeenCalledTimes(1);
      });
    });

    it("should sign the other devices out", async () => {
      await renderForm(recovery);
      await typePasswords(newPassword, newPassword);

      await save();

      await waitFor(() => {
        expect(passwordUpdateBackend.otherDeviceSignOuts).toEqual(["others"]);
      });
    });
  });

  describe("after a reset link, once saved", () => {
    it("should hand over to the screen and report nothing", async () => {
      await renderForm(recovery);
      await typePasswords(newPassword, newPassword);

      await save();

      await waitFor(() => {
        expect(onSaved).toHaveBeenCalledTimes(1);
      });
      expect(captureMessage).not.toHaveBeenCalled();
    });

    it("should report, with a fixed message and no data, when the other devices were not signed out", async () => {
      passwordUpdateBackend.isOtherDevicesSignOutRefused = true;
      await renderForm(recovery);
      await typePasswords(newPassword, newPassword);

      await save();

      await waitFor(() => {
        expect(onSaved).toHaveBeenCalledTimes(1);
      });
      expect(captureMessage).toHaveBeenCalledTimes(1);
      expect(captureMessage).toHaveBeenCalledWith(
        "Password saved but the other devices were not signed out",
        {
          level: "warning",
          fingerprint: ["Password saved but the other devices were not signed out"],
        },
      );
    });
  });

  describe("after a reset link, when saving fails", () => {
    it.each([
      [
        "the new password is the current one",
        "same_password",
        "That is your current password. Choose a new one.",
      ],
      [
        "the server finds it too weak",
        "weak_password",
        "Choose a stronger password. This one is too easy to guess.",
      ],
    ])(
      "should show the sentence when %s, with the fields kept and no action",
      async (_name, code, sentence) => {
        passwordUpdateBackend.answer = { kind: "refused", status: 422, code };
        await renderForm(recovery);
        await typePasswords(newPassword, newPassword);

        await save();

        expect(await screen.findByRole("alert")).toHaveTextContent(sentence);
        expect(screen.getByLabelText("New password")).toHaveDisplayValue(newPassword);
        expect(screen.getByLabelText("Confirm new password")).toHaveDisplayValue(newPassword);
        expect(screen.queryByRole("button", { name: "Send a new link" })).not.toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "Save password" })).toBeEnabled();
        expect(onSaved).not.toHaveBeenCalled();
      },
    );

    it("should say the server cannot be reached when there is no connection", async () => {
      passwordUpdateBackend.answer = { kind: "unreachable" };
      await renderForm(recovery);
      await typePasswords(newPassword, newPassword);

      await save();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Ki-Lo could not reach the server. Check your connection and try again.",
      );
    });

    it("should say the reset timed out, with Send a new link, when the session has ended", async () => {
      passwordUpdateBackend.hasSession = false;
      const user = userEvent.setup();
      await renderForm(recovery);
      await typePasswords(newPassword, newPassword);

      await save();

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("This reset has timed out. Ask for a new link.");
      await user.press(screen.getByRole("button", { name: "Send a new link" }));
      expect(onSendNewLink).toHaveBeenCalledTimes(1);
    });

    it("should drop the failure when the next save is tried", async () => {
      passwordUpdateBackend.answer = { kind: "refused", status: 422, code: "same_password" };
      await renderForm(recovery);
      await typePasswords(newPassword, newPassword);
      await save();
      await screen.findByRole("alert");
      passwordUpdateBackend.answer = { kind: "held" };

      await save();

      await screen.findByRole("button", { name: "Saving password" });
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
  });

  describe("when changing the password from More", () => {
    it("should show the success notice as a status, with the fields at half strength and Done", async () => {
      await renderForm(change);
      await typePasswords(newPassword, newPassword);

      await save();

      const notice = await screen.findByRole("status");
      expect(notice).toHaveTextContent(/^Password changed/);
      expect(notice).toHaveTextContent(
        /Use your new password next time you sign in\. Other devices have been signed out\./,
      );
      expect(screen.getByLabelText("New password")).toBeDisabled();
      expect(screen.getByLabelText("Confirm new password")).toBeDisabled();
      expect(screen.queryByRole("button", { name: "Save password" })).not.toBeOnTheScreen();
    });

    it("should announce the saved notice once, because it appears as the button is swapped", async () => {
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
      announce.mockClear();
      await renderForm(change);
      await typePasswords(newPassword, newPassword);

      await save();

      await screen.findByRole("button", { name: "Done" });
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith("Password changed");
    });

    it("should go back to More with Done", async () => {
      const user = userEvent.setup();
      await renderForm(change);
      await typePasswords(newPassword, newPassword);
      await save();

      await user.press(await screen.findByRole("button", { name: "Done" }));

      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("should show the signed out sentence, with no action, when the session has ended", async () => {
      passwordUpdateBackend.hasSession = false;
      await renderForm(change);
      await typePasswords(newPassword, newPassword);

      await save();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "You have been signed out. Sign in again, then change your password.",
      );
      expect(screen.queryByRole("button", { name: "Send a new link" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("status")).not.toBeOnTheScreen();
    });

    it("should show a failure's sentence and keep the form open", async () => {
      passwordUpdateBackend.answer = { kind: "unreachable" };
      await renderForm(change);
      await typePasswords(newPassword, newPassword);

      await save();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Ki-Lo could not reach the server. Check your connection and try again.",
      );
      expect(screen.getByLabelText("New password")).toBeEnabled();
      expect(screen.getByRole("button", { name: "Save password" })).toBeEnabled();
    });
  });
});
