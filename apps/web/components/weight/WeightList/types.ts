import type { WeighIn } from "@keylow/api-client";

export type WeightListProps = {
  /** The signed in user's weigh-ins, newest first. */
  weighIns: readonly WeighIn[];
  /** Today in the profile's zone, `YYYY-MM-DD`. */
  today: string;
  /** Whether the trend left out the reading of a day. */
  isLeftOut: (localDate: string) => boolean;
  /** Opens a weigh-in, as its row is pressed. */
  onOpen: (weighIn: WeighIn) => void;
};
