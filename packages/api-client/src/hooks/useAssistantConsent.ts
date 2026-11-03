import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getAssistantConsent } from "../repos/assistant";

/**
 * Loads whether the signed in user turned the assistant on (`isOn`), and when and under which Terms
 * version (`consentedAt`, `version`). Turning it on or off refreshes it.
 */
export function useAssistantConsent() {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.assistant.consent,
    queryFn: () => getAssistantConsent(client),
  });
}
