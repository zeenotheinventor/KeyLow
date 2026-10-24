import { act, render, screen, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { EstimateCard } from "../../components/SetupScreen/steps/EstimateStep/EstimateCard";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

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

describe("the estimate numeral's accent flash", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SetupScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function renderCard(isReducedMotion: boolean, shownAtFirst = "0") {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isReducedMotion);
    await render(
      <ThemeProvider fixedPreference="dark">
        <EstimateCard
          lines={{ rateLine: "To keep your weight about where it is.", guardrailLines: [] }}
          targets={{ caloriesKcal: 1970, proteinG: 128, carbsG: 218, fatG: 65 }}
        />
      </ThemeProvider>,
    );
    // The numeral is the same element all the way to its target, whatever it shows first.
    return within(screen.getByLabelText("Calorie target, estimate")).findByText(shownAtFirst);
  }

  it("should hold the accent for the first 200 ms, while the count runs", async () => {
    const numeral = await renderCard(false);

    await advance(150);

    expect(getAnimatedStyle(numeral)).toMatchObject({ color: resolvedColor("dark", "accent") });
  });

  it("should be back to the primary text colour once the flash has run its 600 ms", async () => {
    const numeral = await renderCard(false);

    await advance(200 + 600 + 50);

    expect(getAnimatedStyle(numeral)).toMatchObject({
      color: resolvedColor("dark", "text-primary"),
    });
  });

  it("should be neither the accent nor the resting colour half way through the flash", async () => {
    const numeral = await renderCard(false);

    await advance(200 + 300);

    expect(getAnimatedStyle(numeral)).not.toMatchObject({ color: resolvedColor("dark", "accent") });
    expect(getAnimatedStyle(numeral)).not.toMatchObject({
      color: resolvedColor("dark", "text-primary"),
    });
  });

  it("should never be the accent with reduced motion, at the start or as time passes", async () => {
    const numeral = await renderCard(true, "1,970");

    for (const milliseconds of [0, 150, 250, 600]) {
      await advance(milliseconds);

      expect(getAnimatedStyle(numeral)).toMatchObject({
        color: resolvedColor("dark", "text-primary"),
      });
    }
  });
});
