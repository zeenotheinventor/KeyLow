import { describeMuscleListRow } from "@keylow/core/copy";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";

import { MuscleRow } from "../../components/MuscleRow";
import { GroupedList } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { MuscleListRow } from "@keylow/core/training";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// Hamstrings in the golden week at Thursday 19:00, as KEY-393 pins them.
const hamstrings: MuscleListRow = {
  muscle: "hamstrings",
  heatPercent: 55,
  heatStep: 3,
  readyInHours: 31,
};
const sideDelts: MuscleListRow = {
  muscle: "delt_side",
  heatPercent: 3,
  heatStep: 0,
  readyInHours: 0,
};

function renderRows(rows: MuscleListRow[], onPress = jest.fn<undefined, [string]>()) {
  return render(
    <ThemeProvider fixedPreference="dark">
      <GroupedList hidesTitle title="Legs">
        {rows.map((row) => (
          <MuscleRow
            key={row.muscle}
            row={row}
            onPress={() => {
              onPress(row.muscle);
            }}
          />
        ))}
      </GroupedList>
    </ThemeProvider>,
  );
}

describe("MuscleRow", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/MuscleRow", "components/HeatSwatch"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should be one button named for the muscle, its heat and when it is ready", async () => {
    await renderRows([hamstrings]);

    expect(
      screen.getByRole("button", { name: describeMuscleListRow(hamstrings).accessibleName }),
    ).toBeOnTheScreen();
  });

  it("should write the name, the status line and the percent that core writes", async () => {
    await renderRows([hamstrings]);
    const { name, status, heatText } = describeMuscleListRow(hamstrings);

    expect(screen.getByText(name)).toBeOnTheScreen();
    expect(screen.getByText(status)).toBeOnTheScreen();
    expect(screen.getByText(heatText)).toBeOnTheScreen();
  });

  it("should say ready now for a muscle that is rested", async () => {
    await renderRows([sideDelts]);

    expect(screen.getByText(describeMuscleListRow(sideDelts).status)).toBeOnTheScreen();
  });

  it("should call onPress with the muscle when it is pressed", async () => {
    const onPress = jest.fn<undefined, [string]>();
    await renderRows([sideDelts, hamstrings], onPress);

    await userEvent
      .setup()
      .press(
        screen.getByRole("button", { name: describeMuscleListRow(hamstrings).accessibleName }),
      );

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith("hamstrings");
  });

  it("should colour the 16 point swatch with the colour of its heat step", async () => {
    await renderRows([hamstrings]);

    expect(
      viewsDrawn({ width: 16, height: 16, backgroundColor: resolvedColor("dark", "heat-3") }),
    ).toHaveLength(1);
  });

  it("should colour a rested muscle with the rested step", async () => {
    await renderRows([sideDelts]);

    expect(
      viewsDrawn({ width: 16, height: 16, backgroundColor: resolvedColor("dark", "heat-0") }),
    ).toHaveLength(1);
  });
});
