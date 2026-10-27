import { cleanup, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { WeeklySetsBar } from "../../components/WeeklySetsBar";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { WeeklySetsBarProps } from "../../components/WeeklySetsBar";
import type { VolumeStatus } from "@keylow/core/training";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const bands = { growingFromSets: 4, productiveFromSets: 10, highAboveSets: 20 };
const labels = { start: "0", growing: "4", productive: "10", high: "20" };
const name =
  "5.5 sets done, Growing, 11 planned. Growing from 4 sets, Productive from 10, High above 20";
const weeklySets: WeeklySetsBarProps["weeklySets"] = {
  actual: 5.5,
  planned: 11,
  bands,
  actualStatus: "growing",
  plannedStatus: "productive",
  volumeStatus: "growing",
};

async function renderBar(props: Partial<WeeklySetsBarProps> = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <WeeklySetsBar labels={labels} name={name} weeklySets={weeklySets} {...props} />
    </ThemeProvider>,
  );
}

type Style = Record<string, unknown>;

// A style can be one object or a list of them, and NativeWind resolves a class to either.
function flatStyle(style: unknown): Style {
  const flat: unknown = StyleSheet.flatten(style);
  return typeof flat === "object" && flat !== null ? Object.fromEntries(Object.entries(flat)) : {};
}

// The marks are decoration inside one image that the name already describes, so they have no role to query
// by. Each is found by the size its class gives it, and read as NativeWind resolved the variable it points at.
function stylesInBar(forName = name): Style[] {
  return screen
    .getByRole("img", { name: forName })
    .queryAll((node) => typeof node.type === "string")
    .map((node) => flatStyle(node.props.style));
}

// The ticks of the bands are 1 point wide and the planned tick is 2, and the fill is the 10 point bar from the left.
function markNamed(mark: "done fill" | "planned tick"): Style {
  const found = stylesInBar().find((style) => {
    switch (mark) {
      case "done fill":
        return style.height === 10 && style.left === 0 && style.width !== undefined;
      case "planned tick":
        return style.height === 18 && style.width === 2;
    }
  });
  if (found === undefined) {
    throw new Error(`The bar has no ${mark}`);
  }
  return found;
}

/** The left share of each band tick, in the order Growing, Productive, High. */
function bandTickLefts(): number[] {
  return stylesInBar()
    .filter((style) => style.height === 18 && style.width === 1)
    .map((style) => percentOf(style.left));
}

// A share of the track as the class wrote it, such as "25%".
const percentOf = (value: unknown): number => Number.parseFloat(String(value));

// A label sits in a view of its own that the bar positions, found from the label's words.
const labelBox = (text: string) => flatStyle(screen.getByText(text).parent?.props.style);

describe("the weekly sets bar", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/WeeklySetsBar"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should be one image named by the sets, the band, the plan and where each band starts", async () => {
    await renderBar();

    expect(screen.getByRole("img", { name })).toBeOnTheScreen();
  });

  it("should label the start and the edge of each band", async () => {
    await renderBar();

    for (const label of Object.values(labels)) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
  });

  it("should not label the planned figure or draw a target band, as the earlier bar did", async () => {
    await renderBar();

    expect(screen.queryByText(/Planned|Min|Max/)).not.toBeOnTheScreen();
    expect(
      stylesInBar().filter((style) => style.height === 10 && style.borderLeftWidth === 1),
    ).toEqual([]);
  });

  describe("the marks", () => {
    it("should fill the track to the share of 24 sets that is done", async () => {
      await renderBar({ weeklySets: { ...weeklySets, actual: 6 } });

      expect(markNamed("done fill").width).toBe("25%");
    });

    it("should put the planned tick at the share of 24 sets that is planned", async () => {
      await renderBar({ weeklySets: { ...weeklySets, planned: 12 } });

      expect(markNamed("planned tick").left).toBe("50%");
    });

    it("should put a tick at 4, 10 and 20 sets of the 24", async () => {
      await renderBar();

      const [growing, productive, high] = bandTickLefts();
      expect(growing).toBeCloseTo((4 / 24) * 100, 5);
      expect(productive).toBeCloseTo((10 / 24) * 100, 5);
      expect(high).toBeCloseTo((20 / 24) * 100, 5);
    });

    it("should hold a figure past 24 sets at the end of the track", async () => {
      await renderBar({ weeklySets: { ...weeklySets, actual: 30, planned: 30 } });

      expect(markNamed("done fill").width).toBe("100%");
      expect(markNamed("planned tick").left).toBe("100%");
    });
  });

  describe("the colour of the fill", () => {
    it.each([
      ["not_trained", "volume-not-trained"],
      ["maintaining", "volume-maintaining"],
      ["growing", "volume-growing"],
      ["productive", "volume-productive"],
      ["high", "volume-high"],
    ] as const satisfies readonly (readonly [VolumeStatus, string])[])(
      "should be the %s colour of the volume scale",
      async (volumeStatus, token) => {
        await renderBar({ weeklySets: { ...weeklySets, volumeStatus } });

        expect(markNamed("done fill").backgroundColor).toBe(resolvedColor("dark", token));
      },
    );

    it("should follow the status of the plan in the Projected view, whatever is done", async () => {
      // In Projected the detail's status is the planned figure's: 11 planned is productive though 5.5 is done.
      await renderBar({ weeklySets: { ...weeklySets, volumeStatus: "productive" } });

      expect(markNamed("done fill").width).toBe(`${(5.5 / 24) * 100}%`);
      expect(markNamed("done fill").backgroundColor).toBe(
        resolvedColor("dark", "volume-productive"),
      );
    });
  });

  describe("the labels", () => {
    it("should centre each band number on its tick, on the row under the bar", async () => {
      await renderBar();

      expect(percentOf(labelBox("4").left)).toBeCloseTo((4 / 24) * 100, 5);
      expect(percentOf(labelBox("10").left)).toBeCloseTo((10 / 24) * 100, 5);
      expect(percentOf(labelBox("20").left)).toBeCloseTo((20 / 24) * 100, 5);
      expect(labelBox("4")).toMatchObject({ top: 20, marginLeft: -36 });
    });

    it("should hang the 0 from the left", async () => {
      await renderBar();

      expect(labelBox("0")).toMatchObject({ left: 0, top: 20 });
    });

    it("should keep the bar one row high, at 34 points", async () => {
      await renderBar();

      expect(flatStyle(screen.getByRole("img", { name }).props.style).height).toBe(34);
    });
  });
});
