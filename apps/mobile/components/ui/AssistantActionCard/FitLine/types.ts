export type FitLineProps = {
  text: string;
  /** `success` for a draft within the tolerance, `warning` for one that fell short. */
  tone: "success" | "warning";
};
