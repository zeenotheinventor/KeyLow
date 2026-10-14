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

const schemes: ThemeScheme[] = ["dark", "light"];

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

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it("should be the surface with a 1 point border, rounded large, clipping what it holds", async () => {
      await renderCard({}, scheme);

      expect(await screen.findByLabelText("Today")).toHaveStyle({
        backgroundColor: resolvedColor(scheme, "surface"),
        borderColor: resolvedColor(scheme, "border"),
        borderWidth: 1,
        borderRadius: 20,
        overflow: "hidden",
      });
    });

    it("should sit on the raised surface at the raised level", async () => {
      await renderCard({ level: "raised" }, scheme);

      expect(await screen.findByLabelText("Today")).toHaveStyle({
        backgroundColor: resolvedColor(scheme, "surface-raised"),
      });
    });

    it("should draw the card elevation from the token, which renders on a device", async () => {
      await renderCard({}, scheme);

      expect(await screen.findByLabelText("Today")).toHaveStyle({
        boxShadow: elevation[scheme].card,
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
