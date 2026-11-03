import type { WidgetActionCode, WidgetActionName } from "./types";

/**
 * A one-tap action that did not work. Like every repository error (ADR 0004) it carries the action and a
 * code and nothing else: the message never holds a food, an amount or a set, which are health data.
 */
export class WidgetActionError extends Error {
  readonly action: WidgetActionName;
  readonly code: WidgetActionCode;

  constructor(action: WidgetActionName, code: WidgetActionCode) {
    super(`Widget action ${action} failed: ${code}`);
    this.name = "WidgetActionError";
    this.action = action;
    this.code = code;
  }
}
