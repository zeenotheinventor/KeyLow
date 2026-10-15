import { isValidTimeZone } from "@keylow/core/dates";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { updateMyTimeZone } from "../repos/targets";

export type UseSyncTimeZoneInput = {
  /** The zone the device reports now. Anything that is not a valid IANA name is ignored. */
  deviceTimeZone: string;
  /** The zone on the profile (`useProfileTimeZone`), or null or undefined while it is not known. */
  profileTimeZone: string | null | undefined;
  /** False writes nothing: signed out, or the terms not accepted yet. */
  enabled: boolean;
};

/**
 * Keeps the profile's time zone equal to the device's, with no visible result. It writes only when it
 * is enabled, the device zone is valid, the profile zone is known and the two differ, and at most once
 * for each device zone until it is disabled (so a failing write cannot loop, and the next app open tries
 * again). A failed write is ignored. After a success the profile time zone and the whole diary are
 * invalidated, so the diary regroups into the new zone at once. The zone is never logged.
 */
export function useSyncTimeZone({
  deviceTimeZone,
  profileTimeZone,
  enabled,
}: UseSyncTimeZoneInput): void {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const attemptedZones = useRef(new Set<string>());

  const { mutate } = useMutation({
    mutationFn: (timeZone: string) => updateMyTimeZone(client, timeZone),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.profiles.timeZone }),
        queryClient.invalidateQueries({ queryKey: keys.diary.all }),
      ]),
  });

  useEffect(() => {
    if (!enabled) {
      // Whoever signs in next starts afresh.
      attemptedZones.current.clear();
      return;
    }
    if (
      !isValidTimeZone(deviceTimeZone) ||
      profileTimeZone == null ||
      profileTimeZone === deviceTimeZone ||
      attemptedZones.current.has(deviceTimeZone)
    ) {
      return;
    }

    attemptedZones.current.add(deviceTimeZone);
    mutate(deviceTimeZone);
  }, [enabled, deviceTimeZone, profileTimeZone, mutate]);
}
