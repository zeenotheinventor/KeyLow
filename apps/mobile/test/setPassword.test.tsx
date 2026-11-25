import { screen, userEvent, waitFor } from "@testing-library/react-native";

import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import {
  passwordUpdateBackend,
  renderWithPasswordUpdate,
  resetPasswordUpdateBackend,
} from "./support/passwordUpdateBackend";
import { emailAccount, signInAs } from "./support/sessionUser";
import { mockSupabaseClient, resetSupabaseMock } from "./support/supabaseMock";
import SetPasswordRoute from "../app/auth/set-password";

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

const address = "sam.taylor@example.com";
const newPassword = "test-only-new-password";

async function openSetPassword() {
  await renderWithPasswordUpdate(<SetPasswordRoute />);
}

async function saveNewPassword() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("New password"), newPassword);
  await user.type(screen.getByLabelText("Confirm new password"), newPassword);
  await user.press(screen.getByRole("button", { name: "Save password" }));
}

describe("the set a new password screen", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
    resetPasswordUpdateBackend();
    signInAs(address, emailAccount);
  });

  it("should say what it is for, with the address of the signed in account", async () => {
    await openSetPassword();

    expect(screen.getByRole("heading", { name: "Set a new password" })).toBeOnTheScreen();
    expect(
      await screen.findByText(`For ${address}. Other devices will be signed out.`),
    ).toBeOnTheScreen();
  });

  it("should take the address from the session and never from a parameter", async () => {
    routerMock.searchParams = { email: "someone.else@example.com" };

    await openSetPassword();

    expect(await screen.findByText(new RegExp(`^For ${address}`))).toBeOnTheScreen();
    expect(screen.queryByText(/someone\.else/)).not.toBeOnTheScreen();
  });

  it("should draw no way back, because leaving keeps the person signed in", async () => {
    await openSetPassword();

    expect(screen.queryByRole("button", { name: /^Back/ })).not.toBeOnTheScreen();
  });

  describe("once the password is saved", () => {
    it("should say so as a status, with Continue", async () => {
      await openSetPassword();

      await saveNewPassword();

      const status = await screen.findByRole("status");
      expect(status).toHaveTextContent(/^Password saved/);
      expect(status).toHaveTextContent(
        /You are signed in\. Use your new password next time\. Other devices have been signed out\./,
      );
      expect(screen.getByRole("button", { name: "Continue" })).toBeOnTheScreen();
      expect(screen.queryByLabelText("New password")).not.toBeOnTheScreen();
    });

    it("should open the dashboard with Continue, replacing this screen", async () => {
      const user = userEvent.setup();
      await openSetPassword();
      await saveNewPassword();

      await user.press(await screen.findByRole("button", { name: "Continue" }));

      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/dashboard");
    });
  });

  describe("when the reset has timed out", () => {
    it("should sign out, then replace this screen with Forgot password, from Send a new link", async () => {
      passwordUpdateBackend.hasSession = false;
      const user = userEvent.setup();
      await openSetPassword();
      await saveNewPassword();

      await user.press(await screen.findByRole("button", { name: "Send a new link" }));

      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/forgot-password");
      });
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledTimes(1);
      expect(mockSupabaseClient.auth.signOut.mock.invocationCallOrder[0]).toBeLessThan(
        routerMock.replace.mock.invocationCallOrder[0] ?? 0,
      );
    });
  });
});
