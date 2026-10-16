/** A valid barcode the user asked to look up. `attempt` counts the requests, from 1. */
export type BarcodeLookupRequest = {
  code: string;
  attempt: number;
};

export type BarcodeLookupProps = {
  /** Called when the user closes the panel. */
  onClose: () => void;
  /** The day a found food is added to, `YYYY-MM-DD`. Left out, it is today. */
  day?: string | undefined;
};
