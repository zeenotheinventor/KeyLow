export type GoalAnswerRowProps = {
  /** The question as a caption, such as "Days a week". */
  label: string;
  /** The answer as it reads, such as "Full gym". It wraps when long. */
  value: string;
  /** What a screen reader hears: "Days a week: 4. Change". */
  name: string;
  /** Where the row leads: the question it changes. */
  href: string;
};
