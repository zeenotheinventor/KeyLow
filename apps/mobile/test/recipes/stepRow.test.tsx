import { themes } from "@keylow/tokens";
import { render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { StepRow } from "../../components/StepRow";
import { GroupedList } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

import type { StepRowProps } from "../../components/StepRow";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const longStep =
  "Fry the onion in the oil in an ovenproof pan for five minutes, then stir in the spinach until it wilts and the pan is nearly dry.";

// Icons are decoration and have no role to query by, so their drawings are counted.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

function renderRows(second: Partial<StepRowProps> = {}) {
  return render(
    <ThemeProvider fixedPreference="dark">
      <GroupedList hidesTitle title="Instructions">
        <StepRow number={1} text="Heat the oven." {...second} />
        <StepRow number={2} text={longStep} {...second} />
      </GroupedList>
    </ThemeProvider>,
  );
}

describe("StepRow", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/StepRow"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("read only, as the recipe view draws it", () => {
    beforeEach(async () => {
      await renderRows();
    });

    it("should write the number and the step", () => {
      expect(screen.getByText("1")).toBeOnTheScreen();
      expect(screen.getByText("Heat the oven.")).toBeOnTheScreen();
    });

    it("should write the number at weight 600 over 12 points, as the board does", () => {
      expect(screen.getByText("1")).toHaveStyle({ fontFamily: "Geist-SemiBold", fontSize: 12 });
    });

    it("should write the whole step, never clamped", () => {
      expect(screen.getByText(longStep)).not.toHaveProp("numberOfLines");
    });

    it("should have nothing to press and no chevron", () => {
      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
      expect(drawings()).toHaveLength(0);
    });

    it("should be at least 52 points tall, and divide the steps with a hairline after the first", () => {
      expect(viewsDrawn({ minHeight: 52 })).toHaveLength(2);
      expect(viewsDrawn({ minHeight: 52, borderTopWidth: 1 })).toHaveLength(1);
    });
  });

  describe("in the editor, where it opens the step", () => {
    it("should be a button named for its place and its whole text, which says it edits", async () => {
      await renderRows({ onPress: jest.fn() });

      expect(
        screen.getByRole("button", { name: "Step 1, Heat the oven., edit" }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: `Step 2, ${longStep}, edit` })).toBeOnTheScreen();
    });

    it("should call onPress when pressed", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderRows({ onPress });

      await user.press(screen.getByRole("button", { name: "Step 1, Heat the oven., edit" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should end in a chevron on each row", async () => {
      await renderRows({ onPress: jest.fn() });

      expect(drawings()).toHaveLength(2);
    });

    it("should still write the number and the whole step, never clamped", async () => {
      await renderRows({ onPress: jest.fn() });

      expect(screen.getByText("2")).toBeOnTheScreen();
      expect(screen.getByText(longStep)).not.toHaveProp("numberOfLines");
    });

    it("should be at least 52 points tall, and divide the steps with a hairline after the first", async () => {
      await renderRows({ onPress: jest.fn() });

      expect(viewsDrawn({ minHeight: 52 })).toHaveLength(2);
      expect(viewsDrawn({ minHeight: 52, borderTopWidth: 1 })).toHaveLength(1);
    });
  });

  describe("in reorder mode, where it moves", () => {
    const reorder = (overrides: Partial<NonNullable<StepRowProps["reorder"]>> = {}) => ({
      canMoveUp: true,
      canMoveDown: true,
      isHighlighted: false,
      onMoveUp: jest.fn(),
      onMoveDown: jest.fn(),
      ...overrides,
    });

    it("should have a button to move the step up and one to move it down, named for its place", async () => {
      await renderRows({ reorder: reorder() });

      expect(screen.getByRole("button", { name: "Move step 1 up" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Move step 1 down" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Move step 2 up" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Move step 2 down" })).toBeOnTheScreen();
    });

    it("should call the move that was pressed", async () => {
      const user = userEvent.setup();
      const onMoveUp = jest.fn();
      const onMoveDown = jest.fn();
      await renderRows({ reorder: reorder({ onMoveUp, onMoveDown }) });

      await user.press(screen.getByRole("button", { name: "Move step 2 up" }));
      expect(onMoveUp).toHaveBeenCalledTimes(1);
      expect(onMoveDown).not.toHaveBeenCalled();

      await user.press(screen.getByRole("button", { name: "Move step 2 down" }));
      expect(onMoveDown).toHaveBeenCalledTimes(1);
    });

    it("should turn a move off when the step cannot make it", async () => {
      await renderRows({ reorder: reorder({ canMoveUp: false, canMoveDown: false }) });

      expect(screen.getByRole("button", { name: "Move step 1 up" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Move step 1 down" })).toBeDisabled();
    });

    it("should not be a button to open, and should draw no chevron", async () => {
      await renderRows({ onPress: jest.fn(), reorder: reorder() });

      expect(screen.queryByRole("button", { name: /, edit$/ })).not.toBeOnTheScreen();
      expect(screen.getAllByRole("button")).toHaveLength(4);
    });

    it("should still write the number and the whole step", async () => {
      await renderRows({ reorder: reorder() });

      expect(screen.getByText("2")).toBeOnTheScreen();
      expect(screen.getByText(longStep)).not.toHaveProp("numberOfLines");
    });

    it("should carry the accent highlight while the step has just moved", async () => {
      await renderRows({ reorder: reorder({ isHighlighted: true }) });

      expect(viewsDrawn({ backgroundColor: themes.dark["accent-muted"] })).toHaveLength(2);
    });

    it("should be plain when it has not moved", async () => {
      await renderRows({ reorder: reorder() });

      expect(viewsDrawn({ backgroundColor: themes.dark["accent-muted"] })).toHaveLength(0);
    });
  });
});
