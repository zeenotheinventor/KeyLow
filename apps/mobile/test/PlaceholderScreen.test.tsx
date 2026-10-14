import { render, screen } from "@testing-library/react-native";

import { PlaceholderScreen } from "../components/PlaceholderScreen";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resolvedColor } from "./support/themeColor";

import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

function renderPlaceholder(scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <PlaceholderScreen body="Your recipes will appear here." icon="ChefHat" title="Recipes" />
    </ThemeProvider>,
  );
}

describe("PlaceholderScreen", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", [
      "components/PlaceholderScreen",
      "components/ScreenHeader",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(styles);
  });

  it("should head the screen with its title as a heading", async () => {
    await renderPlaceholder();

    expect(screen.getByRole("heading", { name: "Recipes" })).toBeOnTheScreen();
  });

  it("should set the screen title in the h1 style, in the primary text colour", async () => {
    await renderPlaceholder();

    expect(screen.getByRole("heading", { name: "Recipes" })).toHaveStyle({
      fontSize: 28,
      lineHeight: 34,
      color: resolvedColor("dark", "text-primary"),
    });
  });

  it("should say Coming soon, with the sentence it is given under it", async () => {
    await renderPlaceholder();

    expect(screen.getByRole("heading", { name: "Coming soon" })).toBeOnTheScreen();
    expect(screen.getByText("Your recipes will appear here.")).toBeOnTheScreen();
  });

  it("should draw no button, because a placeholder has nothing to do", async () => {
    await renderPlaceholder();

    expect(screen.queryByRole("button")).not.toBeOnTheScreen();
  });
});
