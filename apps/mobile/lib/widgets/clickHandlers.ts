import { widgetKindOf } from "./widgetProviders";

import type { WidgetActionDependencies } from "./actions";
import type { WidgetActionResult } from "./types";
import type { WidgetFailure, WidgetKind } from "@keylow/core/widgets";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";

/** Runs one named click action of a widget (a one-tap write) inside the task handler. */
export type WidgetClickHandler = (props: WidgetTaskHandlerProps) => Promise<void>;

type Actions = Readonly<{
  logAgain: (
    input: { entryId: string },
    dependencies: WidgetActionDependencies,
  ) => Promise<WidgetActionResult>;
  logNextSet: (
    input: { sessionId: string; exerciseId: string; setNumber: number },
    dependencies: WidgetActionDependencies,
  ) => Promise<WidgetActionResult>;
  undoLast: (dependencies: WidgetActionDependencies) => Promise<WidgetActionResult>;
}>;

type Dependencies = Readonly<{
  dependencies: () => WidgetActionDependencies;
  /** Redraws every widget. A failure names the tapped widget's kind, which alone shows it, for this redraw only. */
  redraw: (failure?: Readonly<{ kind: WidgetKind; failure: WidgetFailure }>) => Promise<void>;
  actions: Actions;
}>;

const isString = (value: unknown): value is string => typeof value === "string";

/**
 * The click actions the one-tap widgets send, by the names `clickProps.ts` gives them. An action that wrote
 * has already redrawn the widgets itself, with the pending-undo record. One that failed has not, so this
 * redraws with the failure for the tapped widget. One that was ignored (a second tap while the first is
 * under way, an Undo with no record) redraws plainly, so a stale "Logged" does not stay.
 */
export function createWidgetClickHandlers({
  dependencies,
  redraw,
  actions,
}: Dependencies): ReadonlyMap<string, WidgetClickHandler> {
  const settle =
    (
      work: (props: WidgetTaskHandlerProps) => Promise<WidgetActionResult> | null,
    ): WidgetClickHandler =>
    async (props) => {
      const result = await work(props);
      if (result === null || result.status === "done") {
        return;
      }
      const kind = widgetKindOf(props.widgetInfo.widgetName);
      await redraw(
        result.status === "failed" && kind !== undefined
          ? { kind, failure: result.failure }
          : undefined,
      );
    };

  return new Map<string, WidgetClickHandler>([
    [
      "LOG_AGAIN",
      settle(({ clickActionData }) => {
        const entryId = clickActionData?.entryId;

        return isString(entryId) ? actions.logAgain({ entryId }, dependencies()) : null;
      }),
    ],
    [
      "LOG_SET",
      settle(({ clickActionData }) => {
        const sessionId = clickActionData?.sessionId;
        const exerciseId = clickActionData?.exerciseId;
        const setNumber = clickActionData?.setNumber;

        return isString(sessionId) && isString(exerciseId) && typeof setNumber === "number"
          ? actions.logNextSet({ sessionId, exerciseId, setNumber }, dependencies())
          : null;
      }),
    ],
    ["UNDO", settle(() => actions.undoLast(dependencies()))],
  ]);
}
