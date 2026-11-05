export type GoalAnswerRowProps = {
  /** The question, such as "Days a week". */
  label: string;
  /** The answer, already worded, which wraps when it is long. */
  value: string;
  /** What a screen reader hears, such as "Goal: Look better. Change", from `describeGoalAnswerRows`. */
  name: string;
  /** Opens the question. */
  onPress: () => void;
};
