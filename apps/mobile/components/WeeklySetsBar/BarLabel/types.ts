export type BarLabelProps = {
  text: string;
  /** Hung from the left edge of the track, or centred on its mark. */
  anchor: "start" | "centre";
  /** The class that puts a centred label's middle on its mark, reading the mark's variable. */
  markClassName: string;
};
