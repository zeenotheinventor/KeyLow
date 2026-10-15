export type AddButtonProps = {
  /** The accessible name, such as "Find food". */
  label: string;
  onPress: () => void;
  /** Dims the button to 40 percent and stops it responding, such as while offline. Defaults to false. */
  disabled?: boolean | undefined;
};
