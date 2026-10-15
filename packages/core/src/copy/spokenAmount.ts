// @not-in-barrel Internal to the copy: other copy modules use it, and it is not part of @keylow/core/copy.
/** Writes an amount for a screen reader, with the unit in the singular for exactly one: "1 gram", "2.2 grams". */
export const spokenAmount = (
  amountText: string,
  singularUnit: string,
  pluralUnit: string,
): string => `${amountText} ${amountText === "1" ? singularUnit : pluralUnit}`;
