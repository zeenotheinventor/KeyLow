import { render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { EmptyState } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { EmptyStatePoint, EmptyStateProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const points: EmptyStatePoint[] = [
  { icon: "Calculator", text: "Estimates the energy you use, from a few questions about you." },
  { icon: "Scale", text: "Checks that estimate each week against your weigh-ins and food log." },
  { icon: "Target", text: "Adjusts your calorie and macro targets to keep you on pace." },
];

async function renderEmptyState(props: Partial<EmptyStateProps> = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <EmptyState
        body="A programme sets your targets from your goal."
        icon="ChartLine"
        title="Let Ki-Lo set your targets"
        {...props}
      />
    </ThemeProvider>,
  );
}

// The icons are decoration with no role, so their drawings are counted.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

describe("the points of an EmptyState", () => {
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

  it("should draw each point's words under the body", async () => {
    await renderEmptyState({ points });

    points.forEach((point) => {
      expect(screen.getByText(point.text)).toBeOnTheScreen();
    });
  });

  it("should draw an icon for each point, beside the tile's own", async () => {
    await renderEmptyState({ points });

    expect(drawings()).toHaveLength(4);
  });

  it("should draw the points in the order given", async () => {
    await renderEmptyState({ points });

    const drawn = screen.getAllByText(/^(Estimates|Checks|Adjusts)/);

    points.forEach((point, index) => {
      expect(drawn[index]).toHaveTextContent(point.text);
    });
  });

  it("should draw the action as a large full width primary button under the points", async () => {
    await renderEmptyState({
      points,
      action: { label: "Estimate my targets", variant: "primary", onPress: () => undefined },
    });

    expect(screen.getByRole("button", { name: "Estimate my targets" })).toHaveStyle({ height: 52 });
    expect(screen.getByTestId("button-layout")).toHaveStyle({ width: "100%" });
  });

  it("should press the action", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onPress = jest.fn();
    await renderEmptyState({
      points,
      action: { label: "Estimate my targets", variant: "primary", onPress },
    });

    await user.press(screen.getByRole("button", { name: "Estimate my targets" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("should draw no points, and only the tile's icon, when none are given", async () => {
    await renderEmptyState({});

    expect(drawings()).toHaveLength(1);
  });

  it("should draw no points for an empty list", async () => {
    await renderEmptyState({ points: [] });

    expect(drawings()).toHaveLength(1);
  });
});
