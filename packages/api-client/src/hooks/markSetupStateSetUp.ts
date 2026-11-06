import { keys } from "../queryKeys";

import type { SetupState } from "../repos/setup";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Says in the cache that the account is set up, as a save or the escape has just made it. The invalidation that
 * follows is not awaited, so until the read comes back the cache would still say the account is not set up, and the
 * first run gate would send the person straight back to the wizard they have just left. With nothing cached
 * there is nothing to correct, and nothing is made up.
 */
export function markSetupStateSetUp(queryClient: QueryClient): void {
  queryClient.setQueryData<SetupState>(keys.profiles.setupState, (cached) =>
    cached === undefined ? undefined : { ...cached, isSetUp: true },
  );
}
