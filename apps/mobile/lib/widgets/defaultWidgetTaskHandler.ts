import { logAgain, logNextSet, undoLast } from "./actions";
import { createWidgetClickHandlers } from "./clickHandlers";
import { defaultWidgetActionDependencies } from "./defaultWidgetActionDependencies";
import { defaultWidgetBridge } from "./defaultWidgetBridge";
import { redrawWidgets } from "./redrawWidgets";
import { createWidgetTaskHandler } from "./widgetTaskHandler";

/** The task handler the launcher runs: the shared bridge, the app's Supabase session and the one-tap actions. */
export const widgetTaskHandler = createWidgetTaskHandler({
  bridge: defaultWidgetBridge,
  now: () => new Date(),
  clickHandlers: createWidgetClickHandlers({
    dependencies: defaultWidgetActionDependencies,
    redraw: (failure) => redrawWidgets({ bridge: defaultWidgetBridge, failure }),
    actions: { logAgain, logNextSet, undoLast },
  }),
});
