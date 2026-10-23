import { render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { ListRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { ListRowToPressProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

// The weigh-in list's row, which `weight: chart and weigh-ins` draws at 52 points with a label-small title,
// a muted caption, a 32 point tile and a semibold value that the unit reads with.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const weighIn: ListRowToPressProps = {
  icon: "Pencil",
  title: "Sat 10 Oct",
  subtitle: "08:00 · Added by you",
  value: "99.0",
  unit: "kg",
};

const rowName = "Sat 10 Oct, 08:00 · Added by you, 99.0 kg";

async function renderRow(props: Partial<ListRowToPressProps> = {}, scheme: ThemeScheme = "dark") {
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <ListRow {...weighIn} {...props} />
    </ThemeProvider>,
  );
}

describe("a compact ListRow", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should be 52 points tall at least, padded 8 above and below and 12 at the sides, with 12 between its parts", async () => {
    await renderRow({ size: "compact" });

    expect(screen.getByLabelText(rowName)).toHaveStyle({
      minHeight: 52,
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 12,
      paddingRight: 12,
      columnGap: 12,
    });
  });

  it("should keep the default row 56 points tall", async () => {
    await renderRow();

    expect(screen.getByLabelText(rowName)).toHaveStyle({ minHeight: 56 });
    expect(screen.getByLabelText(rowName)).not.toHaveStyle({ minHeight: 52 });
  });

  it("should draw a 32 point tile with the small corners and an 18 point icon", async () => {
    await renderRow({ size: "compact" });

    expect(
      viewsDrawn({
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: resolvedColor("dark", "surface-raised"),
      }),
    ).toHaveLength(1);
    const icons = screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveProp("width", 18);
  });

  it("should draw the default tile and icon as before", async () => {
    await renderRow();

    const icons = screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
    expect(icons[0]).toHaveProp("width", 20);
    expect(viewsDrawn({ width: 36, height: 36 })).toHaveLength(1);
  });

  it("should put no gap between the title and the subtitle, where the default row has 2 points", async () => {
    await renderRow({ size: "compact" });
    expect(viewsDrawn({ rowGap: 2 })).toHaveLength(0);

    await screen.unmount();
    await renderRow();
    expect(viewsDrawn({ rowGap: 2 })).toHaveLength(1);
  });

  it("should let the subtitle wrap to a second line, so it is not clipped beside the badge and the value", async () => {
    await renderRow({ size: "compact", badge: { label: "Left out of trend", tone: "warning" } });

    expect(screen.getByText("08:00 · Added by you")).toHaveProp("numberOfLines", 2);
  });

  it("should keep the default subtitle to one line", async () => {
    await renderRow();

    expect(screen.getByText("08:00 · Added by you")).toHaveProp("numberOfLines", 1);
  });

  it("should draw the value and the unit as one piece, so the name is unchanged", async () => {
    await renderRow({ size: "compact" });

    expect(screen.getByText("99.0 kg")).toBeOnTheScreen();
    expect(screen.getByLabelText(rowName)).toBeOnTheScreen();
  });

  describe.each(["dark", "light"] as const)("in the %s scheme", (scheme) => {
    it("should draw the title as a 14 over 20 semibold label in the primary colour", async () => {
      await renderRow({ size: "compact" }, scheme);

      expect(screen.getByText("Sat 10 Oct")).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
        fontFamily: "Geist-SemiBold",
        fontSize: 14,
        lineHeight: 20,
      });
    });

    it("should draw the subtitle as a 12 over 16 caption in the muted colour", async () => {
      await renderRow({ size: "compact" }, scheme);

      expect(screen.getByText("08:00 · Added by you")).toHaveStyle({
        color: resolvedColor(scheme, "text-muted"),
        fontSize: 12,
        lineHeight: 16,
      });
    });

    it("should draw the value and unit as a 16 over 24 semibold figure in the primary colour", async () => {
      await renderRow({ size: "compact" }, scheme);

      expect(screen.getByText("99.0 kg")).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
        fontFamily: "Geist-SemiBold",
        fontSize: 16,
        lineHeight: 24,
      });
    });

    it("should draw the value and unit in the muted colour when the value tone is muted", async () => {
      await renderRow({ size: "compact", valueTone: "muted" }, scheme);

      expect(screen.getByText("99.0 kg")).toHaveStyle({
        color: resolvedColor(scheme, "text-muted"),
      });
    });
  });
});
