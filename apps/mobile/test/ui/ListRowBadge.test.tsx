import { themes } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { ListRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";
import { viewsDrawn } from "../support/viewsDrawn";

import type { ListRowToPressProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

// The weigh-in list's row: a status badge before the value, such as "Left out of trend".

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

const leftOut = { label: "Left out of trend", tone: "warning" } as const;

async function renderRow(props: Partial<ListRowToPressProps> = {}, scheme: ThemeScheme = "dark") {
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <ListRow {...weighIn} {...props} />
    </ThemeProvider>,
  );
}

describe("ListRow with a badge", () => {
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

  it("should show the badge's label", async () => {
    await renderRow({ badge: leftOut });

    expect(screen.getByText("Left out of trend")).toBeOnTheScreen();
  });

  it("should add the badge's label to the row's name, between the subtitle and the value", async () => {
    await renderRow({ badge: leftOut });

    expect(
      screen.getByLabelText("Sat 10 Oct, 08:00 · Added by you, Left out of trend, 99.0 kg"),
    ).toBeOnTheScreen();
  });

  it("should add the badge's label to the name of a row that is pressed", async () => {
    await renderRow({ badge: leftOut, onPress: () => undefined });

    expect(
      screen.getByRole("button", {
        name: "Sat 10 Oct, 08:00 · Added by you, Left out of trend, 99.0 kg",
      }),
    ).toBeOnTheScreen();
  });

  it("should draw the badge after the subtitle and before the value", async () => {
    await renderRow({ badge: leftOut });

    expectTextsInOrder(screen.getAllByText(/./), [
      "Sat 10 Oct",
      "08:00 · Added by you",
      "Left out of trend",
      "99.0",
      "kg",
    ]);
  });

  it("should be named as it was before, and draw no badge, when it has none", async () => {
    await renderRow();

    expect(screen.getByLabelText("Sat 10 Oct, 08:00 · Added by you, 99.0 kg")).toBeOnTheScreen();
    expect(screen.queryByText("Left out of trend")).not.toBeOnTheScreen();
  });

  it("should draw the badge for a row with no value", async () => {
    await renderRow({ badge: leftOut, value: undefined, unit: undefined });

    expect(
      screen.getByLabelText("Sat 10 Oct, 08:00 · Added by you, Left out of trend"),
    ).toBeOnTheScreen();
  });

  it.each(["dark", "light"] as const)(
    "should draw a warning badge as the warning tone's pill in the %s scheme",
    async (scheme) => {
      await renderRow({ badge: leftOut }, scheme);

      expect(
        viewsDrawn({ height: 20, backgroundColor: themes[scheme]["warning-muted"] }),
      ).toHaveLength(1);
    },
  );
});
