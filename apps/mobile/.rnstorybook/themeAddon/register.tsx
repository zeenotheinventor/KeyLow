import { addons, types } from "storybook/manager-api";

import { themeAddonId, themePanelId } from "./constants";
import { ThemePanel } from "./ThemePanel";
import { followThemeGlobal } from "./themeSchemeStore";

addons.register(themeAddonId, () => {
  const channel = addons.getChannel();
  followThemeGlobal(channel);

  addons.add(themePanelId, {
    type: types.PANEL,
    title: "Theme",
    render: () => <ThemePanel channel={channel} />,
  });
});
