export type GoogleButtonProps = {
  /** Dims the button to 40 percent and stops it responding, as the boards draw it while a sign in is under way. */
  disabled?: boolean;
  /** The sign in board's large button by default. The sign up board draws it at the default medium. */
  size?: "md" | "lg";
  onPress: () => void;
};
