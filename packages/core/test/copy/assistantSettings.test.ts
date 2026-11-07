import { describe, expect, it } from "vitest";

import {
  ASSISTANT_CHANGES,
  ASSISTANT_DELETE_ALL_DIALOG,
  DELETE_FAILED_BANNER,
  ASSISTANT_SETTINGS,
  describeAssistantChangeRow,
  describeAssistantConsentCaption,
  describeAssistantMoreRow,
} from "../../src/copy";

import type { AssistantChangeRow } from "../../src/assistant";

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
      "On. Open it from the Diary header, the Train header or Describe in Log food.",
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
      changesRowLabel: "What the assistant changed",
    });
  });
});

describe("ASSISTANT_DELETE_ALL_DIALOG", () => {
  it("should carry the recommended confirmation the boards do not draw yet", () => {
    expect(ASSISTANT_DELETE_ALL_DIALOG).toEqual({
      title: "Delete all conversations?",
      body: "This removes every conversation with the assistant. Changes it made to your diary and recipes stay, and you can still undo them from What the assistant changed.",
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

describe("ASSISTANT_CHANGES", () => {
  it("should word the screen as assistant-settings · changes and changes-empty print it", () => {
    expect(ASSISTANT_CHANGES).toEqual({
      title: "What the assistant changed",
      back: "Back to Assistant",
      footer:
        "Undo works while an item is as the assistant left it. Once you change it in the diary or the recipe editor, change it there.",
      emptyTitle: "Nothing changed yet",
      emptyBody:
        "When the assistant logs, copies or changes something for you, it shows here with Undo.",
    });
  });
});

const row = (state: AssistantChangeRow["state"], sub: string | null): AssistantChangeRow => ({
  key: "a1",
  actionIds: ["a1"],
  title: "Logged 2 eggs and toast at 08:10",
  sub,
  state,
});

describe("describeAssistantChangeRow", () => {
  it("should draw a row that can be undone with its Undo button and its title as sent", () => {
    expect(describeAssistantChangeRow(row("undo", "08:11 · 2 entries"), null)).toEqual({
      title: "Logged 2 eggs and toast at 08:10",
      subtitle: "08:11 · 2 entries",
      titleTone: "primary",
      trailing: { kind: "action", label: "Undo" },
    });
  });

  it("should draw an undone row with its title muted and the word Undone", () => {
    expect(describeAssistantChangeRow(row("undone", "12:30"), null)).toEqual({
      title: "Logged 2 eggs and toast at 08:10",
      subtitle: "12:30",
      titleTone: "secondary",
      trailing: { kind: "label", label: "Undone" },
    });
  });

  it("should draw a row that cannot be undone with the words Can't undo and its title as it is", () => {
    expect(
      describeAssistantChangeRow(row("cant_undo", "07:31 · changed in your diary since"), null),
    ).toEqual({
      title: "Logged 2 eggs and toast at 08:10",
      subtitle: "07:31 · changed in your diary since",
      titleTone: "primary",
      trailing: { kind: "label", label: "Can't undo" },
    });
  });

  it("should draw no subtitle for a row without one", () => {
    expect(describeAssistantChangeRow(row("undo", null), null).subtitle).toBeUndefined();
  });

  it("should read an Undo that worked as Undone, until the list is read again", () => {
    expect(describeAssistantChangeRow(row("undo", "08:11"), "undone").trailing).toEqual({
      kind: "label",
      label: "Undone",
    });
  });

  it("should read an Undo that could not be done as Can't undo, until the list is read again", () => {
    expect(describeAssistantChangeRow(row("undo", "08:11"), "unavailable").trailing).toEqual({
      kind: "label",
      label: "Can't undo",
    });
  });

  it("should leave a row that was not offered Undo as it was, whatever the outcome", () => {
    expect(describeAssistantChangeRow(row("cant_undo", "08:11"), "undone").trailing).toEqual({
      kind: "label",
      label: "Can't undo",
    });
  });
});
