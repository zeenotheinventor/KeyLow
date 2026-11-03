import { describe, expect, it } from "vitest";

import {
  ASSISTANT_DELETE_ALL_DIALOG,
  DELETE_FAILED_BANNER,
  ASSISTANT_SETTINGS,
  describeAssistantConsentCaption,
  describeAssistantMoreRow,
} from "../../src/copy";

describe("describeAssistantMoreRow", () => {
  it("should word the row as tab-shell.more · assistant-row prints it when the assistant is off", () => {
    expect(describeAssistantMoreRow(false)).toEqual({
      title: "Assistant",
      subtitle: "Off until you turn it on",
      value: "Off",
    });
  });

  it("should word the row as tab-shell.more · assistant-row prints it when the assistant is on", () => {
    expect(describeAssistantMoreRow(true)).toEqual({
      title: "Assistant",
      subtitle: "Log and ask in your own words",
      value: "On",
    });
  });
});

describe("describeAssistantMoreRow before the setting is read", () => {
  it("should say nothing but the title, so a row is not drawn Off and then On", () => {
    expect(describeAssistantMoreRow(undefined)).toEqual({
      title: "Assistant",
      subtitle: undefined,
      value: undefined,
    });
  });
});

describe("describeAssistantConsentCaption", () => {
  it("should say the assistant is off until the person turns it on", () => {
    expect(describeAssistantConsentCaption(false)).toBe("Off until you turn it on.");
  });

  it("should say where to open the assistant from once it is on", () => {
    expect(describeAssistantConsentCaption(true)).toBe(
      "On. Open it from the Diary header or Describe in Log food.",
    );
  });
});

describe("ASSISTANT_SETTINGS", () => {
  it("should word the screen as assistant-settings · consent prints it", () => {
    expect(ASSISTANT_SETTINGS).toEqual({
      title: "Assistant",
      back: "Back to More",
      useLabel: "Use the assistant",
      whatItDoes: "What it does",
      yourConversations: "Your conversations",
      deleteAllLabel: "Delete all conversations",
      deleteAllCaption: "Deleting conversations does not undo the changes in them.",
    });
  });
});

describe("ASSISTANT_DELETE_ALL_DIALOG", () => {
  it("should carry the recommended confirmation the boards do not draw yet", () => {
    expect(ASSISTANT_DELETE_ALL_DIALOG).toEqual({
      title: "Delete all conversations?",
      body: "This removes every conversation with the assistant. Changes it made to your diary and recipes stay.",
      confirmLabel: "Delete",
      cancelLabel: "Keep them",
    });
  });
});

describe("DELETE_FAILED_BANNER", () => {
  it("should say the delete did not happen, after the copy failure banner's wording", () => {
    expect(DELETE_FAILED_BANNER).toBe("Not deleted. Check your connection and try again.");
  });
});
