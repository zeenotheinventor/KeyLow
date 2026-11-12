import { describe, expect, it } from "vitest";

import {
  assistantCardSchema,
  buildFeatureRequestedCard,
  confirmFeatureRequestButtons,
  confirmFeatureRequestNote,
  confirmFeatureRequestQuestion,
  withActionIds,
} from "../../src/assistant";

const actionId = "00000000-0000-4000-8000-0000000000d1";

describe("buildFeatureRequestedCard", () => {
  it("should say the request was sent, with the request under it and no way to undo it", () => {
    expect(buildFeatureRequestedCard({ request: "Track my water intake" })).toEqual({
      kind: "feature_requested",
      title: "Feature request sent",
      sub: "Track my water intake",
      rows: [],
      totalText: null,
      note: null,
      link: null,
      undo: "unavailable",
      undoneSub: null,
    });
  });

  it("should be a card the app accepts once it has its action id", () => {
    const card = withActionIds(buildFeatureRequestedCard({ request: "Track my water" }), [
      actionId,
    ]);

    expect(assistantCardSchema.parse(card)).toEqual(card);
  });
});

describe("the feature request confirmation", () => {
  it("should offer to send the request to the Ki-Lo team", () => {
    expect(confirmFeatureRequestQuestion()).toBe(
      "Send this to the Ki-Lo team as a feature request?",
    );
  });

  it("should have the Send request button and a way to decline", () => {
    expect(confirmFeatureRequestButtons()).toEqual({
      confirmLabel: "Send request",
      cancelLabel: "No thanks",
    });
  });

  it("should say that part of the chat goes with it and stays when the chat is deleted", () => {
    expect(confirmFeatureRequestNote()).toBe(
      "A short part of this chat goes with it, and stays even if the chat is deleted.",
    );
  });
});
