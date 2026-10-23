import type { WeighIn } from "@keylow/api-client";

export type WeighInRowProps = {
  weighIn: WeighIn;
  /** Today in the profile's time zone, `YYYY-MM-DD`. */
  today: string;
  /** Whether the trend left the reading out. */
  isLeftOut: boolean;
};
