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
        "Undo works while an item is as the assistant left it. Once you change it in the diary, the recipe editor or Train, change it there. Undo on training waits while a workout is in progress.",
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

const trainingRow = (
  kind: "routine_updated" | "exercise_updated" | "set_updated" = "routine_updated",
  state: AssistantChangeRow["state"] = "undo",
): AssistantChangeRow => ({
  key: "a1",
  actionIds: ["a1", "a2", "a3"],
  title: "Updated routine Push Pull Legs",
  sub: "08:12 · 4 changes",
  state,
  training: {
    kind,
    changedSinceDetail: kind === "exercise_updated" ? "changed since" : "changed in the app since",
  },
});

describe("describeAssistantChangeRow, a training row", () => {
  it("should draw Undo as any row, while no workout is in progress", () => {
    expect(describeAssistantChangeRow(trainingRow(), null).trailing).toEqual({
      kind: "action",
      label: "Undo",
    });
  });

  it("should draw Can't undo yet as a plain label, with no button, while a workout is in progress", () => {
    expect(describeAssistantChangeRow(trainingRow(), null, { workoutInProgress: true })).toEqual({
      title: "Updated routine Push Pull Legs",
      subtitle: "08:12 · 4 changes",
      titleTone: "primary",
      trailing: { kind: "label", label: "Can't undo yet" },
    });
  });

  it("should draw Undo again once the workout ends", () => {
    expect(
      describeAssistantChangeRow(trainingRow(), null, { workoutInProgress: false }).trailing.kind,
    ).toBe("action");
  });

  it("should not hold back a row that is undone or cannot be undone", () => {
    expect(
      describeAssistantChangeRow(trainingRow("routine_updated", "undone"), null, {
        workoutInProgress: true,
      }).trailing,
    ).toEqual({ kind: "label", label: "Undone" });
    expect(
      describeAssistantChangeRow(trainingRow("routine_updated", "cant_undo"), null, {
        workoutInProgress: true,
      }).trailing,
    ).toEqual({ kind: "label", label: "Can't undo" });
  });

  describe("a press refused because a workout is in progress", () => {
    const refused = { state: "unavailable", reason: "workout_in_progress" } as const;

    it("should keep reading Can't undo yet while the workout lasts", () => {
      expect(
        describeAssistantChangeRow(trainingRow(), refused, { workoutInProgress: true }).trailing,
      ).toEqual({ kind: "label", label: "Can't undo yet" });
    });

    it("should let go of the refusal and offer Undo once the workout has ended", () => {
      const look = describeAssistantChangeRow(trainingRow(), refused, { workoutInProgress: false });

      expect(look.trailing).toEqual({ kind: "action", label: "Undo" });
      expect(look.subtitle).toBe("08:12 · 4 changes");
    });
  });

  describe("a press refused because the item changed", () => {
    it.each(["changed", "active", "logged", "used"] as const)(
      "should read Can't undo, with the sub changed in the app since, for reason %s",
      (reason) => {
        const look = describeAssistantChangeRow(trainingRow(), { state: "unavailable", reason });

        expect(look.trailing).toEqual({ kind: "label", label: "Can't undo" });
        expect(look.subtitle).toBe("08:12 · changed in the app since");
      },
    );

    it("should read changed since for an exercise, which has no screen", () => {
      const look = describeAssistantChangeRow(trainingRow("exercise_updated"), {
        state: "unavailable",
        reason: "changed",
      });

      expect(look.subtitle).toBe("08:12 · changed since");
    });

    it("should leave the sub alone when the answer gave no reason", () => {
      const look = describeAssistantChangeRow(trainingRow(), "unavailable");

      expect(look.trailing).toEqual({ kind: "label", label: "Can't undo" });
      expect(look.subtitle).toBe("08:12 · 4 changes");
    });
  });
});

describe("describeAssistantChangeRow, an Undo that put some back", () => {
  const partial = { state: "partial", undone: 2, total: 3 } as const;

  it("should say Can't undo and what was put back, on three sets", () => {
    const row: AssistantChangeRow = {
      ...trainingRow("set_updated"),
      title: "Changed 3 sets in Legs",
      sub: "09:02 · Thu 8 Oct",
    };

    const look = describeAssistantChangeRow(row, partial);

    expect(look.trailing).toEqual({ kind: "label", label: "Can't undo" });
    expect(look.subtitle).toBe("09:02 · Put back 2 of 3 sets");
  });

  it("should wait, as Can't undo yet, while a workout refused the rest, and keep what was put back", () => {
    const look = describeAssistantChangeRow(
      trainingRow("set_updated"),
      { ...partial, reason: "workout_in_progress" },
      { workoutInProgress: true },
    );

    expect(look.trailing).toEqual({ kind: "label", label: "Can't undo yet" });
    expect(look.subtitle).toBe("08:12 · Put back 2 of 3 sets");
  });

  it("should offer Undo again once the workout that refused the rest has ended", () => {
    const look = describeAssistantChangeRow(
      trainingRow("set_updated"),
      { ...partial, reason: "workout_in_progress" },
      { workoutInProgress: false },
    );

    expect(look.trailing).toEqual({ kind: "action", label: "Undo" });
    expect(look.subtitle).toBe("08:12 · 4 changes");
  });

  it("should say changes on a row that is not of sets, food rows included", () => {
    expect(describeAssistantChangeRow(row("undo", "08:11 · 2 entries"), partial).subtitle).toBe(
      "08:11 · Undid 2 of 3 changes",
    );
  });

  it("should leave a row that was not offered Undo as it was", () => {
    expect(describeAssistantChangeRow(row("undone", "08:11"), partial).subtitle).toBe("08:11");
  });
});
