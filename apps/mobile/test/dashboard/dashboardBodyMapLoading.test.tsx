import { skeletonDelay } from "@keylow/tokens";
import { act, render, screen } from "@testing-library/react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { DashboardBodyMapLoading } from "../../components/DashboardScreen/DashboardBodyMapLoading";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// The skeleton is hidden from screen readers, because the status around it says what is loading, so its
// drawing is found by the id the kit's skeleton gives it, which exists for this and nothing else.
const hidden = { includeHiddenElements: true };
const drawing = () => screen.getByTestId("skeleton", hidden);

describe("DashboardBodyMapLoading", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DashboardScreen"]);
  });

  beforeEach(async () => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    await render(
      <ThemeProvider fixedPreference="dark">
        <DashboardBodyMapLoading />
      </ThemeProvider>,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should be a status that says what is loading", () => {
    expect(screen.getByRole("status", { name: "Loading the body map" })).toBeOnTheScreen();
  });

  it("should draw nothing until the 200 ms skeleton delay has passed, so a quick load never flickers", async () => {
    await advance(skeletonDelay - 1);

    expect(getAnimatedStyle(drawing()).opacity).toBe(0);
  });

  it("should fade in once the delay has passed", async () => {
    await advance(skeletonDelay + 500);

    expect(getAnimatedStyle(drawing()).opacity).toBe(1);
  });

  it("should be hidden from screen readers, because the status says what is loading", () => {
    expect(drawing()).toHaveProp("aria-hidden", true);
  });
});
