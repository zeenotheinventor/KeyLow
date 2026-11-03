import { BodyHeatWidget } from "./BodyHeatWidget";
import { BodyMapWidget } from "./BodyMapWidget";
import { MessageWidget } from "./MessageWidget";
import { widgetThemeFor } from "./theme";
import { ThisWeekWidget } from "./ThisWeekWidget";
import { TodayGlanceWidget } from "./TodayGlanceWidget";
import { TodayMacrosWidget } from "./TodayMacrosWidget";
import { TodayRingWidget } from "./TodayRingWidget";

import type { WidgetTheme } from "./theme";
import type { WidgetViewModel } from "@keylow/core/widgets";
import type { JSX } from "react";
import type { WidgetRepresentation } from "react-native-android-widget";

/** One drawing of a view model in one theme, or null for a kind no layout exists for yet. */
const drawingOf = (viewModel: WidgetViewModel, theme: WidgetTheme): JSX.Element | null => {
  if (viewModel.state !== "ready") {
    return <MessageWidget viewModel={viewModel} theme={theme} />;
  }
  switch (viewModel.kind) {
    case "today_ring":
      return <TodayRingWidget viewModel={viewModel} theme={theme} />;
    case "today_macros":
      return <TodayMacrosWidget viewModel={viewModel} theme={theme} />;
    case "this_week":
      return <ThisWeekWidget viewModel={viewModel} theme={theme} />;
    case "body_heat":
      return <BodyHeatWidget viewModel={viewModel} theme={theme} />;
    case "today_glance":
      return <TodayGlanceWidget viewModel={viewModel} theme={theme} />;
    case "body_map":
      return <BodyMapWidget viewModel={viewModel} theme={theme} />;
    default:
      // The quick logging widgets (KEY-806) add their cases above.
      return null;
  }
};

/**
 * What the launcher is handed for a view model: the light and the dark drawing, so the widget follows the
 * phone's mode without the app running. Null for a kind with no layout yet.
 */
export const widgetRepresentation = (viewModel: WidgetViewModel): WidgetRepresentation | null => {
  const light = drawingOf(viewModel, widgetThemeFor("light"));
  const dark = drawingOf(viewModel, widgetThemeFor("dark"));

  return light === null || dark === null ? null : { light, dark };
};
