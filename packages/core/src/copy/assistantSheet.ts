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
