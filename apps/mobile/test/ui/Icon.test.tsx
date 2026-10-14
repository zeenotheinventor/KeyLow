import { iconSize, iconStroke, themes } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";

import { Icon } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";

import type { IconSizeName, IconTone } from "../../components/ui";
import type { ColorName, ThemeScheme } from "@keylow/tokens";
import type { ReactNode } from "react";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

function inScheme(scheme: ThemeScheme, children: ReactNode) {
  return <ThemeProvider fixedPreference={scheme}>{children}</ThemeProvider>;
}

const sizes: { size: IconSizeName; pixels: number }[] = [
  { size: "sm", pixels: iconSize.sm },
  { size: "md", pixels: iconSize.md },
  { size: "lg", pixels: iconSize.lg },
  { size: "xl", pixels: iconSize.xl },
];

const tones: { tone: IconTone; colorName: ColorName }[] = [
  { tone: "primary", colorName: "text-primary" },
  { tone: "secondary", colorName: "text-secondary" },
  { tone: "muted", colorName: "text-muted" },
  { tone: "accent-foreground", colorName: "accent-foreground" },
  { tone: "on-status", colorName: "text-on-status" },
];

const schemes: ThemeScheme[] = ["dark", "light"];

describe("Icon", () => {
  it("should be hidden from screen readers when it has no label, because it is decoration", async () => {
    await render(inScheme("dark", <Icon name="Search" />));

    expect(screen.queryByRole("img")).not.toBeOnTheScreen();
  });

  it("should be an image with its label as the accessible name when it has one", async () => {
    await render(inScheme("dark", <Icon label="Search" name="Search" />));

    expect(screen.getByRole("img", { name: "Search" })).toBeOnTheScreen();
  });

  it("should be medium by default, 20 points", async () => {
    await render(inScheme("dark", <Icon label="Search" name="Search" />));

    const icon = screen.getByRole("img", { name: "Search" });
    expect(icon).toHaveProp("width", iconSize.md);
    expect(icon).toHaveProp("height", iconSize.md);
  });

  it.each(sizes)("should be $pixels points at the $size size", async ({ size, pixels }) => {
    await render(inScheme("dark", <Icon label="Search" name="Search" size={size} />));

    const icon = screen.getByRole("img", { name: "Search" });
    expect(icon).toHaveProp("width", pixels);
    expect(icon).toHaveProp("height", pixels);
  });

  it("should draw every icon with the design's stroke weight", async () => {
    await render(inScheme("dark", <Icon label="Search" name="Search" size="xl" />));

    expect(screen.getByRole("img", { name: "Search" })).toHaveProp("strokeWidth", iconStroke);
  });

  it("should render each name in the map", async () => {
    await render(
      inScheme(
        "dark",
        <>
          <Icon label="Plus" name="Plus" />
          <Icon label="Scan barcode" name="ScanBarcode" />
          <Icon label="Search" name="Search" />
          <Icon label="Close" name="X" />
        </>,
      ),
    );

    expect(screen.getAllByRole("img")).toHaveLength(4);
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it("should be the primary text colour by default", async () => {
      await render(inScheme(scheme, <Icon label="Search" name="Search" />));

      expect(screen.getByRole("img", { name: "Search" })).toHaveProp(
        "stroke",
        themes[scheme]["text-primary"],
      );
    });

    it.each(tones)("should take the $tone tone from its token", async ({ tone, colorName }) => {
      await render(inScheme(scheme, <Icon label="Search" name="Search" tone={tone} />));

      expect(screen.getByRole("img", { name: "Search" })).toHaveProp(
        "stroke",
        themes[scheme][colorName],
      );
    });
  });
});
