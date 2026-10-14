import { themes } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";

import { KiLoMark } from "../components/KiLoMark";
import { ThemeProvider } from "../lib/theme";

import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

function renderMark(scheme: ThemeScheme, props: { size?: number; label?: string } = {}) {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <KiLoMark size={64} {...props} />
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

// The mark is decoration unless it is named, so its drawing is looked for by what it is made of.
function drawn(type: string) {
  return screen.root?.queryAll((node) => node.type === type) ?? [];
}

describe("KiLoMark", () => {
  it("should draw the mark once, at the size it is given", async () => {
    await renderMark("dark", { size: 64 });

    const [svg, ...others] = drawn("RNSVGSvgView");
    expect(others).toHaveLength(0);
    expect(svg?.props.width).toBe(64);
    expect(svg?.props.height).toBe(64);
  });

  it("should draw the arc and the three bars", async () => {
    await renderMark("dark");

    expect(drawn("RNSVGCircle")).toHaveLength(1);
    expect(drawn("RNSVGLine")).toHaveLength(3);
  });

  it.each<ThemeScheme>(["dark", "light"])(
    "should colour the arc with the %s accent and the bars with its primary text",
    async (scheme) => {
      await renderMark(scheme);

      expect(drawn("RNSVGCircle").map((node) => strokeOf(node.props))).toEqual([
        paint(themes[scheme].accent),
      ]);
      expect(drawn("RNSVGLine").map((node) => strokeOf(node.props))).toEqual(
        Array.from({ length: 3 }, () => paint(themes[scheme]["text-primary"])),
      );
    },
  );

  it("should be hidden from assistive technology when it has no label", async () => {
    await renderMark("dark");

    expect(screen.queryByRole("img")).not.toBeOnTheScreen();
    expect(drawn("RNSVGSvgView")[0]?.props["aria-hidden"]).toBe(true);
  });

  it("should be announced as an image with its label when it has one", async () => {
    await renderMark("dark", { label: "Ki-Lo" });

    expect(screen.getByRole("img", { name: "Ki-Lo" })).toBeOnTheScreen();
  });
});
