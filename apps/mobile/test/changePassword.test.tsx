import { screen, userEvent, waitFor } from "@testing-library/react-native";

import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import {
  passwordUpdateBackend,
  renderWithPasswordUpdate,
  resetPasswordUpdateBackend,
} from "./support/passwordUpdateBackend";
import { emailAccount, signInAs } from "./support/sessionUser";
import { resetSupabaseMock } from "./support/supabaseMock";
import ChangePasswordRoute from "../app/(tabs)/more/change-password";

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
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

const address = "sam.taylor@example.com";
const newPassword = "test-only-new-password";

async function saveNewPassword() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("New password"), newPassword);
  await user.type(screen.getByLabelText("Confirm new password"), newPassword);
  await user.press(screen.getByRole("button", { name: "Save password" }));
}

describe("the change password screen", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
    resetPasswordUpdateBackend();
    signInAs(address, emailAccount);
  });

  it("should be headed Change password, with the address of the signed in account", async () => {
    await renderWithPasswordUpdate(<ChangePasswordRoute />);

    expect(screen.getByRole("heading", { name: "Change password" })).toBeOnTheScreen();
    expect(
      await screen.findByText(`For ${address}. Other devices will be signed out.`),
    ).toBeOnTheScreen();
  });

  it("should go back to More with its back button", async () => {
    const user = userEvent.setup();
    await renderWithPasswordUpdate(<ChangePasswordRoute />);

    await user.press(screen.getByRole("button", { name: "Back to More" }));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });

  it("should open More when there is nothing to go back to", async () => {
    routerMock.canGoBack.mockReturnValue(false);
    const user = userEvent.setup();
    await renderWithPasswordUpdate(<ChangePasswordRoute />);

    await user.press(screen.getByRole("button", { name: "Back to More" }));

    expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/more");
  });

  it("should show the saved notice as a status, lock the fields and go back to More with Done", async () => {
    const user = userEvent.setup();
    await renderWithPasswordUpdate(<ChangePasswordRoute />);

    await saveNewPassword();

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/^Password changed/);
    expect(screen.getByLabelText("New password")).toBeDisabled();
    expect(screen.getByLabelText("Confirm new password")).toBeDisabled();
    await user.press(screen.getByRole("button", { name: "Done" }));
    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });

  it("should show a failure's sentence and keep the form open", async () => {
    passwordUpdateBackend.answer = { kind: "unreachable" };
    await renderWithPasswordUpdate(<ChangePasswordRoute />);

    await saveNewPassword();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ki-Lo could not reach the server. Check your connection and try again.",
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save password" })).toBeEnabled();
    });
  });
});
