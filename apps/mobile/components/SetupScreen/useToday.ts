import { toLocalDate } from "@keylow/core/dates";

import { useNow } from "../../lib/useNow";

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Today as `YYYY-MM-DD` in the device's time zone, which moves on by itself at midnight. */
export function useToday(): string {
  return toLocalDate(useNow(), deviceTimeZone());
}
