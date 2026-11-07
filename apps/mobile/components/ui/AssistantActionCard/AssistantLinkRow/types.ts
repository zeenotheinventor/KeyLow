export type AssistantLinkRowProps = {
  /** What the link opens, such as "Open in routine editor". Drawn exactly as given. */
  label: string;
  onPress: () => void;
  /**
   * Whether the row stands on its own in the thread, drawn as its own bordered row (`assistant-card · routine-updated`,
   * Removing a day). Else it is the last line of a card, set off from the lines above by a hairline.
   */
  isStandalone?: boolean | undefined;
};
