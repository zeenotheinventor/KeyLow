export type WeightHeaderProps = {
  /**
   * Adds a weigh-in. The Add weigh-in button is drawn only when this is given, so a page whose dialog is not
   * built has no button that does nothing.
   */
  onAdd?: (() => void) | undefined;
};
