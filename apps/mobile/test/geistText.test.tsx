import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { compileAppStyles, registerAppStyles } from "./support/nativeWindStyles";

// React Native cannot pick a weight of a custom family, so each weight class names the family of
// the embedded file for that weight, and states the weight so a heavier parent does not leak in.
describe("Geist text", () => {
  let appStyles: string;

  beforeAll(async () => {
    appStyles = await compileAppStyles(
      "font-sans font-normal font-medium font-semibold text-h1 text-caption tabular-nums",
    );
  });

  beforeEach(() => {
    registerAppStyles(appStyles);
  });

  it("should render font-sans in the regular file", async () => {
    await render(<Text className="font-sans">Sans</Text>);

    expect(screen.getByText("Sans")).toHaveStyle({ fontFamily: "Geist-Regular" });
  });

  it.each([
    { className: "font-normal", fontFamily: "Geist-Regular", fontWeight: "400" },
    { className: "font-medium", fontFamily: "Geist-Medium", fontWeight: "500" },
    { className: "font-semibold", fontFamily: "Geist-SemiBold", fontWeight: "600" },
  ] as const)(
    "should render $className in $fontFamily at weight $fontWeight",
    async ({ className, fontFamily, fontWeight }) => {
      await render(<Text className={className}>Weighted</Text>);

      expect(screen.getByText("Weighted")).toHaveStyle({ fontFamily, fontWeight });
    },
  );

  // The scale classes set a weight but no family, so on their own they render the system font. The
  // Text primitive in KEY-93 pairs each with a weight class.
  it("should leave the type scale without a family, to be paired with a weight class", async () => {
    await render(<Text className="text-h1">Scale only</Text>);

    expect(screen.getByText("Scale only").props.style).not.toHaveProperty("fontFamily");
  });

  describe("em letter spacing in the type scale", () => {
    it("should convert the heading token's -0.02em to pixels of its 28px size", async () => {
      await render(<Text className="text-h1">Heading</Text>);

      expect(screen.getByText("Heading")).toHaveStyle({ fontSize: 28, letterSpacing: -0.56 });
    });

    it("should convert the caption token's +0.01em to pixels of its 12px size", async () => {
      await render(<Text className="text-caption">Caption</Text>);

      expect(screen.getByText("Caption")).toHaveStyle({ fontSize: 12, letterSpacing: 0.12 });
    });
  });

  // NativeWind 4.2.7 drops font-variant-numeric, so the class is accepted and has no effect. The
  // Text primitive in KEY-93 has to set fontVariant itself. When this test fails, NativeWind has
  // started supporting it, and that primitive can use the class instead.
  it("should accept tabular-nums without producing a style", async () => {
    await render(<Text className="tabular-nums">123</Text>);

    expect(screen.getByText("123").props.style).toBeUndefined();
  });
});
