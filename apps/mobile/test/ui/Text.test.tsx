import { render, screen } from "@testing-library/react-native";

import { Text } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { TextTone, TextVariant } from "../../components/ui";
import type { ColorName, ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The design system's typography tokens, with the letter spacing in pixels (the em value times the size)
// and the Geist file of each weight, since React Native cannot pick a weight of a custom family.
const variants: {
  variant: TextVariant;
  fontFamily: string;
  fontWeight: "400" | "500" | "600";
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}[] = [
  {
    variant: "display-numeral",
    fontFamily: "Geist-SemiBold",
    fontWeight: "600",
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1.68,
  },
  {
    variant: "h1",
    fontFamily: "Geist-SemiBold",
    fontWeight: "600",
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.56,
  },
  {
    variant: "h2",
    fontFamily: "Geist-SemiBold",
    fontWeight: "600",
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  {
    variant: "body",
    fontFamily: "Geist-Regular",
    fontWeight: "400",
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  {
    variant: "body-strong",
    fontFamily: "Geist-SemiBold",
    fontWeight: "600",
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  {
    variant: "caption",
    fontFamily: "Geist-Medium",
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.12,
  },
  {
    variant: "numeral-small",
    fontFamily: "Geist-SemiBold",
    fontWeight: "600",
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
];

const tones: { tone: TextTone; colorName: ColorName }[] = [
  { tone: "primary", colorName: "text-primary" },
  { tone: "secondary", colorName: "text-secondary" },
  { tone: "muted", colorName: "text-muted" },
  { tone: "accent-foreground", colorName: "accent-foreground" },
  { tone: "on-status", colorName: "text-on-status" },
];

const schemes: ThemeScheme[] = ["dark", "light"];

describe("Text", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("text-center");
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe.each(variants)(
    "the $variant variant",
    ({ variant, fontFamily, fontWeight, fontSize, lineHeight, letterSpacing }) => {
      it("should resolve to its design size, line height and letter spacing", async () => {
        await render(<Text variant={variant}>Sample</Text>);

        expect(screen.getByText("Sample")).toHaveStyle({ fontSize, lineHeight, letterSpacing });
      });

      // The scale classes set a weight and no family, so a variant that left out its family class
      // would render the system font, or a synthetic bold on the Regular file.
      it(`should use the ${fontFamily} file at weight ${fontWeight}`, async () => {
        await render(<Text variant={variant}>Sample</Text>);

        expect(screen.getByText("Sample")).toHaveStyle({ fontFamily, fontWeight });
      });

      it("should set tabular figures, because the design asks for them on every number", async () => {
        await render(<Text variant={variant}>1,234</Text>);

        expect(screen.getByText("1,234").props.style).toMatchObject({
          fontVariant: "tabular-nums",
        });
      });
    },
  );

  it("should be the body variant by default", async () => {
    await render(<Text>Plain</Text>);

    expect(screen.getByText("Plain")).toHaveStyle({
      fontFamily: "Geist-Regular",
      fontSize: 16,
      lineHeight: 24,
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it("should be the primary text colour by default", async () => {
      await render(
        <ThemeProvider fixedPreference={scheme}>
          <Text>Plain</Text>
        </ThemeProvider>,
      );

      expect(await screen.findByText("Plain")).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
      });
    });

    it.each(tones)("should colour the $tone tone from its token", async ({ tone, colorName }) => {
      await render(
        <ThemeProvider fixedPreference={scheme}>
          <Text tone={tone}>Toned</Text>
        </ThemeProvider>,
      );

      expect(await screen.findByText("Toned")).toHaveStyle({
        color: resolvedColor(scheme, colorName),
      });
    });
  });

  it("should leave heading semantics to the caller, so a variant is only a look", async () => {
    await render(
      <Text role="heading" variant="h2">
        Search for a food
      </Text>,
    );

    expect(screen.getByRole("heading", { name: "Search for a food" })).toBeOnTheScreen();
  });

  it("should take layout classes from the caller", async () => {
    await render(<Text className="text-center">Centred</Text>);

    expect(screen.getByText("Centred")).toHaveStyle({ textAlign: "center" });
  });
});
