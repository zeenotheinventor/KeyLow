import { render, screen, userEvent } from "@testing-library/react-native";

import { resetRouterMock } from "./support/expoRouterMock";
import { resetSupabaseMock, mockSupabaseClient } from "./support/supabaseMock";
import SignInRoute from "../app/(auth)/sign-in";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await render(<SignInRoute />);
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.press(screen.getByRole("button", { name: "Sign in" }));
}

describe("sign-in screen", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
  });

  it("should ask for an email and a password when the form is empty", async () => {
    await fillAndSubmit("", "");

    expect(screen.getByText("Enter your email address")).toBeOnTheScreen();
    expect(screen.getByText("Enter your password")).toBeOnTheScreen();
    expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("should reject a malformed email", async () => {
    await fillAndSubmit("not-an-email", "password123");

    expect(screen.getByText("Enter a valid email address")).toBeOnTheScreen();
    expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("should submit a password shorter than eight characters", async () => {
    await fillAndSubmit("zee@example.com", "abc123");

    expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "zee@example.com",
      password: "abc123",
    });
  });

  it("should re-enable the button and show an error when sign-in throws", async () => {
    mockSupabaseClient.auth.signInWithPassword.mockRejectedValue(new Error("network down"));

    await fillAndSubmit("zee@example.com", "password123");

    expect(await screen.findByText("Something went wrong. Try again.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("should sign in with the typed email and password", async () => {
    await fillAndSubmit("zee@example.com", "password123");

    expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "zee@example.com",
      password: "password123",
    });
  });

  it("should show the error message when sign-in fails", async () => {
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: "Invalid login credentials" },
    });

    await fillAndSubmit("zee@example.com", "password123");

    expect(await screen.findByText("Invalid login credentials")).toBeOnTheScreen();
  });

  it("should link to the sign-up screen", async () => {
    await render(<SignInRoute />);

    expect(screen.getByRole("link", { name: "Create account" })).toBeOnTheScreen();
  });

  it("should show a disabled Google button", async () => {
    await render(<SignInRoute />);

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  });
});
