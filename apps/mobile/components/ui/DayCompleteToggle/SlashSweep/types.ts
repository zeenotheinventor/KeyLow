/** The row is the day complete toggle's slash, and the card is the setup estimate's wider one. */
export type SlashSweepVariant = "row" | "card";

export type SlashSweepProps = {
  /** Defaults to `row`. */
  variant?: SlashSweepVariant;
};
