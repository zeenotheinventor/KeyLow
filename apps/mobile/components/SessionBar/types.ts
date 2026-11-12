import type { SessionBarView } from "@keylow/api-client";

/** What the bar shows of the open session (`useSessionBarView`'s), and how it opens it. */
export type SessionBarProps = SessionBarView & {
  onPress: () => void;
};
