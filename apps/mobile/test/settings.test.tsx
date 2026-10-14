import { render, screen, userEvent } from "@testing-library/react-native";

import { resetSupabaseMock, mockSupabaseClient } from "./support/supabaseMock";
import SettingsRoute from "../app/(tabs)/settings";
import { ThemeProvider } from "../lib/theme";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

describe("settings tab", () => {
  beforeEach(resetSupabaseMock);

  it("should keep the Settings heading", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <SettingsRoute />
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Settings" })).toBeOnTheScreen();
  });

  it("should sign the user out", async () => {
    const user = userEvent.setup();
    await render(
      <ThemeProvider fixedPreference="dark">
        <SettingsRoute />
      </ThemeProvider>,
    );

    await user.press(screen.getByRole("button", { name: "Sign out" }));

    expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
  });
});
