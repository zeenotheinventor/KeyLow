import { render, screen } from "@testing-library/react-native";

import { Icon } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";

import type { IconName } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The glyphs the assistant boards draw that the icon map lacked. The boards' undone card draws the
// rotate-left glyph the map already has, so there is no Undo2.
const assistantIcons: IconName[] = [
  "ArrowUp",
  "Database",
  "Moon",
  "PowerOff",
  "Sparkles",
  "SquarePen",
];

describe("the assistant icons", () => {
  it.each(assistantIcons)(
    "should render %s through Icon, with its accessible name",
    async (name) => {
      await render(
        <ThemeProvider fixedPreference="dark">
          <Icon label={name} name={name} />
        </ThemeProvider>,
      );

      expect(screen.getByRole("img", { name })).toBeOnTheScreen();
    },
  );
});
