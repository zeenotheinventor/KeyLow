import { useQuery } from "@tanstack/react-query";

import { useFunctionsUrl, useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getAssistantStatus } from "../repos/assistant";

/**
 * Loads the notice that would stop the assistant now (`data.notice`), or null when it is open, without
 * using a turn. The sheet opens on that board. It counts today's turns, so it can disagree with the turn
 * route: a notice that arrives in the stream of a send wins over what this said.
 */
export function useAssistantStatus() {
  const client = useSupabase();
  const functionsUrl = useFunctionsUrl();

  return useQuery({
    queryKey: keys.assistant.status,
    queryFn: ({ signal }) => getAssistantStatus(client, functionsUrl, signal),
  });
}
