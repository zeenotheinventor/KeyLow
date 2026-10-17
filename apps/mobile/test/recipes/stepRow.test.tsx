import { render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { StepRow } from "../../components/StepRow";
import { GroupedList } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const longStep =
  "Fry the onion in the oil in an ovenproof pan for five minutes, then stir in the spinach until it wilts and the pan is nearly dry.";

describe("StepRow", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/StepRow"]);
  });

  beforeEach(async () => {
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    await render(
      <ThemeProvider fixedPreference="dark">
        <GroupedList hidesTitle title="Instructions">
          <StepRow number={1} text="Heat the oven." />
          <StepRow number={2} text={longStep} />
        </GroupedList>
      </ThemeProvider>,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
  });

  it("should be at least 52 points tall, and divide the steps with a hairline after the first", () => {
    expect(viewsDrawn({ minHeight: 52 })).toHaveLength(2);
    expect(viewsDrawn({ minHeight: 52, borderTopWidth: 1 })).toHaveLength(1);
  });
});
