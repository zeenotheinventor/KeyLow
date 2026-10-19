import { describeHistorySet } from "@keylow/core/copy";
import { themes } from "@keylow/tokens";
import { cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { ExerciseCard } from "../components/ExerciseCard";
import { SetRow } from "../components/SetRow";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { SetRowProps } from "../components/SetRow";
import type { HistorySetInput } from "@keylow/core/copy";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const workingInput: HistorySetInput = {
  setType: "working",
  setNumber: 1,
  loadKg: 70,
  reps: 10,
  rir: 2,
  isNotInPlan: false,
  unit: "kg",
};

function readOnlyRow(
  input: Partial<HistorySetInput> = {},
  onPress?: () => void,
): Extract<SetRowProps, { variant: "readOnly" }> {
  const set = { ...workingInput, ...input };
  return {
    variant: "readOnly",
    setType: set.setType,
    copy: describeHistorySet(set),
    isNotInPlan: set.isNotInPlan,
    onPress,
  };
}

function renderRow(props: SetRowProps) {
  return render(
    <ThemeProvider fixedPreference="dark">
      <SetRow {...props} />
    </ThemeProvider>,
  );
}

describe("a read-only set row", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SetRow", "components/ExerciseCard"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("without a handler", () => {
    it("should be named for the set, with no edit in the name, since it opens nothing", async () => {
      await renderRow(readOnlyRow());

      expect(screen.getByRole("listitem", { name: "Set 1, 70 kg by 10, RIR 2" })).toBeOnTheScreen();
    });

    it("should draw the mark, what was done and the RIR", async () => {
      await renderRow(readOnlyRow());

      expect(screen.getByText("1")).toBeOnTheScreen();
      expect(screen.getByText("70 kg × 10")).toBeOnTheScreen();
      expect(screen.getByText("RIR 2")).toBeOnTheScreen();
    });

    it("should not be a button", async () => {
      await renderRow(readOnlyRow());

      expect(screen.queryByRole("button")).toBeNull();
    });

    it("should say a set is not in the plan on its name", async () => {
      await renderRow(readOnlyRow({ setNumber: 4, isNotInPlan: true }));

      expect(
        screen.getByRole("listitem", { name: "Set 4, 70 kg by 10, RIR 2, not in the plan" }),
      ).toBeOnTheScreen();
    });

    it("should read a set with no load as its reps and one with no RIR as No RIR", async () => {
      await renderRow(readOnlyRow({ loadKg: null, rir: null }));

      expect(screen.getByText("10 reps")).toBeOnTheScreen();
      expect(screen.getByText("No RIR")).toBeOnTheScreen();
    });
  });

  describe("with a handler", () => {
    it("should be a button named for the set and its edit", async () => {
      await renderRow(readOnlyRow({}, jest.fn()));

      expect(
        screen.getByRole("button", { name: "Set 1, 70 kg by 10, RIR 2, edit" }),
      ).toBeOnTheScreen();
    });

    it("should call the handler when it is pressed", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderRow(readOnlyRow({}, onPress));

      await user.press(screen.getByRole("button", { name: "Set 1, 70 kg by 10, RIR 2, edit" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe("how it is drawn", () => {
    it("should tint a set that is not in the plan with the accent fill, and no other", async () => {
      await renderRow(readOnlyRow({ isNotInPlan: true }));
      const notInPlan = screen.getByRole("listitem");
      expect(notInPlan).toHaveStyle({ backgroundColor: themes.dark["accent-muted"] });
      await cleanup();

      await renderRow(readOnlyRow());

      expect(screen.getByRole("listitem")).not.toHaveStyle({
        backgroundColor: themes.dark["accent-muted"],
      });
    });

    it("should draw the warm-up's mark in the warning ink and a working set's in the secondary ink", async () => {
      await renderRow(readOnlyRow({ setType: "warmup", setNumber: 0 }));
      const warmupMark = screen.getByText("W");
      await cleanup();
      await renderRow(readOnlyRow());

      const workingMark = screen.getByText("1");

      expect(warmupMark.props.style).not.toEqual(workingMark.props.style);
    });

    it("should draw the columns as the board does: the mark 32 wide and the RIR 56 wide", async () => {
      await renderRow(readOnlyRow());

      expect(screen.getByText("1")).toHaveStyle({ width: 32 });
      expect(screen.getByText("RIR 2")).toHaveStyle({ width: 56 });
    });

    it("should reserve 24 for the chevron of a row that opens something", async () => {
      await renderRow(readOnlyRow({}, jest.fn()));

      const chevron = screen.root?.queryAll((node) => node.type === "RNSVGSvgView")[0];

      const hasWidth = (node: typeof chevron | null) => {
        try {
          expect(node).toHaveStyle({ width: 24 });

          return true;
        } catch {
          return false;
        }
      };

      expect(
        [chevron?.parent, chevron?.parent?.parent, chevron?.parent?.parent?.parent].some(hasWidth),
      ).toBe(true);
    });

    it("should be 40 high at least with 12 at the sides and 6 between its cells", async () => {
      await renderRow(readOnlyRow());

      expect(screen.getByRole("listitem")).toHaveStyle({
        minHeight: 40,
        paddingLeft: 12,
        paddingRight: 12,
        columnGap: 6,
      });
    });
  });
});

describe("a read-only exercise card", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SetRow", "components/ExerciseCard"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  const row = (setNumber: number, onPress?: () => void) => ({
    key: `set-${setNumber}`,
    ...readOnlyRow({ setNumber }, onPress),
  });

  function renderCard(note: string | null, rows: ReturnType<typeof row>[]) {
    return render(
      <ThemeProvider fixedPreference="dark">
        <ExerciseCard name="Wide-grip lat pulldown" note={note} rows={rows} variant="readOnly" />
      </ThemeProvider>,
    );
  }

  it("should be a region named for the exercise, with its name as a heading", async () => {
    await renderCard(null, [row(1)]);

    // The region and the list hold the rows, so they are not accessibility elements themselves: found by name.
    const region = screen.getByLabelText("Wide-grip lat pulldown");

    expect(region).toHaveProp("role", "region");

    expect(
      within(region).getByRole("heading", { name: "Wide-grip lat pulldown" }),
    ).toBeOnTheScreen();
  });

  it("should list its sets in a list named Sets", async () => {
    await renderCard(null, [row(1), row(2), row(3)]);

    const list = screen.getByLabelText("Sets");

    expect(list).toHaveProp("role", "list");

    expect(within(list).getAllByRole("listitem", { name: /^Set \d/ })).toHaveLength(3);
  });

  it("should draw the note beside the name when there is one", async () => {
    await renderCard("2 more than planned", [row(1)]);

    expect(screen.getByText("2 more than planned")).toBeOnTheScreen();
  });

  it("should draw no note when there is none", async () => {
    await renderCard(null, [row(1)]);

    expect(screen.queryByText(/than planned|Bodyweight/)).toBeNull();
  });

  it("should draw no column headings, since the rows read as sentences", async () => {
    await renderCard(null, [row(1)]);

    expect(screen.queryByText("Previous")).toBeNull();
  });

  it("should pass each row's handler to the row", async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    await renderCard(null, [row(1), row(2, onPress)]);

    await user.press(screen.getByRole("button", { name: "Set 2, 70 kg by 10, RIR 2, edit" }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
