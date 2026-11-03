import { elevation } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { Card } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { CardProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

function renderCard(props: Partial<CardProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <Card aria-label="Today" role="group" {...props}>
        <Text>Inside the card</Text>
      </Card>
    </ThemeProvider>,
  );
}

describe("Card", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  it("should hold what it is given", async () => {
    await renderCard();

    expect(screen.getByText("Inside the card")).toBeOnTheScreen();
  });

  it("should take the role and name its caller gives it, so a list or a group can be a card", async () => {
    await renderCard({ role: "list", "aria-label": "Common foods" });

    // A list is not itself an accessibility element, so a screen reader can reach its rows one by one.
    expect(screen.getByLabelText("Common foods")).toHaveProp("role", "list");
  });

  describe("in the dark scheme", () => {
    it("should be the surface with a 1 point border, rounded large, clipping what it holds", async () => {
      await renderCard({}, "dark");

      expect(await screen.findByLabelText("Today")).toHaveStyle({
        backgroundColor: resolvedColor("dark", "surface"),
        borderColor: resolvedColor("dark", "border"),
        borderWidth: 1,
        borderRadius: 20,
        overflow: "hidden",
      });
    });

    it("should sit on the raised surface at the raised level", async () => {
      await renderCard({ level: "raised" }, "dark");

      expect(await screen.findByLabelText("Today")).toHaveStyle({
        backgroundColor: resolvedColor("dark", "surface-raised"),
      });
    });

    it("should draw the card elevation from the token, which renders on a device", async () => {
      await renderCard({}, "dark");

      expect(await screen.findByLabelText("Today")).toHaveStyle({
        boxShadow: elevation.dark.card,
      });
    });
  });

  describe("in the light scheme", () => {
    it("should sit on the raised surface at the raised level", async () => {
      await renderCard({ level: "raised" }, "light");

      expect(await screen.findByLabelText("Today")).toHaveStyle({
        backgroundColor: resolvedColor("light", "surface-raised"),
      });
    });
  });

  describe("the border", () => {
    it("should be the hairline by default, in the dark scheme", async () => {
      await renderCard({}, "dark");

      expect(screen.getByLabelText("Today")).toHaveStyle({
        borderColor: resolvedColor("dark", "border"),
        borderWidth: 1,
      });
    });

    it("should be the accent when asked, in the dark scheme", async () => {
      await renderCard({ border: "accent" }, "dark");

      expect(screen.getByLabelText("Today")).toHaveStyle({
        borderColor: resolvedColor("dark", "accent"),
        borderWidth: 1,
      });
    });

    it("should be the accent when asked, in the light scheme", async () => {
      await renderCard({ border: "accent" }, "light");

      expect(screen.getByLabelText("Today")).toHaveStyle({
        borderColor: resolvedColor("light", "accent"),
        borderWidth: 1,
      });
    });
  });

  it.each([
    { name: "by default", props: {}, points: 16 },
    { name: "at step 4", props: { padding: 4 }, points: 16 },
    { name: "at step 3", props: { padding: 3 }, points: 12 },
  ] as const)("should pad $points points $name", async ({ props, points }) => {
    await renderCard(props);

    expect(await screen.findByLabelText("Today")).toHaveStyle({ padding: points });
  });

  it("should have no padding at step 0, for rows that bring their own", async () => {
    await renderCard({ padding: 0 });

    expect(await screen.findByLabelText("Today")).not.toHaveStyle({ padding: 16 });
    expect(screen.getByLabelText("Today")).toHaveStyle({ padding: 0 });
  });
});
