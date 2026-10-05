import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthGate } from "../components/AuthGate";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import {
  emitAuthStateChange,
  fakeSession,
  resetSupabaseMock,
  mockSupabaseClient,
  unsubscribeMock,
} from "./support/supabaseMock";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

async function renderGate() {
  await render(
    <AuthGate>
      <Text>Protected content</Text>
    </AuthGate>,
  );
}

describe("AuthGate", () => {
  beforeEach(() => {
    resetRouterMock();
    resetSupabaseMock();
  });

  it("should redirect to sign-in when there is no session and the route is in the tabs", async () => {
    routerMock.segments = ["(tabs)", "diary"];

    await renderGate();

    expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
  });

  it("should redirect to the diary when a session exists and the route is in the auth group", async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
    routerMock.segments = ["(auth)", "sign-in"];

    await renderGate();

    expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/diary");
  });

  it("should not redirect while the session is still loading", async () => {
    mockSupabaseClient.auth.getSession.mockReturnValue(new Promise(() => undefined));
    routerMock.segments = ["(tabs)", "diary"];

    await renderGate();

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("should leave a signed-out user on the auth callback route", async () => {
    routerMock.segments = ["auth", "callback"];

    await renderGate();

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("should leave a signed-out user on the sign-in screen", async () => {
    routerMock.segments = ["(auth)", "sign-in"];

    await renderGate();

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("should leave a signed-in user in the tabs", async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
    routerMock.segments = ["(tabs)", "diary"];

    await renderGate();

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("should redirect to sign-in when the user signs out", async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
    routerMock.segments = ["(tabs)", "settings"];
    await renderGate();

    await act(() => {
      emitAuthStateChange("SIGNED_OUT", null);
    });

    expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/sign-in");
  });

  it("should render its children", async () => {
    await renderGate();

    expect(screen.getByText("Protected content")).toBeOnTheScreen();
  });

  it("should unsubscribe from auth changes when it unmounts", async () => {
    await renderGate();

    await screen.unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });
});
