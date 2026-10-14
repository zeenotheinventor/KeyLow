import { themes } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";

import { SessionCover } from "../components/SessionCover";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resolvedColor } from "./support/themeColor";

import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

function renderCover(scheme: ThemeScheme) {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <SessionCover />
    </ThemeProvider>,
  );
}

// How react-native-svg holds a colour once it has read it: an opaque ARGB number.
function paint(hex: string) {
  return { type: 0, payload: 0xff000000 + parseInt(hex.slice(1), 16) };
}

// A host node's props are loosely typed, so a prop is read with a descriptor.
function strokeOf(props: object): unknown {
  return Object.getOwnPropertyDescriptor(props, "stroke")?.value;
}

// The mark is decoration, so its drawing is looked for by what it is made of.
function drawn(type: string) {
  return screen.root?.queryAll((node) => node.type === type) ?? [];
}

describe("SessionCover", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", ["components/SessionCover"]);
  });

  beforeEach(() => {
    registerAppStyles(styles);
  });

  it("should be announced as Ki-Lo, as the board names it", async () => {
    await renderCover("dark");

    expect(screen.getByRole("img", { name: "Ki-Lo" })).toBeOnTheScreen();
  });

  it("should draw the mark once, hidden from assistive technology, at 112 points", async () => {
    await renderCover("dark");

    const [svg, ...others] = drawn("RNSVGSvgView");
    expect(others).toHaveLength(0);
    expect(svg?.props["aria-hidden"]).toBe(true);
    expect(svg?.props.width).toBe(112);
    expect(svg?.props.height).toBe(112);
  });

  it("should draw the arc and the three bars of the mark", async () => {
    await renderCover("dark");

    expect(drawn("RNSVGCircle")).toHaveLength(1);
    expect(drawn("RNSVGLine")).toHaveLength(3);
  });

  it.each<ThemeScheme>(["dark", "light"])(
    "should colour the arc with the %s accent and the bars with its primary text",
    async (scheme) => {
      await renderCover(scheme);

      expect(drawn("RNSVGCircle").map((node) => strokeOf(node.props))).toEqual([
        paint(themes[scheme].accent),
      ]);
      expect(drawn("RNSVGLine").map((node) => strokeOf(node.props))).toEqual(
        Array.from({ length: 3 }, () => paint(themes[scheme]["text-primary"])),
      );
    },
  );

  it.each<ThemeScheme>(["dark", "light"])(
    "should fill the screen with the %s background token",
    async (scheme) => {
      await renderCover(scheme);

      expect(screen.getByRole("img", { name: "Ki-Lo" })).toHaveStyle({
        backgroundColor: resolvedColor(scheme, "background"),
      });
    },
  );
});
