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

// The Targets screen's value rows while a programme runs: a macro's colour key before the title.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const proteinRow: ListRowToPressProps = { title: "Protein", value: "126", unit: "g" };

async function renderRow(props: Partial<ListRowToPressProps> = {}, scheme: ThemeScheme = "dark") {
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <ListRow {...proteinRow} {...props} />
    </ThemeProvider>,
  );
}

describe("ListRow with a macro colour key", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ["dark", "protein"],
    ["dark", "carbs"],
    ["dark", "fat"],
    ["dark", "calories"],
    ["light", "calories"],
    ["light", "protein"],
    ["light", "carbs"],
    ["light", "fat"],
  ] as const)("should draw the %s scheme's %s colour as an 8 point key", async (scheme, macro) => {
    await renderRow({ macro }, scheme);

    expect(
      viewsDrawn({ width: 8, height: 8, backgroundColor: resolvedColor(scheme, macro) }),
    ).toHaveLength(1);
  });

  it("should draw no key when the row has no macro", async () => {
    await renderRow();

    for (const macro of ["protein", "carbs", "fat", "calories"] as const) {
      expect(
        viewsDrawn({ width: 8, height: 8, backgroundColor: resolvedColor("dark", macro) }),
      ).toHaveLength(0);
    }
  });

  it("should leave the row's name as it was, because the key is decoration", async () => {
    await renderRow({ macro: "protein" });

    expect(screen.getByLabelText("Protein, 126 g")).toBeOnTheScreen();
  });

  it("should draw the key for a row that is pressed, and keep its name", async () => {
    await renderRow({ macro: "fat", onPress: () => undefined });

    expect(screen.getByRole("button", { name: "Protein, 126 g" })).toBeOnTheScreen();
    expect(
      viewsDrawn({ width: 8, height: 8, backgroundColor: resolvedColor("dark", "fat") }),
    ).toHaveLength(1);
  });
});
