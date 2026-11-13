import { planRankingSchema } from "../assistant/kitchenGeneration";

import type { PlanOffer } from "./planPool";

/**
 * The ids of a ranking the model answered with, most preferred first. The model answers with the short codes
 * it was offered. A code nobody offered and a repeat are dropped, so a ranking can only choose among what was
 * offered and reorder it, and no quantity is ever read from it. Null when the answer is not a ranking at all.
 */
export const rankedIdsOfReply = (
  reply: unknown,
  offers: readonly Pick<PlanOffer, "code" | "id">[],
): string[] | null => {
  const read = planRankingSchema.safeParse(reply);
  if (!read.success) {
    return null;
  }
  const idOfCode = new Map(offers.map(({ code, id }) => [code, id]));
  const ids = read.data.ranking.flatMap((code) => {
    const id = idOfCode.get(code);
    return id === undefined ? [] : [id];
  });
  return [...new Set(ids)];
};
