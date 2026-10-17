import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo, Pressable, Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { ListRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { animatedScale } from "../support/animatedStyle";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type {
  ListRowProps,
  ListRowToPressProps,
  ListRowWithControlProps,
} from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const rowContents: Pick<ListRowToPressProps, "icon" | "title" | "subtitle" | "value" | "unit"> = {
  icon: "Utensils",
  title: "Greek yoghurt",
  subtitle: "170 g, Fage",
  value: "165",
  unit: "kcal",
};

const defaultProps: ListRowToPressProps = { ...rowContents, onPress: () => undefined };

function renderRow(props: Partial<ListRowToPressProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <ListRow {...defaultProps} {...props} />
    </ThemeProvider>,
  );
}

// A row with a control under it goes nowhere, so it is not given a press, which its type would refuse.
function renderRowWithControlProps(
  props: Partial<ListRowWithControlProps> = {},
  scheme: ThemeScheme = "dark",
) {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <ListRow {...rowContents} {...props} />
    </ThemeProvider>,
  );
}

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

// Icons are decoration and have no role to query by, so their drawings are counted.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

const rowName = "Greek yoghurt, 170 g, Fage, 165 kcal";
const schemes: ThemeScheme[] = ["dark", "light"];

describe("ListRow", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    setReduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("when it goes somewhere", () => {
    it("should be a button named by its title, subtitle and value", async () => {
      await renderRow();

      expect(screen.getByRole("button", { name: rowName })).toBeOnTheScreen();
    });

    it("should be named by its title alone when it has nothing else to say", async () => {
      await renderRow({ subtitle: undefined, value: undefined, unit: undefined });

      expect(screen.getByRole("button", { name: "Greek yoghurt" })).toBeOnTheScreen();
    });

    it("should call onPress when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderRow({ onPress });

      await user.press(screen.getByRole("button", { name: rowName }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should draw a chevron after its icon", async () => {
      await renderRow();

      expect(drawings()).toHaveLength(2);
    });

    it("should leave the chevron out when it does not navigate", async () => {
      await renderRow({ chevron: false });

      expect(drawings()).toHaveLength(1);
    });
  });

  describe("when it goes nowhere", () => {
    it("should be a plain row, not a button, with the same name", async () => {
      await renderRow({ onPress: undefined });

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
      expect(screen.getByLabelText(rowName)).toBeOnTheScreen();
    });

    it("should draw no chevron, because there is nowhere to go", async () => {
      await renderRow({ onPress: undefined });

      expect(drawings()).toHaveLength(1);
    });
  });

  describe("with a control under it", () => {
    function renderRowWithControl() {
      return renderRowWithControlProps({
        icon: "SunMoon",
        title: "Appearance",
        subtitle: undefined,
        value: undefined,
        unit: undefined,
        children: (
          <Pressable accessibilityRole="button" accessibilityLabel="Control">
            <Text>Control</Text>
          </Pressable>
        ),
      });
    }

    it("should show what it is given under its title", async () => {
      await renderRowWithControl();

      expect(screen.getByText("Control")).toBeOnTheScreen();
    });

    it("should leave the control reachable on its own, not folded into the row's name", async () => {
      await renderRowWithControl();

      expect(screen.getByRole("button", { name: "Control" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Appearance")).toBeOnTheScreen();
    });

    it("should pad its title row 12 across and above, with no minimum height, so the card is 116 tall around a 44 control", async () => {
      await renderRowWithControl();

      expect(screen.getByLabelText("Appearance")).toHaveStyle({
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 12,
        columnGap: 12,
      });
      expect(screen.getByLabelText("Appearance")).not.toHaveStyle({ minHeight: 56 });
    });

    it.each([
      ["null", null],
      ["false", false],
      ["undefined", undefined],
    ])(
      "should stay a plain row when its control is %s, as a conditional control is",
      async (_name, control) => {
        await renderRowWithControlProps({ children: control });

        expect(screen.getByLabelText(rowName)).toHaveStyle({ minHeight: 56, paddingTop: 8 });
      },
    );

    it("should not take a press together with a control", () => {
      // @ts-expect-error a row with a control under it goes nowhere, so the type refuses onPress beside it
      const props: ListRowProps = {
        title: "Appearance",
        onPress: () => undefined,
        children: <Text>Control</Text>,
      };

      expect(props.title).toBe("Appearance");
    });

    it("should pad the control 12 on every side", async () => {
      await renderRowWithControl();

      expect(screen.getByRole("button", { name: "Control" }).parent).toHaveStyle({
        padding: 12,
      });
    });
  });

  describe("contents", () => {
    it("should show the title, the subtitle, the value and its unit", async () => {
      await renderRow();

      expect(screen.getByText("Greek yoghurt")).toBeOnTheScreen();
      expect(screen.getByText("170 g, Fage")).toBeOnTheScreen();
      expect(screen.getByText("165")).toBeOnTheScreen();
      expect(screen.getByText("kcal")).toBeOnTheScreen();
    });

    it("should draw no icon tile unless given an icon", async () => {
      await renderRow({ icon: undefined });

      expect(drawings()).toHaveLength(1);
    });

    it("should show the value without a unit when it has none", async () => {
      await renderRow({ unit: undefined });

      expect(screen.getByText("165")).toBeOnTheScreen();
      expect(screen.queryByText("kcal")).not.toBeOnTheScreen();
    });
  });

  describe("layout", () => {
    it("should be at least 56 points tall, padded 12 across and 8 down, with 12 between its parts", async () => {
      await renderRow();

      expect(screen.getByRole("button", { name: rowName })).toHaveStyle({
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
        columnGap: 12,
      });
    });
  });

  describe("disabled", () => {
    it("should be a disabled button at half opacity", async () => {
      await renderRow({ disabled: true });

      const row = screen.getByRole("button", { name: rowName });
      expect(row).toBeDisabled();
      expect(row).toHaveStyle({ opacity: 0.5 });
    });

    it("should do nothing when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderRow({ disabled: true, onPress });

      await user.press(screen.getByRole("button", { name: rowName }));

      expect(onPress).not.toHaveBeenCalled();
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
    });

    it("should be disabled and at half opacity when it goes nowhere too", async () => {
      await renderRow({ onPress: undefined, disabled: true });

      const row = screen.getByLabelText(rowName);
      expect(row).toBeDisabled();
      expect(row).toHaveStyle({ opacity: 0.5 });
    });
  });

  describe("press feedback", () => {
    it("should compress to the row press scale, 0.985, show the overlay and spring back", async () => {
      await renderRow();
      const row = screen.getByRole("button", { name: rowName });

      await fireEvent(row, "pressIn");
      await advance(1000);
      expect(animatedScale(screen.getByTestId("press-scale"))).toBeCloseTo(0.985, 3);
      expect(screen.getByTestId("press-overlay")).toBeOnTheScreen();

      await fireEvent(row, "pressOut");
      await advance(1000);
      expect(animatedScale(screen.getByTestId("press-scale"))).toBeCloseTo(1, 3);
      expect(screen.queryByTestId("press-overlay")).not.toBeOnTheScreen();
    });

    it("should not compress when the user has reduced motion on, and still show the overlay", async () => {
      setReduceMotion(true);
      await renderRow();
      await advance(100);

      await fireEvent(screen.getByRole("button", { name: rowName }), "pressIn");
      await advance(1000);

      expect(animatedScale(screen.getByTestId("press-scale"))).toBe(1);
      expect(screen.getByTestId("press-overlay")).toBeOnTheScreen();
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it("should draw the title in the primary text colour, in Geist semibold", async () => {
      await renderRow({}, scheme);

      expect(await screen.findByText("Greek yoghurt")).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
        fontFamily: "Geist-SemiBold",
        fontSize: 16,
      });
    });

    it("should draw the subtitle and the unit as muted captions", async () => {
      await renderRow({}, scheme);

      for (const text of ["170 g, Fage", "kcal"]) {
        expect(await screen.findByText(text)).toHaveStyle({
          color: resolvedColor(scheme, "text-muted"),
          fontFamily: "Geist-Medium",
          fontSize: 12,
        });
      }
    });

    it("should draw the value as a small numeral in the primary text colour", async () => {
      await renderRow({}, scheme);

      expect(await screen.findByText("165")).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
        fontFamily: "Geist-SemiBold",
        fontSize: 20,
      });
    });

    it("should draw a quiet value as secondary body text, as the Archived recipes row's count", async () => {
      await renderRow(
        { title: "Archived recipes", value: "2", unit: undefined, valueLook: "quiet" },
        scheme,
      );

      expect(await screen.findByText("2")).toHaveStyle({
        color: resolvedColor(scheme, "text-secondary"),
        fontFamily: "Geist-Regular",
        fontSize: 16,
      });
    });
  });
});
