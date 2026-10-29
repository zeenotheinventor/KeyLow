import { render, screen, userEvent } from "@testing-library/react-native";

import { ScreenHeader } from "../components/ScreenHeader";
import { Button } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { viewsDrawn } from "./support/viewsDrawn";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

describe("ScreenHeader", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", ["components/ScreenHeader"]);
  });

  beforeEach(() => {
    registerAppStyles(styles);
  });

  it("should head the screen with its title as a heading", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <ScreenHeader title="Recipes" />
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Recipes" })).toBeOnTheScreen();
  });

  it("should draw the title and a control of the screen's on one row, 12 points apart", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <ThemeProvider fixedPreference="dark">
        <ScreenHeader
          title="Recipes"
          trailing={
            <Button size="sm" variant="secondary" onPress={onPress}>
              New recipe
            </Button>
          }
        />
      </ThemeProvider>,
    );

    await user.press(screen.getByRole("button", { name: "New recipe" }));

    expect(screen.getByRole("heading", { name: "Recipes" })).toBeOnTheScreen();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(viewsDrawn({ flexDirection: "row", alignItems: "center", columnGap: 12 })).toHaveLength(
      1,
    );
  });

  it("should draw no back control on a tab's own screen", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <ScreenHeader title="More" />
      </ThemeProvider>,
    );

    expect(screen.queryByRole("button")).not.toBeOnTheScreen();
  });

  it("should put a named back control before the title of a screen pushed inside a tab", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <ThemeProvider fixedPreference="dark">
        <ScreenHeader back={{ label: "Back to More", onPress }} title="Recipes" />
      </ThemeProvider>,
    );

    const back = screen.getByRole("button", { name: "Back to More" });
    const controls = screen.getAllByRole(/^(button|heading)$/);
    expect(controls.indexOf(back)).toBeLessThan(
      controls.indexOf(screen.getByRole("heading", { name: "Recipes" })),
    );

    await user.press(back);

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
