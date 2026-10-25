import { BODY_MAP } from "@keylow/core/copy";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { BodyMapCard } from "../../components/BodyMapCard";
import { BodyMapLegend } from "../../components/BodyMapLegend";
import { BodyView } from "../../components/BodyView";
import { resetBody3DSupportForTests } from "../../components/BodyView/testing";
import { currentBodyMapRendererStore } from "../../lib/bodyMapRenderer/currentBodyMapRendererStore";
import { resetBodyMapRendererForTests } from "../../lib/bodyMapRenderer/testing";
import { ThemeProvider } from "../../lib/theme";
import { fillsIn, heatFill } from "../support/figureFills";
import { dragFigures, tapFigures } from "../support/figuresResponder";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { BodyMapCardProps } from "../../components/BodyMapCard";
import type { Body3DProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";
import type { ReactElement } from "react";

setUpTests();

const mockStorageItems = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null),
    setItem: (key: string, value: string) => {
      mockStorageItems.set(key, value);
      return Promise.resolve();
    },
  },
}));

const mockHasGlModule = jest.fn(() => true);
jest.mock("expo", () => {
  const actual = jest.requireActual<typeof import("expo")>("expo");
  return {
    ...actual,
    requireOptionalNativeModule: (name: string): unknown =>
      name === "ExpoGL" && !mockHasGlModule() ? null : actual.requireOptionalNativeModule(name),
  };
});

// GL does not run in Jest. The stand-in is one image with the label it is given, and the tests read the
// props it was drawn with and call the ones the card listens to.
const mockBody3D = jest.fn<undefined, [Body3DProps]>();
// The scheme the 3D body was drawn in, which it takes its palette and lighting from.
const mockBody3DScheme = jest.fn<undefined, [string]>();
jest.mock("../../components/ui/Body3D", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const { useTheme: useSchemeOfTheme } =
    jest.requireActual<typeof import("../../lib/theme")>("../../lib/theme");
  return {
    Body3D: (props: Body3DProps) => {
      mockBody3D(props);
      mockBody3DScheme(useSchemeOfTheme().scheme);
      return createElement(View, { accessible: true, "aria-label": props.label, role: "img" });
    },
  };
});

const lastBody3DProps = (): Body3DProps => {
  const props = mockBody3D.mock.calls.at(-1)?.[0];
  if (props === undefined) {
    throw new Error("The 3D body has not been drawn.");
  }
  return props;
};

async function callBody3D(call: (props: Body3DProps) => void) {
  const props = lastBody3DProps();
  await act(() => {
    call(props);
  });
}

const drawFirstFrame = () =>
  callBody3D((props) => {
    props.onFirstFrame?.();
  });

const cardProps: BodyMapCardProps = {
  scale: "heat",
  view: "actual",
  actualValues: { quads: 3, lats: 2 },
  projectedValues: { quads: 1, lats: 5 },
  viewLabel: "Actual",
  subLine: "Now · Thu 15 Oct, 19:00",
  toggleLabel: "Show projected",
  isToggleEnabled: true,
  onToggle: () => undefined,
  note: null,
};

function inTheme(element: ReactElement, scheme: ThemeScheme = "dark") {
  return <ThemeProvider fixedPreference={scheme}>{element}</ThemeProvider>;
}

async function renderCard(props: Partial<BodyMapCardProps> = {}, scheme: ThemeScheme = "dark") {
  const rendered = await render(inTheme(<BodyMapCard {...cardProps} {...props} />, scheme));
  // The stored preference is read a moment after the first render.
  await act(async () => {
    await Promise.resolve();
  });
  return rendered;
}

function styleValue(node: { props: object }, name: string): unknown {
  const style: unknown = Object.getOwnPropertyDescriptor(node.props, "style")?.value;
  return typeof style === "object" && style !== null
    ? Object.getOwnPropertyDescriptor(style, name)?.value
    : undefined;
}

const frontLabel = "Body map, Actual, heat, front";
// What a screen reader meets while the 3D body loads, as the loading board names it.
const loadingFrontLabel = "Body map, Actual, heat, front. 3D is loading.";
const loadingBackLabel = "Body map, Actual, heat, back. 3D is loading.";
const backLabel = "Body map, Actual, heat, back";
const frontButton = () => screen.getByRole("radio", { name: BODY_MAP.sideSwitch.front });
const backButton = () => screen.getByRole("radio", { name: BODY_MAP.sideSwitch.back });

