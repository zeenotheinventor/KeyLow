export type SeeMoreButtonProps = {
  /** What the button says, such as "See 2 more". */
  text: string;
  /** What a screen reader says: the text and where it applies. */
  label: string;
  onPress: () => void;
};
