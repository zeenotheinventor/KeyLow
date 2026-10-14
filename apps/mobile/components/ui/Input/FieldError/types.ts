export type FieldErrorProps = {
  /** The sentence that says what to do, from `@keylow/core/copy`, never an error's own message. */
  children: string;
  /** Layout from the caller, such as a margin. */
  className?: string;
};