describe("the body map card in 3D", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyMapCard",
      "components/BodyMapFigures",
      "components/BodyView",
      "components/BodyMapLegend",
      "components/HeatSwatch",
      "components/ViewLabel",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockStorageItems.clear();
    mockStorageItems.set("bodyMap.renderer", "3d");
    resetBodyMapRendererForTests();
    resetBody3DSupportForTests();
    mockHasGlModule.mockReturnValue(true);
    mockBody3D.mockClear();
    mockBody3DScheme.mockClear();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("what it draws", () => {
    it("should draw one body, which a screen reader finds as one image named for the side shown", async () => {
      await renderCard();

      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(screen.getByRole("img", { name: loadingFrontLabel })).toBeOnTheScreen();

      await drawFirstFrame();

      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(screen.getByRole("img", { name: frontLabel })).toBeOnTheScreen();
    });

    it("should say to drag and to pinch, and say no more than the gestures that exist", async () => {
      await renderCard();

      expect(screen.getByText("Drag to turn · Pinch to zoom")).toBeOnTheScreen();
      expect(screen.queryByText(/long-press/i)).not.toBeOnTheScreen();
    });

    it("should keep the view label and its sub-line, as in 2D", async () => {
      await renderCard();

      expect(screen.getByRole("status", { name: "Actual" })).toBeOnTheScreen();
      expect(screen.getByText("Now · Thu 15 Oct, 19:00")).toBeOnTheScreen();
    });

    it("should keep the toggle button and the note, as in 2D", async () => {
      await renderCard({ note: "Projected needs a routine." });

      expect(screen.getByRole("button", { name: "Show projected" })).toBeOnTheScreen();
      expect(screen.getByText("Projected needs a routine.")).toBeOnTheScreen();
    });

    it("should draw no toggle button for a card with no toggle label", async () => {
      await renderCard({ toggleLabel: null });

      expect(
        screen.queryByRole("button", { name: /^show (projected|actual)$/i }),
      ).not.toBeOnTheScreen();
      expect(frontButton()).toBeOnTheScreen();
    });

    it("should draw the body for the width of the board, not the width of the 2D figures", async () => {
      await renderCard();

      expect(lastBody3DProps().w).toBe(108);
    });
  });

  describe("the loading state", () => {
    it("should say that 3D is loading, as a status, over the 2D figure", async () => {
      await renderCard();

      expect(screen.getByRole("status", { name: BODY_MAP.loading3d })).toBeOnTheScreen();
    });

    it("should stop saying it once the 3D body has drawn", async () => {
      await renderCard();

      await drawFirstFrame();

      expect(screen.queryByText(BODY_MAP.loading3d)).not.toBeOnTheScreen();
    });

    it("should stop saying it, and keep the 2D figure, when 3D fails", async () => {
      await renderCard();

      await callBody3D((props) => {
        props.onError?.();
      });

      expect(screen.queryByText(BODY_MAP.loading3d)).not.toBeOnTheScreen();
      expect(screen.getByRole("img", { name: frontLabel })).toBeOnTheScreen();
    });

    it("should say nothing about 3D in 2D", async () => {
      mockStorageItems.set("bodyMap.renderer", "2d");

      await renderCard();

      expect(screen.queryByText(BODY_MAP.loading3d)).not.toBeOnTheScreen();
    });
  });

  describe("the name of the figure while 3D loads", () => {
    it("should say that 3D is loading, as the loading board does", async () => {
      await renderCard();

      expect(screen.getByRole("img", { name: loadingFrontLabel })).toBeOnTheScreen();
    });

    it("should be the plain name once the 3D body has drawn", async () => {
      await renderCard();

      await drawFirstFrame();

      expect(screen.getByRole("img", { name: frontLabel })).toBeOnTheScreen();
      expect(lastBody3DProps().label).toBe(frontLabel);
    });

    it("should be the plain name once 3D has failed", async () => {
      await renderCard();

      await callBody3D((props) => {
        props.onError?.();
      });

      expect(screen.getByRole("img", { name: frontLabel })).toBeOnTheScreen();
    });
  });

  describe("the dark stage", () => {
    // The backdrop is the one view as wide as the stage and as high as it, which has the dark background once the body has drawn.
    const backdropsOfTheStage = () =>
      screen.root?.queryAll(
        (node) => styleValue(node, "height") === 240 && styleValue(node, "width") === "100%",
      ) ?? [];

    it.each<ThemeScheme>(["dark", "light"])(
      "should be drawn in the dark theme's background in the %s theme",
      async (scheme) => {
        await renderCard({}, scheme);
        await drawFirstFrame();

        const [backdrop, ...others] = backdropsOfTheStage();
        expect(others).toHaveLength(0);
        expect(backdrop).toHaveStyle({ backgroundColor: resolvedColor("dark", "background") });
      },
    );

    it("should be clear while the 3D body loads, so the 2D figure sits on the card", async () => {
      await renderCard({}, "light");

      const [backdrop] = backdropsOfTheStage();
      const layer = backdrop?.parent;
      expect(layer && getAnimatedStyle(layer).opacity).toBe(0);
    });
  });

  describe("the theme of the stage", () => {
    // The 3D layer of the stage (the backdrop and the 3D body) is dark in both themes. The 2D figure keeps the app's theme.
    function backgroundsIn(element: ReturnType<typeof screen.getByLabelText>): unknown[] {
      return element.queryAll(() => true).map((node) => styleValue(node, "backgroundColor"));
    }

    async function renderCardAndLegend(scheme: ThemeScheme) {
      await render(
        inTheme(
          <>
            <BodyMapCard {...cardProps} />
            <BodyMapLegend scale="heat" />
          </>,
          scheme,
        ),
      );
      await act(async () => {
        await Promise.resolve();
      });
    }

    it.each<ThemeScheme>(["light", "dark"])(
      "should draw the 3D body in the dark theme when the app is in the %s theme",
      async (scheme) => {
        await renderCard({}, scheme);

        expect(mockBody3DScheme).toHaveBeenCalled();
        expect(mockBody3DScheme.mock.calls.every(([drawnIn]) => drawnIn === "dark")).toBe(true);
      },
    );

    it("should draw the 2D figure that shows while 3D loads in the app's light theme, since it sits on the clear stage", async () => {
      await renderCard({}, "light");

      const fills = fillsIn(screen.getByRole("img", { name: loadingFrontLabel }), "front");

      expect(fills.get("quads")).toEqual(heatFill("light", 3));
      expect(fills.get("quads")).not.toEqual(heatFill("dark", 3));
    });

    it("should keep the 2D figure in the app's light theme after 3D fails", async () => {
      await renderCard({}, "light");
      await callBody3D((props) => {
        props.onError?.();
      });

      const fills = fillsIn(screen.getByRole("img", { name: frontLabel }), "front");

      expect(fills.get("quads")).toEqual(heatFill("light", 3));
    });

    it("should draw the 2D figure in the dark theme when the app is dark", async () => {
      await renderCard({}, "dark");

      const fills = fillsIn(screen.getByRole("img", { name: loadingFrontLabel }), "front");

      expect(fills.get("quads")).toEqual(heatFill("dark", 3));
    });

    it("should keep the light theme for the legend beside the card", async () => {
      await renderCardAndLegend("light");

      const swatches = backgroundsIn(screen.getByLabelText(BODY_MAP.legendNames.heat));

      expect(swatches).toContain(resolvedColor("light", "heat-1"));
      expect(swatches).not.toContain(resolvedColor("dark", "heat-1"));
    });

    it("should keep the app's theme for the 2D layout", async () => {
      mockStorageItems.set("bodyMap.renderer", "2d");
      await renderCard({}, "light");

      const fills = fillsIn(screen.getAllByRole("img")[0] ?? screen.getByRole("img"), "front");

      expect(fills.get("quads")).toEqual(heatFill("light", 3));
    });
  });

  describe("a tap on the 2D figure in the stage", () => {
    it("should toggle while the 3D body loads", async () => {
      const onToggle = jest.fn();
      await renderCard({ onToggle });

      tapFigures();

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("should toggle after 3D fails", async () => {
      const onToggle = jest.fn();
      await renderCard({ onToggle });
      await callBody3D((props) => {
        props.onError?.();
      });

      tapFigures();

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("should not toggle for a drag", async () => {
      const onToggle = jest.fn();
      await renderCard({ onToggle });

      dragFigures(40, 0);

      expect(onToggle).not.toHaveBeenCalled();
    });

    it("should do nothing when Projected is off", async () => {
      const onToggle = jest.fn();
      await renderCard({ onToggle, isToggleEnabled: false });

      tapFigures();

      expect(onToggle).not.toHaveBeenCalled();
    });

    it("should leave the touch to the 3D body once it has drawn, so a 3D tap cannot toggle twice", async () => {
      await renderCard();
      await drawFirstFrame();

      expect(() => {
        tapFigures();
      }).toThrow("Nothing around the figures takes touches");
    });
  });

  describe("Front and Back", () => {
    it("should be a group named Side shown with Front chosen, found by role", async () => {
      await renderCard();

      expect(screen.getByLabelText(BODY_MAP.sideSwitch.name)).toBeOnTheScreen();
      expect(frontButton()).toBeChecked();
      expect(backButton()).not.toBeChecked();
    });

    it("should say what it does, for a screen reader", async () => {
      await renderCard();

      expect(screen.getByLabelText(BODY_MAP.sideSwitch.name)).toHaveProp(
        "accessibilityHint",
        BODY_MAP.sideSwitchDescription,
      );
    });

    it("should face the body to the front until it is told otherwise", async () => {
      await renderCard();

      expect(lastBody3DProps().side).toBe("front");
    });

    it("should turn the body to the back when Back is pressed", async () => {
      await renderCard();

      await userEvent.press(backButton());

      expect(lastBody3DProps().side).toBe("back");
      expect(backButton()).toBeChecked();
      expect(screen.getByRole("img", { name: loadingBackLabel })).toBeOnTheScreen();
    });

    it("should turn the body to the front again when Front is pressed", async () => {
      await renderCard();
      await userEvent.press(backButton());

      await userEvent.press(frontButton());

      expect(lastBody3DProps().side).toBe("front");
    });

    it("should move to Back when a drag settles the body on the back", async () => {
      await renderCard();

      await callBody3D((props) => {
        props.onSideChange?.("back");
      });

      expect(backButton()).toBeChecked();
      expect(frontButton()).not.toBeChecked();
      expect(lastBody3DProps().side).toBe("back");
    });
  });

  describe("tapping the body", () => {
    it("should call the toggle", async () => {
      const onToggle = jest.fn();
      await renderCard({ onToggle });

      await callBody3D((props) => {
        props.onTap?.();
      });

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("should do nothing when the toggle is off, as when Projected is off", async () => {
      const onToggle = jest.fn();
      await renderCard({ onToggle, isToggleEnabled: false });

      expect(lastBody3DProps().onTap).toBeUndefined();
      expect(screen.getByRole("button", { name: "Show projected" })).toBeDisabled();
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("should still toggle with the button, so nothing depends on a gesture", async () => {
      const onToggle = jest.fn();
      await renderCard({ onToggle });

      await userEvent.press(screen.getByRole("button", { name: "Show projected" }));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe("what the body is told", () => {
    it("should be given the values of the view shown, on the scale, with nothing selected", async () => {
      await renderCard({ scale: "volume", actualValues: { quads: 2 } });

      expect(lastBody3DProps()).toMatchObject({ scale: "volume", values: { quads: 2 } });
      expect(lastBody3DProps().selected).toBeUndefined();
    });

    it("should be given the values of Projected when Projected is shown", async () => {
      await renderCard({ view: "projected" });

      expect(lastBody3DProps().values).toEqual({ quads: 1, lats: 5 });
    });

    it("should be given the muscle whose sheet is open, and dim the others", async () => {
      await renderCard({ selected: "lats" });

      expect(lastBody3DProps()).toMatchObject({ selected: "lats", unselectedOpacity: 0.4 });
    });

    it("should be told the new values when the view is toggled, for it to ease to them", async () => {
      const { rerender } = await renderCard();

      await rerender(inTheme(<BodyMapCard {...cardProps} view="projected" />));

      expect(lastBody3DProps().values).toEqual({ quads: 1, lats: 5 });
    });
  });

  describe("when the 3D body cannot be drawn", () => {
    it("should keep the layout, with the 2D figure of the same side in it", async () => {
      await renderCard();
      await userEvent.press(backButton());

      await callBody3D((props) => {
        props.onError?.();
      });

      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(screen.getByRole("img", { name: backLabel })).toBeOnTheScreen();
      expect(screen.getByText("Drag to turn · Pinch to zoom")).toBeOnTheScreen();
      expect(backButton()).toBeChecked();
    });

    it("should keep turning the 2D figure with Front and Back", async () => {
      await renderCard();
      await callBody3D((props) => {
        props.onError?.();
      });

      await userEvent.press(backButton());

      expect(screen.getByRole("img", { name: backLabel })).toBeOnTheScreen();
    });

    it("should say nothing about loading when the setting goes to 2D and back to 3D after a failure", async () => {
      await renderCard();
      await callBody3D((props) => {
        props.onError?.();
      });
      await act(() => {
        currentBodyMapRendererStore.store.setRenderer("2d");
      });
      expect(screen.queryByText("Drag to turn · Pinch to zoom")).not.toBeOnTheScreen();

      await act(() => {
        currentBodyMapRendererStore.store.setRenderer("3d");
      });

      expect(screen.getByText("Drag to turn · Pinch to zoom")).toBeOnTheScreen();
      expect(screen.queryByText(BODY_MAP.loading3d)).not.toBeOnTheScreen();
      expect(screen.getByRole("img", { name: frontLabel })).toBeOnTheScreen();
    });

    it("should draw the 2D layout the next time, for the rest of the run", async () => {
      const first = await renderCard();
      await callBody3D((props) => {
        props.onError?.();
      });
      await first.unmount();

      await renderCard();

      expect(screen.queryByText("Drag to turn · Pinch to zoom")).not.toBeOnTheScreen();
      expect(screen.queryByRole("radio")).not.toBeOnTheScreen();
      expect(screen.getAllByRole("img")).toHaveLength(2);
    });
  });

  describe("when the 2D layout is the one to draw", () => {
    it("should draw the female figure in the 2D layout", async () => {
      await renderCard({ body: "female" });

      expect(screen.queryByText("Drag to turn · Pinch to zoom")).not.toBeOnTheScreen();
      expect(screen.queryByRole("radio")).not.toBeOnTheScreen();
      expect(screen.getAllByRole("img")).toHaveLength(2);
      expect(mockBody3D).not.toHaveBeenCalled();
    });

    it("should draw the 2D layout in a build without the GL module", async () => {
      mockHasGlModule.mockReturnValue(false);

      await renderCard();

      expect(screen.queryByText("Drag to turn · Pinch to zoom")).not.toBeOnTheScreen();
      expect(screen.getAllByRole("img")).toHaveLength(2);
      expect(mockBody3D).not.toHaveBeenCalled();
    });

    it("should keep the side by side figures in 2D, so the toggle never dead-ends", async () => {
      await renderCard({
        sideBySide: {
          side: "front",
          actualCaption: "Now",
          projectedCaption: "Sat 17 Oct",
        },
        toggleLabel: null,
      });

      expect(screen.queryByText("Drag to turn · Pinch to zoom")).not.toBeOnTheScreen();
      expect(screen.getAllByRole("img")).toHaveLength(2);
      expect(mockBody3D).not.toHaveBeenCalled();
    });

    it("should return to the 2D layout when the setting is changed back to 2D, with no reload", async () => {
      await renderCard();
      expect(screen.getByText("Drag to turn · Pinch to zoom")).toBeOnTheScreen();

      await act(() => {
        currentBodyMapRendererStore.store.setRenderer("2d");
      });

      expect(screen.queryByText("Drag to turn · Pinch to zoom")).not.toBeOnTheScreen();
      expect(screen.queryByRole("radio")).not.toBeOnTheScreen();
      expect(screen.getAllByRole("img")).toHaveLength(2);
    });

    it("should change to the 3D layout when the setting is changed to 3D, with no reload", async () => {
      mockStorageItems.set("bodyMap.renderer", "2d");
      await renderCard();
      expect(screen.queryByText("Drag to turn · Pinch to zoom")).not.toBeOnTheScreen();

      await act(() => {
        currentBodyMapRendererStore.store.setRenderer("3d");
      });

      expect(screen.getByText("Drag to turn · Pinch to zoom")).toBeOnTheScreen();
    });
  });
});

describe("BodyView in 3D", () => {
  beforeEach(() => {
    mockStorageItems.clear();
    mockStorageItems.set("bodyMap.renderer", "3d");
    resetBodyMapRendererForTests();
    resetBody3DSupportForTests();
    mockHasGlModule.mockReturnValue(true);
    mockBody3D.mockClear();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should forward the value props, the side and the two calls to the 3D body", async () => {
    const onSideChange = jest.fn();
    const onTap = jest.fn();
    await render(
      inTheme(
        <BodyView
          dim={0.5}
          label="Body map"
          scale="gap"
          selected="biceps"
          side="back"
          unselectedOpacity={0.3}
          values={{ biceps: 2 }}
          w={108}
          onSideChange={onSideChange}
          onTap={onTap}
        />,
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(lastBody3DProps()).toMatchObject({
      dim: 0.5,
      label: "Body map",
      scale: "gap",
      selected: "biceps",
      side: "back",
      unselectedOpacity: 0.3,
      values: { biceps: 2 },
      w: 108,
      onSideChange,
      onTap,
    });
  });

  it("should hand the 3D body the defaults of the 2D figure when it is given none", async () => {
    await render(
      inTheme(<BodyView label="Body map" scale="heat" side="front" values={{}} w={108} />),
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(lastBody3DProps()).toMatchObject({ dim: 1, unselectedOpacity: 1 });
  });
});
