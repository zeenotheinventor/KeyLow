import { MORE_SCREEN } from "@keylow/core/copy";

import { useTheme } from "../../lib/theme";
import { ListRow, SegmentedControl } from "../ui";

import type { ThemePreference } from "../../lib/theme";
import type { SegmentedControlOption } from "../ui";

const { appearance } = MORE_SCREEN.settings;

const options: SegmentedControlOption<ThemePreference>[] = [
  { value: "dark", label: appearance.options.dark },
  { value: "light", label: appearance.options.light },
  { value: "system", label: appearance.options.system },
];

/**
 * The Appearance setting of More, as the `tab-shell.more` board draws it inside its card: a row with an icon
 * and the name, over a segmented control of Dark, Light and Match device. The choice applies at once and is
 * kept by the theme provider.
 */
export function AppearanceSetting() {
  const { preference, setScheme } = useTheme();

  return (
    <ListRow icon="SunMoon" title={appearance.title}>
      <SegmentedControl
        label={appearance.title}
        options={options}
        value={preference}
        onChange={setScheme}
      />
    </ListRow>
  );
}
