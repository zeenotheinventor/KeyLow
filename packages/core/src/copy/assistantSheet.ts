/*
 * The words of the assistant sheet, as the approved mobile boards print them (canvas "Ki-Lo assistant
 * screens", `assistant · empty`, `streaming`, `conversation`, `unavailable`). The notice, offline and stopped
 * words are in `assistantNotices.ts`, and the not-medical-advice line too.
 */
export const ASSISTANT_SHEET = {
  /** The sheet's title and the Diary header button's name. */
  title: "Assistant",
  newConversationLabel: "New conversation",
  closeLabel: "Close",
  sendLabel: "Send",
  /** The message field's accessible name. The boards draw no label, because the placeholder says it. */
  composerLabel: "Message",
  emptyHeading: "Log food or ask about your diary",
  emptyLede: "Say it in your own words. Every change shows here with Undo.",
  /** Names the starters' list for a screen reader. The boards draw no heading over it. */
  startersLabel: "Starters",
  /** Names the group of quick replies, such as Ask again, for a screen reader. */
  quickRepliesLabel: "Quick replies",
  /** Each sends its words as your message. */
  starters: [
    "Log 2 eggs and toast at 08:10",
    "What's left for today?",
    "Copy yesterday to today",
    "Add a recipe from a link",
  ],
  composerPlaceholder: "Log food or ask about your diary",
  /** Who said a message, as a screen reader hears it first. The boards draw neither word. */
  speakerYou: "You",
  speakerAssistant: "Assistant",
} as const;

/**
 * The note of a card whose Undo is off because the entries it made were changed in the diary since
 * (`assistant-card · undo-unavailable`). A card read back from the thread carries no such note, so the
 * sheet words it for the cards that make or copy diary entries.
 */
export const ASSISTANT_CARD_NOTES = {
  entriesChanged:
    "You changed these entries in your diary since, so Undo is off. Edit or delete them in the diary.",
} as const;

/**
 * The words of Describe, the second way into the assistant, from Log food (`assistant · describe` and the
 * Describe row on the Log food board). The sheet opened this way has its own intro in place of the starters,
 * and a line over the composer that says when the entries will be logged.
 */
export const ASSISTANT_DESCRIBE = {
  /** The row under Quick add in Log food, and its caption. */
  rowTitle: "Describe",
  rowCaption: "Say what you ate, the assistant logs it",
  emptyHeading: "Describe a meal",
  emptyLede:
    "Name each food and how much, in your own words: 2 eggs, a slice of toast, 150 g of rice. If a portion is unclear, the assistant asks.",
  composerPlaceholder: "Describe a meal",
  /** Follows the "Logs at 13:00" chip over the composer. */
  hintText: "Say what and how much",
} as const;

/** The chip over the composer that says the time the described food is logged at, `time` being `HH:MM`. */
export function describeLogsAt(time: string): string {
  return `Logs at ${time}`;
}
