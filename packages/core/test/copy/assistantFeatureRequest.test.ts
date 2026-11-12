import { describe, expect, it } from "vitest";

import { ASSISTANT_FEATURE_REQUEST_COPY } from "../../src/copy";

describe("the assistant's feature request copy", () => {
  it("should pin the offer, the buttons, the note and the card title", () => {
    expect(ASSISTANT_FEATURE_REQUEST_COPY).toEqual({
      question: "Send this to the Ki-Lo team as a feature request?",
      confirmLabel: "Send request",
      cancelLabel: "No thanks",
      note: "A short part of this chat goes with it, and stays even if the chat is deleted.",
      cardTitle: "Feature request sent",
    });
  });
});
