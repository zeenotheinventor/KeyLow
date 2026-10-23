import { useMemo } from "react";

import { getHealthProvider } from "../../lib/health";
import { useHealthImportTriggers } from "../../lib/health/useHealthImportTriggers";

import type { HealthProvider } from "../../lib/health";

function ActiveHealthImportRunner({ provider }: { provider: HealthProvider }) {
  useHealthImportTriggers(provider);

  return null;
}

/**
 * Draws nothing. Imports weight from Health Connect when the app opens and returns to the foreground
 * (`useHealthImportTriggers`), and answers the pull to refresh. Where there is no Health provider it
 * mounts nothing, so no hook of the API client runs. Mount it once, where a person is signed in.
 */
export function HealthImportRunner() {
  const provider = useMemo(() => getHealthProvider(), []);

  return provider === null ? null : <ActiveHealthImportRunner provider={provider} />;
}
