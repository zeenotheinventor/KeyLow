import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { healthAccessStep } from "./healthAccessStep";
import { readHealthConnection } from "./readHealthConnection";
import { useHealthImport } from "../../lib/health";

import type { HealthConnectionReading } from "./readHealthConnection";
import type { HealthAccessStep } from "./types";
import type { HealthImportResult, HealthPermissionResult, HealthProvider } from "../../lib/health";

export type HealthAccessFlow =
  | Readonly<{ phase: "checking" }>
  | Readonly<{ phase: "unsupported" }>
  | Readonly<{
      phase: "ready";
      step: HealthAccessStep;
      /** The rows the import stored, for the heading of the connected state. */
      importedCount: number;
      /** What the footer's main button does in the current step. */
      onPrimary: () => void;
    }>;

// A native call that fails leaves the screen as it is, because there is nothing else to do about it.
const ignoreFailure = () => undefined;

/**
 * The permissions flow: it reads the provider's availability and permission, answers the buttons, and asks
 * for an import through `importNow` only, never the provider's own read. `onFinish` is See your trend.
 * The runner never prompts, so this is the one place permission is asked for, and only for weight.
 */
export function useHealthAccessFlow(
  provider: HealthProvider,
  onFinish: () => void,
): HealthAccessFlow {
  const { importNow, isImporting: isRunnerImporting } = useHealthImport();
  const [checked, setChecked] = useState<HealthConnectionReading | null>(null);
  const [permissionAnswer, setPermissionAnswer] = useState<HealthPermissionResult | null>(null);
  const [isAskedImporting, setIsAskedImporting] = useState(false);
  const [result, setResult] = useState<HealthImportResult | null>(null);
  // Set once an import has been asked for, so joining a running one happens once and a double press asks once.
  const hasAsked = useRef(false);
  const isAskingPermission = useRef(false);

  const runImport = useCallback(async () => {
    hasAsked.current = true;
    setResult(null);
    setIsAskedImporting(true);
    const outcome = await importNow();
    setResult(outcome);
    setIsAskedImporting(false);
  }, [importNow]);

  useEffect(() => {
    let isCurrent = true;
    function check() {
      void readHealthConnection(provider).then((next) => {
        if (isCurrent) {
          setChecked(next);
          // Permission held again, as after it was granted in settings, makes an earlier denial stale.
          if (next.hasPermission) {
            setPermissionAnswer(null);
          }
        }
      });
    }

    check();
    // Returning from the Play Store, or from the system sheet, is when the answer may have changed.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        check();
      }
    });
    return () => {
      isCurrent = false;
      subscription.remove();
    };
  }, [provider]);

  // Opening the flow while the runner is importing joins that import, so the result lands here too.
  const canJoin = checked?.availability === "available" && checked.hasPermission;
  useEffect(() => {
    if (canJoin && isRunnerImporting && !hasAsked.current) {
      void runImport();
    }
  }, [canJoin, isRunnerImporting, runImport]);

  async function askForPermission() {
    if (isAskingPermission.current) {
      return;
    }
    isAskingPermission.current = true;
    const answer = await provider.requestPermission().catch((): HealthPermissionResult => "denied");
    isAskingPermission.current = false;
    setPermissionAnswer(answer);
    // An import may have been joined while the system sheet was open, and a second would end with nothing new.
    if (answer === "granted" && !hasAsked.current) {
      await runImport();
    }
  }

  if (checked === null) {
    return { phase: "checking" };
  }
  if (checked.availability === "unsupported") {
    return { phase: "unsupported" };
  }

  const step = healthAccessStep({
    availability: checked.availability,
    hasPermission: checked.hasPermission,
    permissionAnswer,
    isImporting: isRunnerImporting || isAskedImporting,
    importStatus: result?.status ?? null,
  });

  const primaryOf: Record<HealthAccessStep, () => void> = {
    explain: () => {
      void askForPermission();
    },
    install: () => {
      provider.openInstallPage().catch(ignoreFailure);
    },
    connecting: ignoreFailure,
    denied: () => {
      provider.openSettings().catch(ignoreFailure);
    },
    "import-error": () => {
      void runImport();
    },
    connected: onFinish,
  };

  return { phase: "ready", step, importedCount: result?.inserted ?? 0, onPrimary: primaryOf[step] };
}
