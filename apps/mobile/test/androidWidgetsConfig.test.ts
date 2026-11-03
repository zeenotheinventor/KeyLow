import { WIDGET_GALLERY } from "@keylow/core/copy";

import appJson from "../app.json";
import { DASHBOARD_WIDGET_PROVIDERS } from "../lib/widgets/widgetProviders";

// Typed by hand because the app has no Node type definitions.
const { existsSync } = jest.requireActual<{ existsSync: (path: string) => boolean }>("node:fs");
const { resolve } = jest.requireActual<{ resolve: (...parts: string[]) => string }>("node:path");

const APP_ROOT = resolve(__dirname, "..");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function widgetPluginOptions(): Record<string, unknown> {
  for (const plugin of appJson.expo.plugins) {
    if (Array.isArray(plugin) && plugin[0] === "react-native-android-widget") {
      const options: unknown = plugin[1];
      if (isRecord(options)) {
        return options;
      }
    }
  }
  throw new Error("app.json has no react-native-android-widget plugin entry");
}

const pluginWidgets = (): Record<string, unknown>[] => {
  const widgets = widgetPluginOptions().widgets;
  if (!Array.isArray(widgets)) {
    throw new Error("The plugin entry has no widgets");
  }

  return widgets.filter(isRecord);
};

describe("the Android widgets in app.json", () => {
  it("should register the six dashboard widgets under the names the task handler draws", () => {
    expect(pluginWidgets().map((widget) => widget.name)).toEqual(
      DASHBOARD_WIDGET_PROVIDERS.map((provider) => provider.name),
    );
  });

  it("should word each widget's label and description exactly as the core copy does", () => {
    const widgets = pluginWidgets();

    DASHBOARD_WIDGET_PROVIDERS.forEach(({ kind }, position) => {
      expect(widgets[position]).toMatchObject({
        label: WIDGET_GALLERY[kind].label,
        description: WIDGET_GALLERY[kind].description,
      });
    });
  });

  it("should give every widget a size on the launcher grid and let the person resize it", () => {
    for (const widget of pluginWidgets()) {
      expect(widget.minWidth).toMatch(/^\d+dp$/);
      expect(widget.minHeight).toMatch(/^\d+dp$/);
      expect(widget.resizeMode).toBe("horizontal|vertical");
      expect(widget.updatePeriodMillis).toBe(1_800_000);
    }
  });

  it("should size the small widgets 2 by 2, the medium 4 by 2 and the large 4 by 4", () => {
    const cells: Record<string, string> = {};
    for (const widget of pluginWidgets()) {
      cells[String(widget.name)] =
        `${String(widget.targetCellWidth)}x${String(widget.targetCellHeight)}`;
    }

    expect(cells).toEqual({
      TodayRing: "2x2",
      TodayMacros: "4x2",
      ThisWeek: "4x2",
      BodyHeat: "2x2",
      TodayGlance: "4x4",
      BodyMap: "4x2",
    });
  });

  it("should ship a preview image for every widget", () => {
    for (const widget of pluginWidgets()) {
      expect(typeof widget.previewImage).toBe("string");
      expect(existsSync(resolve(APP_ROOT, String(widget.previewImage)))).toBe(true);
    }
  });

  it("should ship the Geist files the widget text names", () => {
    const fonts = widgetPluginOptions().fonts;

    expect(fonts).toEqual([
      "./assets/fonts/Geist-Regular.ttf",
      "./assets/fonts/Geist-Medium.ttf",
      "./assets/fonts/Geist-SemiBold.ttf",
    ]);
  });
});
