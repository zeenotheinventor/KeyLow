import { RecentFoods } from "../RecentFoods";

import type { LogIdleProps } from "./types";

/** What the log search shows before anything is typed: Recent. */
export function LogIdle(props: LogIdleProps) {
  return <RecentFoods {...props} />;
}
