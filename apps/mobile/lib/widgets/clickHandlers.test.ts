import { logAgain } from "./actions";
import { createWidgetClickHandlers } from "./clickHandlers";
import { createInMemoryWidgetBridge } from "./inMemoryWidgetBridge";
import { WidgetActionError } from "./widgetActionError";
import { NOW } from "../../test/support/widgetFixtures";

import type { WidgetActionDependencies, WidgetRepositories } from "./actions";
import type { WidgetActionName, WidgetActionResult } from "./types";
import type { WidgetInfo, WidgetTaskHandlerProps } from "react-native-android-widget";

const ENTRY_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "6c9f1c3e-4c7a-4f0e-9d52-0b7c1a2e8f01";
const EXERCISE_ID = "0b0f6a52-8f3c-4a39-a8c8-5d2f6a1b9c10";

const widgetInfo = (widgetName: string): WidgetInfo => ({
  widgetName,
  widgetId: 3,
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

const tap = (
  widgetName: string,
  clickAction: string,
  clickActionData: Record<string, unknown>,
): WidgetTaskHandlerProps => ({
  widgetInfo: widgetInfo(widgetName),
  widgetAction: "WIDGET_CLICK",
  clickAction,
  clickActionData,
  renderWidget: jest.fn(),
});

const unused = () => Promise.reject(new Error("The test does not use this repository call"));

const unusedRepositories: WidgetRepositories = {
  getLogEntry: unused,
  getFood: unused,
  listFoodPortions: unused,
  getMyTimeZone: unused,
  logFood: unused,
  softDeleteLogEntry: unused,
  getActiveSession: unused,
  getActiveRoutine: unused,
  getRoutine: unused,
  listAcceptedSuggestions: unused,
  getLastPerformance: unused,
  addSet: unused,
  removeSet: unused,
};

const dependenciesOf = (isOnline: () => Promise<boolean>): WidgetActionDependencies => ({
  repositories: unusedRepositories,
  bridge: createInMemoryWidgetBridge(),
  isOnline,
  now: () => NOW,
});

const failed = (
  failure: "couldnt_log" | "couldnt_undo" | "session_moved_on",
  action: WidgetActionName,
): WidgetActionResult => ({
  status: "failed",
  failure,
  error: new WidgetActionError(action, "request_failed"),
});

function setUp(result: WidgetActionResult = { status: "done" }) {
  const dependencies = dependenciesOf(() => Promise.resolve(true));
  const actions = {
    logAgain: jest.fn(() => Promise.resolve(result)),
    logNextSet: jest.fn(() => Promise.resolve(result)),
    undoLast: jest.fn(() => Promise.resolve(result)),
  };
  const redraw = jest.fn(() => Promise.resolve());
  const handlers = createWidgetClickHandlers({ dependencies: () => dependencies, redraw, actions });
  const run = async (props: WidgetTaskHandlerProps) => {
    await handlers.get(props.clickAction ?? "")?.(props);
  };

  return { dependencies, actions, redraw, handlers, run };
}

describe("the widget click handlers", () => {
  it("should handle the three named clicks of the one-tap widgets and nothing else", () => {
    expect([...setUp().handlers.keys()].sort()).toEqual(["LOG_AGAIN", "LOG_SET", "UNDO"]);
  });

  describe("Log again", () => {
    it("should log the tapped entry's food again, once, with the app's dependencies", async () => {
      const { actions, dependencies, run } = setUp();

      await run(tap("LogAgain", "LOG_AGAIN", { entryId: ENTRY_ID }));

      expect(actions.logAgain).toHaveBeenCalledTimes(1);
      expect(actions.logAgain).toHaveBeenCalledWith({ entryId: ENTRY_ID }, dependencies);
    });

    it("should leave the redraw to the action when it wrote, which it does itself with the Undo record", async () => {
      const { redraw, run } = setUp({ status: "done" });

      await run(tap("LogAgain", "LOG_AGAIN", { entryId: ENTRY_ID }));

      expect(redraw).not.toHaveBeenCalled();
    });

    it("should redraw with Couldn't log for the tapped widget only when the write failed", async () => {
      const { redraw, run } = setUp(failed("couldnt_log", "log_again"));

      await run(tap("LogAgain", "LOG_AGAIN", { entryId: ENTRY_ID }));

      expect(redraw).toHaveBeenCalledTimes(1);
      expect(redraw).toHaveBeenCalledWith({ kind: "log_again", failure: "couldnt_log" });
    });

    it("should redraw plainly when the tap was ignored", async () => {
      const { redraw, run } = setUp({ status: "ignored" });

      await run(tap("LogAgain", "LOG_AGAIN", { entryId: ENTRY_ID }));

      expect(redraw).toHaveBeenCalledWith(undefined);
    });

    it("should do nothing with click data that is not an entry id", async () => {
      const { actions, redraw, run } = setUp();

      await run(tap("LogAgain", "LOG_AGAIN", {}));
      await run(tap("LogAgain", "LOG_AGAIN", { entryId: 42 }));

      expect(actions.logAgain).not.toHaveBeenCalled();
      expect(redraw).not.toHaveBeenCalled();
    });
  });

  describe("Log set", () => {
    const data = { sessionId: SESSION_ID, exerciseId: EXERCISE_ID, setNumber: 3 };

    it("should log the next set as the widget showed it, once", async () => {
      const { actions, dependencies, run } = setUp();

      await run(tap("Training", "LOG_SET", data));

      expect(actions.logNextSet).toHaveBeenCalledTimes(1);
      expect(actions.logNextSet).toHaveBeenCalledWith(data, dependencies);
    });

    it("should redraw the Training widget with Your session moved on when the app is ahead", async () => {
      const { redraw, run } = setUp(failed("session_moved_on", "log_set"));

      await run(tap("Training", "LOG_SET", data));

      expect(redraw).toHaveBeenCalledWith({ kind: "training", failure: "session_moved_on" });
    });

    it("should do nothing when the set position is not a number", async () => {
      const { actions, run } = setUp();

      await run(tap("Training", "LOG_SET", { ...data, setNumber: "3" }));

      expect(actions.logNextSet).not.toHaveBeenCalled();
    });
  });

  describe("Undo", () => {
    it("should undo the last one-tap write once", async () => {
      const { actions, dependencies, run } = setUp();

      await run(tap("LogAgain", "UNDO", {}));

      expect(actions.undoLast).toHaveBeenCalledTimes(1);
      expect(actions.undoLast).toHaveBeenCalledWith(dependencies);
    });

    it("should redraw the tapped widget with Couldn't undo when the removal failed", async () => {
      const { redraw, run } = setUp(failed("couldnt_undo", "undo"));

      await run(tap("Training", "UNDO", {}));

      expect(redraw).toHaveBeenCalledWith({ kind: "training", failure: "couldnt_undo" });
    });
  });

  it("should redraw plainly, without a failure, when the tapped widget is not one of ours", async () => {
    const { redraw, run } = setUp(failed("couldnt_log", "log_again"));

    await run(tap("Unknown", "LOG_AGAIN", { entryId: ENTRY_ID }));

    expect(redraw).toHaveBeenCalledWith(undefined);
  });

  it("should write once when the same tap arrives twice before the first finishes", async () => {
    let finishProbe: (online: boolean) => void = () => undefined;
    const isOnline = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishProbe = resolve;
        }),
    );
    const dependencies = dependenciesOf(isOnline);
    const handlers = createWidgetClickHandlers({
      dependencies: () => dependencies,
      redraw: jest.fn(() => Promise.resolve()),
      actions: { logAgain, logNextSet: jest.fn(), undoLast: jest.fn() },
    });
    const props = tap("LogAgain", "LOG_AGAIN", { entryId: ENTRY_ID });

    const first = handlers.get("LOG_AGAIN")?.(props);
    const second = handlers.get("LOG_AGAIN")?.(props);
    finishProbe(false);
    await Promise.all([first, second]);

    expect(isOnline).toHaveBeenCalledTimes(1);
  });
});
