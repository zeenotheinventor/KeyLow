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

const target = { mev: 6, mav: { low: 10, high: 16 }, mrv: 22 };
const labels = { start: "0", minimum: "Min 6", planned: "Planned 11", maximum: "Max 22" };
const name = "5.5 sets done, 11 planned, target 10 to 16, minimum 6, maximum 22";
const weeklySets: WeeklySetsBarProps["weeklySets"] = {
  actual: 5.5,
  planned: 11,
  target,
  actualPosition: "below",
  plannedPosition: "inside",
  volumeStatus: "under",
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

function markNamed(
  mark: "done fill" | "band" | "minimum tick" | "planned tick",
  forName = name,
): Style {
  const found = stylesInBar(forName).find((style) => {
    switch (mark) {
      case "done fill":
        return style.height === 10 && style.left === 0 && style.width !== undefined;
      case "band":
        return style.height === 10 && style.borderLeftWidth === 1;
      case "minimum tick":
        return style.height === 18 && style.width === 1;
      case "planned tick":
        return style.height === 18 && style.width === 2;
    }
  });
  if (found === undefined) {
    throw new Error(`The bar has no ${mark}`);
  }
  return found;
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

  it("should be one image named by the sets, the target and the limits", async () => {
    await renderBar();

    expect(screen.getByRole("img", { name })).toBeOnTheScreen();
  });

  it("should label the start, the minimum, the planned figure and the maximum", async () => {
    await renderBar();

    for (const label of Object.values(labels)) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
  });

  describe("the marks", () => {
    it("should fill the track to the share of the maximum that is done", async () => {
      await renderBar();

      expect(markNamed("done fill").width).toBe("25%");
    });

    it("should put the planned tick at the share of the maximum that is planned", async () => {
      await renderBar();

      expect(markNamed("planned tick").left).toBe("50%");
    });

    it("should put the minimum tick at the share of the maximum that is the minimum", async () => {
      await renderBar();

      expect(percentOf(markNamed("minimum tick").left)).toBeCloseTo((6 / 22) * 100, 5);
    });

    it("should lay the target band from the start of the range to its end", async () => {
      await renderBar();

      const band = markNamed("band");
      expect(percentOf(band.left)).toBeCloseTo((10 / 22) * 100, 5);
      expect(percentOf(band.width)).toBeCloseTo((6 / 22) * 100, 5);
    });

    it("should keep each mark on its own number when the figures differ", async () => {
      await renderBar({ weeklySets: { ...weeklySets, actual: 11, planned: 16.5 } });

      expect(markNamed("done fill").width).toBe("50%");
      expect(markNamed("planned tick").left).toBe("75%");
    });
  });

  describe("the colour of the fill", () => {
    it.each([
      ["under", "volume-under"],
      ["maintaining", "volume-maintaining"],
      ["productive", "volume-productive"],
      ["over", "volume-over"],
      ["not_targeted", "volume-not-targeted"],
    ] as const satisfies readonly (readonly [VolumeStatus, string])[])(
      "should be the %s colour of the volume scale",
      async (volumeStatus, token) => {
        await renderBar({ weeklySets: { ...weeklySets, volumeStatus } });

        expect(markNamed("done fill").backgroundColor).toBe(resolvedColor("dark", token));
      },
    );

    it("should follow the status of the plan in the Projected view, whatever is done", async () => {
      // In Projected the detail's status is the planned figure's: 12 planned is productive though 5.5 is done.
      await renderBar({ weeklySets: { ...weeklySets, planned: 12, volumeStatus: "productive" } });

      expect(markNamed("done fill").width).toBe("25%");
      expect(markNamed("done fill").backgroundColor).toBe(
        resolvedColor("dark", "volume-productive"),
      );
    });
  });

  describe("the labels", () => {
    it("should centre the minimum and the planned label on their marks, on the row under the bar", async () => {
      await renderBar();

      expect(percentOf(labelBox("Min 6").left)).toBeCloseTo((6 / 22) * 100, 5);
      expect(labelBox("Min 6").top).toBe(20);
      expect(labelBox("Planned 11")).toMatchObject({ left: "50%", top: 20, marginLeft: -36 });
    });

    it("should hang the start from the left and the maximum from the right", async () => {
      await renderBar();

      expect(labelBox("0")).toMatchObject({ left: 0, top: 20 });
      expect(labelBox("Max 22")).toMatchObject({ right: 0, top: 20 });
    });

    describe("planned 0", () => {
      const planned = { ...weeklySets, planned: 0 };
      const plannedLabels = { ...labels, planned: "Planned 0" };

      it("should hang the planned label from the left, on a row of its own under the 0", async () => {
        await renderBar({ weeklySets: planned, labels: plannedLabels });

        expect(labelBox("Planned 0")).toMatchObject({ left: 0, top: 36 });
        expect(labelBox("0")).toMatchObject({ top: 20 });
      });

      it("should make room for the second row", async () => {
        await renderBar({ weeklySets: planned, labels: plannedLabels });

        expect(flatStyle(screen.getByRole("img", { name }).props.style).height).toBe(50);
      });
    });

    describe("planned 7 against a minimum of 6", () => {
      it("should put the planned label on a row of its own, centred on its mark", async () => {
        await renderBar({
          weeklySets: { ...weeklySets, planned: 7 },
          labels: { ...labels, planned: "Planned 7" },
        });

        expect(percentOf(labelBox("Planned 7").left)).toBeCloseTo((7 / 22) * 100, 5);
        expect(labelBox("Planned 7").top).toBe(36);
        expect(labelBox("Min 6")).toMatchObject({ top: 20 });
      });
    });

    describe("planned 22 against a maximum of 22", () => {
      it("should hang the planned label from the right, on a row of its own under the Max", async () => {
        await renderBar({
          weeklySets: { ...weeklySets, planned: 22 },
          labels: { ...labels, planned: "Planned 22" },
        });

        expect(labelBox("Planned 22")).toMatchObject({ right: 0, top: 36 });
        expect(labelBox("Max 22")).toMatchObject({ right: 0, top: 20 });
      });
    });

    describe("planned 19 against a maximum of 22", () => {
      it("should put the planned label on a row of its own, because it would meet the Max label", async () => {
        await renderBar({
          weeklySets: { ...weeklySets, planned: 19 },
          labels: { ...labels, planned: "Planned 19" },
        });

        expect(labelBox("Planned 19").top).toBe(36);
        expect(labelBox("Max 22")).toMatchObject({ right: 0, top: 20 });
      });
    });

    it("should keep the bar's height when the planned label shares the row", async () => {
      await renderBar();

      expect(flatStyle(screen.getByRole("img", { name }).props.style).height).toBe(34);
    });
  });
});
