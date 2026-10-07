import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthGate } from "../../components/AuthGate";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { fakeSession, mockSupabaseClient, resetSupabaseMock } from "../support/supabaseMock";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock("../../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("../support/supabaseMock")
    .mockSupabaseClient,
}));

async function renderGate() {
  await render(
    <AuthGate>
      <Text>Food screen</Text>
    </AuthGate>,
  );
}

// The root layout wraps the whole stack in AuthGate, so the food routes need no guard of their own.
// These cases pin that a deep link to keylow://foods/new is covered by it.
describe("food routes behind the auth gate", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
    routerMock.segments = ["foods", "new"];
  });

  it("should send a signed-out deep link to the new food screen to sign-in", async () => {
    await renderGate();

    expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
  });

  it("should send a signed-out deep link to the edit screen to sign-in", async () => {
    routerMock.segments = ["foods", "[id]", "edit"];

    await renderGate();

    expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
  });

  it("should leave a signed-in user on the food screen", async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });

    await renderGate();

    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(screen.getByText("Food screen")).toBeOnTheScreen();
  });
});
