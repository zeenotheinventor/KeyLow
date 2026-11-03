import { WIDGET_STATES, describeTodayEyebrow } from "@keylow/core/copy";
import { SIGNED_OUT_SOURCE } from "@keylow/core/widgets";

import { createInMemoryWidgetBridge } from "./inMemoryWidgetBridge";
import { WIDGET_PROVIDERS } from "./widgetProviders";
import { createWidgetTaskHandler } from "./widgetTaskHandler";
import { NOW } from "../../test/support/widgetFixtures";
import { populatedSnapshot } from "../../widgets/android/test/viewModels";
import { treeOf, textsOf } from "../../widgets/android/test/widgetTree";

import type {
  WidgetInfo,
  WidgetTaskHandlerProps,
  WidgetRepresentation,
} from "react-native-android-widget";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {},
}));

const widgetInfo = (widgetName: string): WidgetInfo => ({
  widgetName,
  widgetId: 7,
  width: 364,
  height: 170,
  screenInfo: {
    screenHeightDp: 800,
    screenWidthDp: 400,
    density: 2.5,
    densityDpi: 400,
    fontScale: 1,
  },
});

function setUp() {
  const bridge = createInMemoryWidgetBridge();
  const handler = createWidgetTaskHandler({ bridge, now: () => NOW });
  const drawings: WidgetRepresentation[] = [];
  const run = (
    widgetName: string,
    widgetAction: WidgetTaskHandlerProps["widgetAction"],
    extra: Partial<WidgetTaskHandlerProps> = {},
  ) =>
    handler({
      widgetInfo: widgetInfo(widgetName),
      widgetAction,
      renderWidget: (drawing) => {
        drawings.push(drawing);
      },
      ...extra,
    });

  return { bridge, handler, drawings, run };
}

const lightTextsOf = (drawing: WidgetRepresentation | undefined): string[] => {
  if (drawing === undefined || !("light" in drawing)) {
    throw new Error("Expected a light and dark drawing");
  }

  return textsOf(treeOf(drawing.light));
};

describe("the widget task handler", () => {
  it.each(["WIDGET_ADDED", "WIDGET_UPDATE", "WIDGET_RESIZED"] as const)(
    "should draw the stored snapshot on %s, built for the time it runs",
    async (widgetAction) => {
      const { bridge, drawings, run } = setUp();
      await bridge.writeSnapshot(populatedSnapshot());

      await run("TodayMacros", widgetAction);

      expect(drawings).toHaveLength(1);
      expect(lightTextsOf(drawings[0])).toContain(describeTodayEyebrow("2026-11-03"));
    },
  );

  it.each(WIDGET_PROVIDERS)("should draw $name", async ({ name }) => {
    const { bridge, drawings, run } = setUp();
    await bridge.writeSnapshot(populatedSnapshot());

    await run(name, "WIDGET_UPDATE");

    expect(drawings).toHaveLength(1);
  });

  it("should draw the no data state when nothing is stored", async () => {
    const { drawings, run } = setUp();

    await run("TodayRing", "WIDGET_ADDED");

    expect(lightTextsOf(drawings[0])).toContain(WIDGET_STATES.noData.headline);
  });

  it("should draw the signed out state when the bridge reads it", async () => {
    const { bridge, drawings, run } = setUp();
    jest.spyOn(bridge, "readSnapshot").mockResolvedValue(SIGNED_OUT_SOURCE);

    await run("ThisWeek", "WIDGET_UPDATE");

    expect(lightTextsOf(drawings[0])).toContain(WIDGET_STATES.signedOut.headline);
  });

  it("should read the pending-undo record beside the snapshot", async () => {
    const { bridge, run } = setUp();
    const readPendingUndo = jest.spyOn(bridge, "readPendingUndo");

    await run("TodayRing", "WIDGET_UPDATE");

    expect(readPendingUndo).toHaveBeenCalledTimes(1);
  });

  it("should draw nothing for a receiver that is not one of the eleven", async () => {
    const { drawings, run } = setUp();

    await run("Unknown", "WIDGET_UPDATE");

    expect(drawings).toEqual([]);
  });

  it("should draw nothing when a widget is deleted", async () => {
    const { drawings, run } = setUp();

    await run("TodayRing", "WIDGET_DELETED");

    expect(drawings).toEqual([]);
  });

  it("should ignore a click action it has no handler for", async () => {
    const { drawings, run } = setUp();

    await run("TodayRing", "WIDGET_CLICK", { clickAction: "LOG_AGAIN", clickActionData: {} });

    expect(drawings).toEqual([]);
  });

  it("should run the handler registered for a click action, which is where the one-tap widgets plug in", async () => {
    const bridge = createInMemoryWidgetBridge();
    const logAgain = jest.fn(() => Promise.resolve());
    const handler = createWidgetTaskHandler({
      bridge,
      now: () => NOW,
      clickHandlers: new Map([["LOG_AGAIN", logAgain]]),
    });
    const props: WidgetTaskHandlerProps = {
      widgetInfo: widgetInfo("TodayRing"),
      widgetAction: "WIDGET_CLICK",
      clickAction: "LOG_AGAIN",
      clickActionData: { entryId: "entry" },
      renderWidget: jest.fn(),
    };

    await handler(props);

    expect(logAgain).toHaveBeenCalledWith(props);
  });
});
