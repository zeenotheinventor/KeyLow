export type DashboardHeatBodyMapProps = {
  /** False makes no request, while the terms gate is up. */
  isReadEnabled: boolean;
  /** Whether the stored choice of chart has been read, which the card waits for so it never draws Heat first by mistake. */
  isChartReady: boolean;
};
