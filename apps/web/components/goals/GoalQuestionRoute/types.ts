export type GoalQuestionRouteProps = {
  /** The question's address segment as written, such as "2". */
  step: string;
  /** The address's `from` parameter. `goal` says a row of the Goal page opened the question. */
  from?: string | undefined;
  /** The address's `origin` parameter. `train` says Train opened the flow. */
  origin?: string | undefined;
};
