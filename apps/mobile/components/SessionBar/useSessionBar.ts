import { useSessionBarView } from "@keylow/api-client";

import { useOpenSession } from "../../lib/useOpenSession";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { SessionBarProps } from "./types";

/**
 * What the session bar shows, or null when there is no bar. The rules for that, the total and the sets are
 * `useSessionBarView`'s, which the web bar reads too. The phone adds the one thing that differs: the reads
 * wait for the Terms (the tabs stay mounted under the gate's cover) and a press opens the session screen.
 */
export function useSessionBar(): SessionBarProps | null {
  const enabled = useReadsEnabled();
  const view = useSessionBarView({ enabled });
  const onPress = useOpenSession();

  return view === null ? null : { ...view, onPress };
}
