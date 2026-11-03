import { WIDGET_STATES } from "@keylow/core/copy";

import { createInMemoryWidgetBridge } from "./inMemoryWidgetBridge";
import { redrawWidgets } from "./redrawWidgets";
import { WIDGET_PROVIDERS } from "./widgetProviders";
import { NOW } from "../../test/support/widgetFixtures";
import {
  pendingUndoOf,
  quickLogSnapshot,
  sessionSnapshot,
} from "../../widgets/android/test/viewModels";
import { textsOf, treeOf } from "../../widgets/android/test/widgetTree";

import type { RequestWidgetUpdateProps, WidgetInfo } from "react-native-android-widget";

const info: WidgetInfo = {
  widgetName: "",
  widgetId: 1,
  width: 364,
  height: 170,
  screenInfo: {
    screenHeightDp: 800,
    screenWidthDp: 400,
    density: 2.5,
    densityDpi: 400,
    fontScale: 1,
  },
};

async function textsByWidget(
  requests: readonly RequestWidgetUpdateProps[],
): Promise<Record<string, string[]>> {
  const byWidget: Record<string, string[]> = {};
  for (const request of requests) {
    const drawing = await request.renderWidget(info);
    byWidget[request.widgetName] = textsOf(treeOf("light" in drawing ? drawing.light : drawing));
  }

  return byWidget;
}

function setUp() {
  const bridge = createInMemoryWidgetBridge();
  const requests: RequestWidgetUpdateProps[] = [];
  const redraw = (failure?: Parameters<typeof redrawWidgets>[0]["failure"]) =>
    redrawWidgets({
      bridge,
      now: () => NOW,
      requestUpdate: (request) => {
        requests.push(request);
        return Promise.resolve();
      },
      failure,
    });

  return { bridge, requests, redraw };
}

describe("redrawing the widgets", () => {
  it("should ask for an update of all eleven widgets", async () => {
    const { redraw, requests } = setUp();

    await redraw();

    expect(requests.map((request) => request.widgetName)).toEqual(
      WIDGET_PROVIDERS.map((provider) => provider.name),
    );
  });

  it("should show Couldn't log on the widget the failure names and on no other", async () => {
    const { bridge, redraw, requests } = setUp();
    await bridge.writeSnapshot(sessionSnapshot());

    await redraw({ kind: "training", failure: "couldnt_log" });

    const texts = await textsByWidget(requests);
    expect(texts.Training).toContain(WIDGET_STATES.couldntLog.headline);
    expect(texts.LogAgain).not.toContain(WIDGET_STATES.couldntLog.headline);
    expect(texts.TodayRing).not.toContain(WIDGET_STATES.couldntLog.headline);
  });

  it("should not keep the failure, so the next redraw draws the widget normally", async () => {
    const { bridge, redraw, requests } = setUp();
    await bridge.writeSnapshot(quickLogSnapshot());
    await redraw({ kind: "log_again", failure: "couldnt_log" });
    requests.length = 0;

    await redraw();

    const texts = await textsByWidget(requests);
    expect(texts.LogAgain).not.toContain(WIDGET_STATES.couldntLog.headline);
    expect(texts.LogAgain).toContain("Overnight oats");
  });

  it("should draw the pending-undo record, so the tapped row shows Logged with Undo", async () => {
    const { bridge, redraw, requests } = setUp();
    await bridge.writeSnapshot(quickLogSnapshot());
    await bridge.writePendingUndo(
      pendingUndoOf("log_again", "11111111-1111-4111-8111-111111111111"),
    );

    await redraw();

    const texts = await textsByWidget(requests);
    expect(texts.LogAgain).toContain("Logged Overnight oats");
    expect(texts.LogAgain).toContain("Undo");
  });
});
