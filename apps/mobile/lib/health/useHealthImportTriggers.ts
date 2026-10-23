import { useImportWeighIns, useProfileTimeZone, useSupabase } from "@keylow/api-client";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { loadLastImport, registerHealthImporter, startHealthImport } from "./healthImportStore";
import { useReadsEnabled } from "../useReadsEnabled";

import type { HealthProvider } from "./HealthProvider";
import type { HealthImportResult } from "./importRunner";

/** What the importer gives when it did not start: nobody signed in, or the time zone not loaded yet. */
const notReady: HealthImportResult = { status: "unavailable", read: 0, skipped: 0, inserted: 0 };

/**
 * Starts the weight import: once when it mounts and each time the app comes back to the foreground, and
 * it registers the importer that `importHealthNow` (the pull to refresh) calls. Nothing runs in the
 * background. It imports only for a signed in person whose account has accepted the Terms, with the
 * profile's time zone loaded. Until then the importer answers `unavailable` and the shared state is left
 * alone. Mount it once, where a person is signed in, and only where there is a provider.
 */
export function useHealthImportTriggers(provider: HealthProvider): void {
  const client = useSupabase();
  const isEnabled = useReadsEnabled();
  const profileTimeZone = useProfileTimeZone({ enabled: isEnabled });
  const { mutateAsync: importWeighIns } = useImportWeighIns();

  // A profile with no zone reads in UTC, as every other screen does.
  const timeZone =
    !isEnabled || profileTimeZone.data === undefined ? null : (profileTimeZone.data ?? "UTC");

  const readUserId = useCallback(
    () =>
      client.auth.getSession().then(
        ({ data }) => data.session?.user.id ?? null,
        () => null,
      ),
    [client],
  );

  const importNow = useCallback(async (): Promise<HealthImportResult> => {
    const userId = await readUserId();
    if (userId === null || timeZone === null) {
      return notReady;
    }
    return startHealthImport({
      userId,
      provider,
      timeZone,
      importWeighIns,
      now: () => new Date(),
    });
  }, [readUserId, provider, timeZone, importWeighIns]);

  // Registered once for as long as the runner is mounted, calling whichever importer is the latest, so a
  // time zone arriving does not unregister it (which would empty the state).
  const latestImportNow = useRef(importNow);
  useEffect(() => {
    latestImportNow.current = importNow;
  }, [importNow]);
  useEffect(() => registerHealthImporter(() => latestImportNow.current()), []);

  useEffect(() => {
    void readUserId()
      .then((userId) => (userId === null ? undefined : loadLastImport(userId)))
      .catch(() => undefined);
  }, [readUserId]);

  useEffect(() => {
    if (timeZone === null) {
      return undefined;
    }
    void importNow();
    const subscription = AppState.addEventListener("change", (appState) => {
      if (appState === "active") {
        void importNow();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [timeZone, importNow]);
}
