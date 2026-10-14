import { iconSize, iconStroke, themes } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";

import { Icon } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";

import type { IconName, IconSizeName, IconTone } from "../../components/ui";
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
  // The status glyphs of a banner and an error tile, drawn on a muted fill or beside the words.
  { tone: "warning", colorName: "warning" },
  { tone: "danger", colorName: "danger" },
];

const names: IconName[] = [
  "Apple",
  "BookOpen",
  "Camera",
  "CameraOff",
  "ChefHat",
  "ChevronLeft",
  "ChevronRight",
  "CircleAlert",
  "Clock",
  "CloudOff",
  "Ellipsis",
  "Info",
  "LayoutDashboard",
  "LoaderCircle",
  "Plus",
  "RefreshCcw",
  "RotateCw",
  "ScanBarcode",
  "Search",
  "SearchX",
  "Trash2",
  "TriangleAlert",
  "Utensils",
  "WifiOff",
  "X",
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

  it("should draw at a size in points when given a number, for a glyph the frames draw off the scale", async () => {
    await render(inScheme("dark", <Icon label="Close" name="X" size={22} />));

    const icon = screen.getByRole("img", { name: "Close" });
    expect(icon).toHaveProp("width", 22);
    expect(icon).toHaveProp("height", 22);
  });

  it("should draw every icon with the design's stroke weight", async () => {
    await render(inScheme("dark", <Icon label="Search" name="Search" size="xl" />));

    expect(screen.getByRole("img", { name: "Search" })).toHaveProp("strokeWidth", iconStroke);
  });

  it("should draw a bolder stroke when the frame does, as the tab bar's plus is", async () => {
    await render(inScheme("dark", <Icon label="Add" name="Plus" strokeWidth={2.25} />));

    expect(screen.getByRole("img", { name: "Add" })).toHaveProp("strokeWidth", 2.25);
  });

  it("should render each name in the map", async () => {
    await render(
      inScheme(
        "dark",
        <>
          {names.map((name) => (
            <Icon key={name} label={name} name={name} />
          ))}
        </>,
      ),
    );

    expect(screen.getAllByRole("img")).toHaveLength(names.length);
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it("should be the primary text colour by default", async () => {
      await render(inScheme(scheme, <Icon label="Search" name="Search" />));

      expect(screen.getByRole("img", { name: "Search" })).toHaveProp(
        "stroke",
        themes[scheme]["text-primary"],
      );
    });

    // The design's `--accent-ink` is lime in dark and the primary text colour in light, because lime on a
    // light surface is too faint for a thin glyph. It is a proposed token, so it is resolved here.
    it("should take the accent ink tone as lime in dark and the primary text colour in light", async () => {
      await render(inScheme(scheme, <Icon label="Search" name="Search" tone="accent-ink" />));

      expect(screen.getByRole("img", { name: "Search" })).toHaveProp(
        "stroke",
        scheme === "dark" ? themes.dark.accent : themes.light["text-primary"],
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
