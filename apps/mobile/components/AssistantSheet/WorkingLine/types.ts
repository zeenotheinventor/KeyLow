export type WorkingLineProps = {
  /** The words of the line, such as "Thinking" or "Reading the recipe at example.com". */
  text: string;
  /**
   * A second line that appears under the words once the line has had its step for `afterMilliseconds`, for a
   * step that takes a while (`assistant · working-long`). Leave it out for every other step.
   */
  hint?: { words: string; afterMilliseconds: number } | undefined;
};
