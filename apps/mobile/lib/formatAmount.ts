/** Shows a nutrient or portion amount to one decimal place at most, without a trailing zero. */
export function formatAmount(amount: number): string {
  return String(Math.round(amount * 10) / 10);
}
