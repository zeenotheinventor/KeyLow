import { act, render, screen, userEvent } from "@testing-library/react-native";
import { GLOBALS_UPDATED, UPDATE_GLOBALS } from "storybook/internal/core-events";

import { ThemePanel } from "../.rnstorybook/themeAddon/ThemePanel";
import { followThemeGlobal } from "../.rnstorybook/themeAddon/themeSchemeStore";

import type { ThemeChannel } from "../.rnstorybook/themeAddon/types";

function createChannel() {
  const listeners = new Map<string, (payload: { globals: Record<string, unknown> }) => void>();
  const emit = jest.fn<undefined, [string, { globals: Record<string, unknown> }]>();
  const channel: ThemeChannel = {
    emit,
    on: (eventName, listener) => {
      listeners.set(eventName, listener);
    },
  };
  const changeThemeGlobal = (theme: string) => {
    listeners.get(GLOBALS_UPDATED)?.({ globals: { theme } });
  };

  return { channel, emit, changeThemeGlobal };
}

describe("ThemePanel", () => {
  // The scheme is remembered across panels, as it is on a device, so each test starts from dark.
  beforeEach(() => {
    const { channel, changeThemeGlobal } = createChannel();
    followThemeGlobal(channel);
    changeThemeGlobal("dark");
  });

  it("should offer the dark and light schemes with dark selected first", async () => {
    const { channel } = createChannel();

    await render(<ThemePanel channel={channel} />);

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Light" })).not.toBeChecked();
  });

  it("should switch the Storybook theme global when light is chosen", async () => {
    const { channel, emit } = createChannel();
    await render(<ThemePanel channel={channel} />);

    await userEvent.press(screen.getByRole("radio", { name: "Light" }));

    expect(emit).toHaveBeenCalledWith(UPDATE_GLOBALS, { globals: { theme: "light" } });
  });

  it("should follow the theme global when it changes elsewhere", async () => {
    const { channel, changeThemeGlobal } = createChannel();
    followThemeGlobal(channel);
    await render(<ThemePanel channel={channel} />);

    await act(() => {
      changeThemeGlobal("light");
    });

    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  });

  it("should still show the chosen scheme when the panel is closed and opened again", async () => {
    const { channel, changeThemeGlobal } = createChannel();
    followThemeGlobal(channel);
    await render(<ThemePanel channel={channel} />);
    await act(() => {
      changeThemeGlobal("light");
    });
    await screen.unmount();

    await render(<ThemePanel channel={channel} />);

    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  });

  it("should ignore a theme global that is not a scheme", async () => {
    const { channel, changeThemeGlobal } = createChannel();
    followThemeGlobal(channel);
    await render(<ThemePanel channel={channel} />);

    await act(() => {
      changeThemeGlobal("sepia");
    });

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  });
});
