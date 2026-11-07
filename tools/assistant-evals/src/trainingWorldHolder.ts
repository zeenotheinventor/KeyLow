import type { TrainingWorld } from "./trainingWorld.ts";

// The training world of a run, attached by the session when it opens and read by the training advice cases,
// as the red-team world is. A case that runs with no session that attached one fails with a message that says so.

let attached: TrainingWorld | null = null;

export const trainingWorldHolder = {
  attach: (world: TrainingWorld): void => {
    attached = world;
  },
  detach: (): Promise<void> => {
    attached = null;
    return Promise.resolve();
  },
  current: (): TrainingWorld => {
    if (attached === null) {
      throw new Error("The training advice cases need a session that attached the training world");
    }
    return attached;
  },
};
