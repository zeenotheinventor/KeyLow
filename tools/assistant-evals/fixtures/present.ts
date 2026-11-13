/** The value, or an error naming what the kitchen world refers to but does not define. Shared by the kitchen fixtures. */
export const present = <Value>(value: Value | undefined, what: string): Value => {
  if (value === undefined) {
    throw new Error(`The kitchen world names ${what}, which it does not define`);
  }
  return value;
};
