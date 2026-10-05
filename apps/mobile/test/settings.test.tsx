import { render, screen, userEvent } from "@testing-library/react-native";

import { resetSupabaseMock, mockSupabaseClient } from "./support/supabaseMock";
import SettingsRoute from "../app/(tabs)/settings";

jest.mock("../lib/supabase", () => ({
  supabase: jest.requireActual<{ mockSupabaseClient: unknown }>("./support/supabaseMock")
    .mockSupabaseClient,
}));

describe("settings tab", () => {
  beforeEach(resetSupabaseMock);

  it("should sign the user out", async () => {
    const user = userEvent.setup();
    await render(<SettingsRoute />);

    await user.press(screen.getByRole("button", { name: "Sign out" }));

    expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
  });
});
