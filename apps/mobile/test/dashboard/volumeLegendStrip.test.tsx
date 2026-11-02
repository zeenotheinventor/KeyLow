import { render, screen, within } from "@testing-library/react-native";

import { BodyMapLegend } from "../../components/BodyMapLegend";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";
import { resolvedColor } from "../support/themeColor";

import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// A host node's props are loosely typed, so a prop is read with a descriptor.
function propOf(props: object, name: string): unknown {
  return Object.getOwnPropertyDescriptor(props, name)?.value;
}

// A style can be one object or a list of them, and a later one wins.
function styleProperty(style: unknown, name: string): unknown {
  if (Array.isArray(style)) {
    return style.map((part) => styleProperty(part, name)).findLast((value) => value !== undefined);
  }
  return typeof style === "object" && style !== null ? propOf(style, name) : undefined;
}

async function renderStrip(scheme: ThemeScheme = "dark") {
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <BodyMapLegend scale="volume" variant="strip" />
    </ThemeProvider>,
  );
  return screen.getByRole("img", { name: "Volume legend" });
}

// The swatches of the strip are its 14 point tall boxes, in the order they are drawn: High first.
function swatchesOf(legend: ReturnType<typeof screen.getByRole>) {
  return legend.queryAll(
    (node) => typeof node.type === "string" && styleProperty(node.props.style, "height") === 14,
  );
}

describe("the compact volume legend", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/BodyMapLegend"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  it("should be one image named for the volume legend", async () => {
    await renderStrip();

    expect(screen.getByRole("img", { name: "Volume legend" })).toBeOnTheScreen();
  });

  it("should read High at the top and None at the bottom", async () => {
    const legend = await renderStrip();

    expectTextsInOrder(within(legend).getAllByText(/./, { includeHiddenElements: true }), [
      "High",
      "None",
    ]);
  });

  it.each(["dark", "light"] as const)(
    "should draw the five bands from High down to Not trained in the %s volume tokens",
    async (scheme) => {
      const legend = await renderStrip(scheme);

      expect(
        swatchesOf(legend).map((swatch) => styleProperty(swatch.props.style, "backgroundColor")),
      ).toEqual(
        (
          [
            "volume-high",
            "volume-productive",
            "volume-growing",
            "volume-maintaining",
            "volume-not-trained",
          ] as const
        ).map((token) => resolvedColor(scheme, token)),
      );
    },
  );

  it("should give only the Not trained swatch a strong border", async () => {
    const legend = await renderStrip();

    const borders = swatchesOf(legend).map((swatch) =>
      styleProperty(swatch.props.style, "borderColor"),
    );

    expect(borders.slice(0, 4).every((border) => border === undefined)).toBe(true);
    expect(borders[4]).toBe(resolvedColor("dark", "border-strong"));
  });

  it("should leave out the caption of the wide legend", async () => {
    await renderStrip();

    expect(screen.queryByText(/sets/i, { includeHiddenElements: true })).not.toBeOnTheScreen();
  });
});
