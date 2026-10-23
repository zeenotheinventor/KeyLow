export type WeightEmptyStateProps = {
  /**
   * Opens the Health Connect permission flow. Leave it out where the flow is not offered (no Health Connect,
   * or it is connected already) and the secondary button is not drawn.
   */
  onConnectHealth?: (() => void) | undefined;
};
