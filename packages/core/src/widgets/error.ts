export type WidgetErrorAction = "view_model" | "timeline";

export type WidgetErrorCode = "invalid_now";

/**
 * A widget function that could not run. Like every repository error (ADR 0004) it carries the action and a
 * code and nothing else: the message never holds a value of the snapshot, which is health data.
 */
export class WidgetError extends Error {
  readonly action: WidgetErrorAction;
  readonly code: WidgetErrorCode;

  constructor(action: WidgetErrorAction, code: WidgetErrorCode) {
    super(`Widget ${action} failed: ${code}`);
    this.name = "WidgetError";
    this.action = action;
    this.code = code;
  }
}
