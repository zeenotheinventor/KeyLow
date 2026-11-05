import type { WeighIn } from "@keylow/api-client";

export type WeighInRowProps = {
  weighIn: WeighIn;
  /** Today in the profile's zone, `YYYY-MM-DD`. */
  today: string;
  /** Whether the trend left the reading out. */
  isLeftOut: boolean;
  /** Opens the weigh-in, as the row is pressed. */
  onOpen: (weighIn: WeighIn) => void;
};
