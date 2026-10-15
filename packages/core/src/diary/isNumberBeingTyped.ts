const NUMBER_BEING_TYPED = /^\d*[.,]?\d*$/;

/**
 * Whether the text in a number field could be part of an amount being typed: digits with at most one decimal
 * point or comma. A field that keeps only such text can never hold a negative or a malformed number, so it
 * needs no words for them. An empty field, or one that holds just a point, is a number not yet typed.
 */
export const isNumberBeingTyped = (text: string): boolean => NUMBER_BEING_TYPED.test(text);
