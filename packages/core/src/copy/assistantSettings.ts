/*
 * The words of the Assistant row in More and of the Assistant settings screen, as the approved mobile boards
 * print them (canvas "Ki-Lo assistant screens": `tab-shell.more · assistant-row` and
 * `assistant-settings · consent`). The two paragraphs of "What it does" and the Privacy policy label are
 * `ASSISTANT_CONSENT_CARD`, the same words the consent card on the sheet shows, so they are not repeated here.
 */

/**
 * The More row's sub line and value, which follow whether the assistant is on. Until the setting is read
 * (`isOn` undefined) the row has its title alone, as the Programme row does, so it is not drawn Off and then On.
 */
export function describeAssistantMoreRow(isOn: boolean | undefined): {
  title: string;
  subtitle: string | undefined;
  value: string | undefined;
} {
  if (isOn === undefined) {
    return { title: "Assistant", subtitle: undefined, value: undefined };
  }
  return isOn
    ? { title: "Assistant", subtitle: "Log and ask in your own words", value: "On" }
    : { title: "Assistant", subtitle: "Off until you turn it on", value: "Off" };
}

/** The caption under the "Use the assistant" switch. */
export function describeAssistantConsentCaption(isOn: boolean): string {
  return isOn
    ? "On. Open it from the Diary header or Describe in Log food."
    : "Off until you turn it on.";
}

/** The Assistant settings screen. "What the assistant changed" belongs to the screen that opens from it. */
export const ASSISTANT_SETTINGS = {
  title: "Assistant",
  back: "Back to More",
  useLabel: "Use the assistant",
  whatItDoes: "What it does",
  yourConversations: "Your conversations",
  deleteAllLabel: "Delete all conversations",
  deleteAllCaption: "Deleting conversations does not undo the changes in them.",
} as const;

/**
 * The confirmation before Delete all conversations. The boards draw none, and the delete cannot be undone, so
 * this is KEY-695's recommendation and awaits Zee. Its frame is added to the canvas later.
 */
export const ASSISTANT_DELETE_ALL_DIALOG = {
  title: "Delete all conversations?",
  body: "This removes every conversation with the assistant. Changes it made to your diary and recipes stay, and you can still undo them from What the assistant changed.",
  confirmLabel: "Delete",
  cancelLabel: "Keep them",
} as const;
