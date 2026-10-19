export type RirFieldProps = {
  /** The RIR as text: the number of the chip chosen, or blank for none. */
  rir: string;
  /** The line under the chips, or null for none. */
  help: string | null;
  /** Called with the chosen chip's number as text, or a blank when the chosen chip is pressed again. */
  onChange: (rir: string) => void;
};
