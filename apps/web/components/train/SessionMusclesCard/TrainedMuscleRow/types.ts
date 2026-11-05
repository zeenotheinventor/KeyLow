export type TrainedMuscleRowProps = {
  /** The muscle's name. */
  name: string;
  /** Its effective sets in words: "5.5 sets". */
  value: string;
  /** The heat step of its swatch, from 0 to 5. */
  heatStep: number;
  /** Whether the swatch of the heat step is drawn. The side card of the session page has none. */
  hasSwatch: boolean;
};
