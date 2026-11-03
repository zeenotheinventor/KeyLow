import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getAssistantConsent } from "../repos/assistant";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads whether the signed in user turned the assistant on (`isOn`), and when and under which Terms
 * version (`consentedAt`, `version`). Turning it on or off refreshes it. `enabled` false makes no request,
 * as for the diary reads, so a screen that stays mounted under the terms gate waits for it.
 */
export function useAssistantConsent({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.assistant.consent,
    queryFn: () => getAssistantConsent(client),
    enabled,
  });
}
