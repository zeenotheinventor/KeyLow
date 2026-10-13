/** Writes an amount for a screen reader, with the unit in the singular for exactly one: "1 gram", "2.2 grams". */
export const spokenAmount = (
  amountText: string,
  singularUnit: string,
  pluralUnit: string,
): string => `${amountText} ${amountText === "1" ? singularUnit : pluralUnit}`;
