import { useProfileTimeZone, useSyncTimeZone, useTermsAcceptance } from "@keylow/api-client";
import { TERMS_VERSION } from "@keylow/core/copy";
import { needsTermsAcceptance } from "@keylow/core/terms";
import { useEffect, useState } from "react";

const readDeviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Keeps the profile's time zone equal to the browser's, with no page of its own. The zone is read when it
 * mounts and again each time the tab becomes visible, since a user can travel with the tab open. Nothing is
 * read or written until the account has accepted the current Terms. An acceptance that is not known yet
 * counts as not accepted. Mount it once, where a user is signed in.
 */
export function useDeviceTimeZoneSync(): void {
  const acceptance = useTermsAcceptance();
  const isEnabled = !needsTermsAcceptance(acceptance.data ?? null, TERMS_VERSION);
  const profileTimeZone = useProfileTimeZone({ enabled: isEnabled });
  const [deviceTimeZone, setDeviceTimeZone] = useState(readDeviceTimeZone);

  useEffect(() => {
    const readWhenVisible = () => {
      if (document.visibilityState === "visible") {
        setDeviceTimeZone(readDeviceTimeZone());
      }
    };

    document.addEventListener("visibilitychange", readWhenVisible);

    return () => {
      document.removeEventListener("visibilitychange", readWhenVisible);
    };
  }, []);

  useSyncTimeZone({ deviceTimeZone, profileTimeZone: profileTimeZone.data, enabled: isEnabled });
}
