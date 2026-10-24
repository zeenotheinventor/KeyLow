import { render, screen, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { EstimateCard } from "../../components/SetupScreen/steps/EstimateStep/EstimateCard";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
// The cut-in is tested on its own (CutIn.test.tsx), so here it only says how long it was told to wait.
jest.mock("../../components/SetupScreen/steps/EstimateStep/CutIn", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    CutIn: ({ delay, children }: { delay: number; children: React.ReactNode }) => (
      <View testID={`cut-in-after-${delay}-ms`}>{children}</View>
    ),
  };
});

describe("the estimate's tiles cutting in", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SetupScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should cut in protein after 160 ms, carbohydrate after 196 ms and fat after 232 ms", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <EstimateCard
          lines={{ rateLine: "To keep your weight about where it is.", guardrailLines: [] }}
          targets={{ caloriesKcal: 1970, proteinG: 128, carbsG: 218, fatG: 65 }}
        />
      </ThemeProvider>,
    );

    // The count has settled, so nothing is left to update.
    await screen.findByText("1,970");

    expect(
      within(screen.getByTestId("cut-in-after-160-ms")).getByLabelText("Protein, 128 g"),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId("cut-in-after-196-ms")).getByLabelText("Carbs, 218 g"),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId("cut-in-after-232-ms")).getByLabelText("Fat, 65 g"),
    ).toBeOnTheScreen();
  });
});
