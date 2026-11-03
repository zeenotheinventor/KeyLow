import { WIDGET_STATES } from "@keylow/core/copy";

import { createAndroidWidgetBridge } from "./androidWidgetBridge";
import { WIDGET_PROVIDERS } from "./widgetProviders";
import { NOW } from "../../test/support/widgetFixtures";
import { populatedSnapshot } from "../../widgets/android/test/viewModels";
import { treeOf, textsOf } from "../../widgets/android/test/widgetTree";

import type { RequestWidgetUpdateProps, WidgetInfo } from "react-native-android-widget";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {},
}));

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => Promise.resolve(values.get(key) ?? null),
    setItem: (key: string, value: string) => {
      values.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      values.delete(key);
      return Promise.resolve();
    },
  };
}

const someInfo: WidgetInfo = {
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

function setUp() {
  const requests: RequestWidgetUpdateProps[] = [];
  const bridge = createAndroidWidgetBridge({
    storage: memoryStorage(),
    requestUpdate: (request) => {
      requests.push(request);
      return Promise.resolve();
    },
    now: () => NOW,
  });

  return { bridge, requests };
}

const headlinesOf = async (requests: readonly RequestWidgetUpdateProps[]): Promise<string[][]> =>
  Promise.all(
    requests.map(async (request) => {
      const drawing = await request.renderWidget(someInfo);

      return "light" in drawing ? textsOf(treeOf(drawing.light)) : textsOf(treeOf(drawing));
    }),
  );

describe("the Android widget bridge", () => {
  it("should ask for an update of each of the eleven widgets on a redraw", async () => {
    const { bridge, requests } = setUp();

    await bridge.requestRedraw();

    expect(requests.map((request) => request.widgetName)).toEqual(
      WIDGET_PROVIDERS.map((provider) => provider.name),
    );
  });

  it("should redraw from the snapshot the app wrote", async () => {
    const { bridge, requests } = setUp();
    await bridge.writeSnapshot(populatedSnapshot());

    await bridge.requestRedraw();

    const [todayRingTexts] = await headlinesOf(requests);
    expect(todayRingTexts).toContain("1,460 of 2,200");
  });

  it("should draw the no data state before the app has written anything", async () => {
    const { bridge, requests } = setUp();

    await bridge.requestRedraw();

    const texts = await headlinesOf(requests);
    WIDGET_PROVIDERS.forEach(({ name }, position) => {
      // The log grid has nothing to load, so it draws its four shortcuts all the same.
      expect(texts[position]).toContain(
        name === "LogGrid" ? "Search" : WIDGET_STATES.noData.headline,
      );
    });
  });

  it("should draw the signed out state on the next redraw after the stored data is cleared", async () => {
    const { bridge, requests } = setUp();
    await bridge.writeSnapshot(populatedSnapshot());

    await bridge.clear();
    await bridge.requestRedraw();

    for (const texts of await headlinesOf(requests)) {
      expect(texts).toContain(WIDGET_STATES.signedOut.headline);
      expect(texts).not.toContain("1,460 of 2,200");
    }
  });

  it("should draw the snapshot again once the app signs in and writes one", async () => {
    const { bridge, requests } = setUp();
    await bridge.clear();

    await bridge.writeSnapshot(populatedSnapshot());
    await bridge.requestRedraw();

    const [todayRingTexts] = await headlinesOf(requests);
    expect(todayRingTexts).toContain("1,460 of 2,200");
  });
});
