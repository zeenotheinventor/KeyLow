import { render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { Skeleton } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

// A skeleton is hidden from screen readers, because the screen says what is loading in words, so its
// drawing is found by ids, and a query has to ask for hidden elements.
const hidden = { includeHiddenElements: true };
const rows = () => screen.getAllByTestId("skeleton-entry-row", hidden);
const bones = () => screen.getAllByTestId("skeleton-bone", hidden);

describe("Skeleton shaped like the entry screen's loading board", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(async () => {
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    await render(
      <ThemeProvider fixedPreference="dark">
        <Skeleton rows={2} variant="entryGroup" />
      </ThemeProvider>,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be a card of as many rows as it is asked for", () => {
    expect(screen.getByTestId("skeleton-card", hidden)).toBeOnTheScreen();
    expect(rows()).toHaveLength(2);
  });

  it("should draw a name and a shorter line on each row, with no tile and no value", () => {
    expect(bones()).toHaveLength(4);
  });

  it("should make each row 64 points tall at least", () => {
    expect(viewsDrawn({ minHeight: 64 })).toHaveLength(2);
  });

  it("should vary the width of the names, and keep the lines at 40 percent", () => {
    const [firstName, firstLine, secondName, secondLine] = bones();

    expect(firstName).toHaveStyle({ width: "62%" });
    expect(secondName).toHaveStyle({ width: "48%" });
    expect(firstLine).toHaveStyle({ width: "40%" });
    expect(secondLine).toHaveStyle({ width: "40%" });
  });

  it("should part the rows with a hairline, and draw none above the first", () => {
    expect(rows()[0]).not.toHaveStyle({ borderTopWidth: 1 });
    expect(rows()[1]).toHaveStyle({ borderTopWidth: 1 });
  });
});
