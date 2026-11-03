import "expo-router/entry";
import { registerWidgetTaskHandler } from "react-native-android-widget";

import { widgetTaskHandler } from "./lib/widgets/defaultWidgetTaskHandler";

// The router's entry starts the app as before. The widget task handler is registered beside it so the
// launcher can run it headless, with no screen open (ADR 0007, "The library").
registerWidgetTaskHandler(widgetTaskHandler);
