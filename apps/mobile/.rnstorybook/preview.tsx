import { defaultThemeScheme, themeGlobalKey } from "./themeAddon/constants";
import { ThemedStory } from "./ThemedStory";

import type { Preview } from "@storybook/react-native";

const preview: Preview = {
  initialGlobals: { [themeGlobalKey]: defaultThemeScheme },
  decorators: [
    (Story, context) => (
      <ThemedStory scheme={context.globals[themeGlobalKey] === "light" ? "light" : "dark"}>
        <Story />
      </ThemedStory>
    ),
  ],
};

export default preview;
