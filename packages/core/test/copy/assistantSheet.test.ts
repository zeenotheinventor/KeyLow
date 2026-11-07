import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import { ASSISTANT_SHEET } from "../../src/copy";

describe("ASSISTANT_SHEET", () => {
  it("should carry the words the assistant sheet boards print", () => {
    expect(ASSISTANT_SHEET).toEqual({
      title: "Assistant",
      newConversationLabel: "New conversation",
      closeLabel: "Close",
      sendLabel: "Send",
      composerLabel: "Message",
      emptyHeading: "Log food or ask about your diary",
      emptyLede: "Say it in your own words. Every change shows here with Undo.",
      startersLabel: "Starters",
      quickRepliesLabel: "Quick replies",
      starters: [
        "Log 2 eggs and toast at 08:10",
        "What's left for today?",
        "Copy yesterday to today",
        "Add a recipe from a link",
      ],
      composerPlaceholder: "Log food or ask about your diary",
      speakerYou: "You",
      speakerAssistant: "Assistant",
      openingLabel: "Loading your conversation",
    });
  });

  it("should use no em dash and no double hyphen in any word", () => {
    for (const words of collectStrings(ASSISTANT_SHEET)) {
      expect(words).not.toMatch(/—|--/);
    }
  });
});
