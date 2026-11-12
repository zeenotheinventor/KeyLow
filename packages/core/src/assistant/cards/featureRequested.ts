import { ASSISTANT_FEATURE_REQUEST_COPY } from "../../copy/assistantFeatureRequest";

import type { AssistantCardDraft } from "./entryCardEntry";

/**
 * The card after a `request_feature`: "Feature request sent" with the request under it. A client cannot
 * delete a request, so there is no Undo and no link. NOT ON THE CANVAS (ADR 0006, Amendment 4).
 */
export function buildFeatureRequestedCard({ request }: { request: string }): AssistantCardDraft {
  return {
    kind: "feature_requested",
    title: ASSISTANT_FEATURE_REQUEST_COPY.cardTitle,
    sub: request,
    rows: [],
    totalText: null,
    note: null,
    link: null,
    undo: "unavailable",
    undoneSub: null,
  };
}
