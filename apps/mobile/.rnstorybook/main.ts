import type { StorybookConfig } from "@storybook/react-native";

const main: StorybookConfig = {
  stories: ["../components/**/*.stories.?(ts|tsx)"],
  // The theme switch is a panel because the on-device UI has no toolbar. See ./themeAddon.
  deviceAddons: ["./themeAddon"],
};

export default main;
