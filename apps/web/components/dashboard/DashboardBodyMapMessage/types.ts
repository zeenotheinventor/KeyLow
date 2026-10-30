export type DashboardBodyMapMessageProps = {
  /** A read failed, or there is no connection and nothing was saved to show. */
  kind: "failed" | "offline";
};
