export type MuscleSheetHeaderProps = {
  /** The muscle's name, which is the sheet's heading. */
  title: string;
  /** The line under it, such as the muscle's group, or null for none. */
  subtitle: string | null;
  onClose: () => void;
};
