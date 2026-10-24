import { themes } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";
import { View } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { ThemeProvider, ThemeScope, useTheme } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resolvedColor } from "./support/themeColor";

import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

// Shows the theme its place in the tree gives it, and takes the background class that reads the variables.
function Probe({ name }: { name: string }) {
  const { scheme, colors, preference } = useTheme();

  return (
    <View
      accessible
      aria-label={`${name}: ${scheme}, ${colors.background}, ${preference}`}
      className="bg-background"
      role="img"
    />
  );
}

function renderScoped(appScheme: ThemeScheme, scopeScheme: ThemeScheme) {
  return render(
    <ThemeProvider fixedPreference={appScheme}>
      <Probe name="outside" />
      <ThemeScope scheme={scopeScheme}>
        <Probe name="inside" />
      </ThemeScope>
    </ThemeProvider>,
  );
}

describe("ThemeScope", () => {
  beforeAll(async () => {
    registerAppStyles(await compileKitStyles("bg-background", ["lib/theme"]));
  });

  it("should give what is inside the scheme and the raw colours it names, and what is outside the app's", async () => {
    await renderScoped("light", "dark");

    expect(
      screen.getByRole("img", { name: `inside: dark, ${themes.dark.background}, light` }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("img", { name: `outside: light, ${themes.light.background}, light` }),
    ).toBeOnTheScreen();
  });

  it("should set the scheme's variables on its view, so a colour class inside reads them", async () => {
    await renderScoped("light", "dark");

    expect(screen.getByRole("img", { name: new RegExp(`^inside: dark`) })).toHaveStyle({
      backgroundColor: resolvedColor("dark", "background"),
    });
    expect(screen.getByRole("img", { name: new RegExp(`^outside: light`) })).toHaveStyle({
      backgroundColor: resolvedColor("light", "background"),
    });
  });

  it("should work the other way round, a light scope in a dark app", async () => {
    await renderScoped("dark", "light");

    expect(screen.getByRole("img", { name: new RegExp(`^inside: light`) })).toHaveStyle({
      backgroundColor: resolvedColor("light", "background"),
    });
  });
});
