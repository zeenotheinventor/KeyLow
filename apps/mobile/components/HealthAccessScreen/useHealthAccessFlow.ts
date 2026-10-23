import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { healthAccessStep } from "./healthAccessStep";
import { readHealthConnection } from "./readHealthConnection";
import { useHealthImport } from "../../lib/health";

import type { HealthConnectionReading } from "./readHealthConnection";
import type { HealthAccessMode, HealthAccessStep } from "./types";
import type {
  BodyCompositionAccess,
  HealthImportResult,
  HealthPermissionResult,
  HealthProvider,
} from "../../lib/health";

export type HealthAccessFlow =
  | Readonly<{ phase: "checking" }>
  | Readonly<{ phase: "unsupported" }>
  | Readonly<{
      phase: "ready";
      step: HealthAccessStep;
      /** The rows the import stored, for the heading of the connected state. */
      importedCount: number;
      /** The body composition rows the import stored, for the counts line. */
      bodyCounts: Readonly<{ bodyFat: number; leanMass: number }>;
      /** The body types Ki-Lo may read, for the words of the connecting and partial states. */
      bodyCompositionAccess: BodyCompositionAccess;
      /** What the footer's main button does in the current step. */
      onPrimary: () => void;
      /** The action of `connected-partial`: it moves the same screen to the add-later flow. */
      onAddBodyComposition: () => void;
    }>;

// A native call that fails leaves the screen as it is, because there is nothing else to do about it.
const ignoreFailure = () => undefined;

const noBodyComposition: BodyCompositionAccess = { bodyFat: false, leanMass: false };

/**
 * The permissions flow: it reads the provider's availability and permission, answers the buttons, and asks
 * for an import through `importNow` only, never the provider's own read. `onFinish` is See your trend.
 * The runner never prompts, so this is the one place permission is asked for, and only for weight, body fat
 * and lean mass. The first-time flow asks for all three in one request. The add-later flow, for a person
 * whose weight is held, asks for the two body types only.
 */
export function useHealthAccessFlow(
  provider: HealthProvider,
  onFinish: () => void,
  initialMode: HealthAccessMode,
): HealthAccessFlow {
  const { importNow, isImporting: isRunnerImporting } = useHealthImport();
  const [checked, setChecked] = useState<HealthConnectionReading | null>(null);
  const [permissionAnswer, setPermissionAnswer] = useState<HealthPermissionResult | null>(null);
  // Decided once, when the first check answers, and sticky after: weight granted a moment later must not
  // turn a first-time flow into the add-later one while its import runs.
  const [mode, setMode] = useState<HealthAccessMode>("first");
  const hasDecidedMode = useRef(false);
  const [hasAskedBodyComposition, setHasAskedBodyComposition] = useState(false);
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
          if (!hasDecidedMode.current) {
            hasDecidedMode.current = true;
            setMode(
              initialMode === "add-body-composition" && next.hasPermission
                ? "add-body-composition"
                : "first",
            );
          }
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
  }, [provider, initialMode]);

  // Weight granted a moment ago counts as held, as the partial block's action needs, and the mode is not read from it.
  const hasWeightAccess = checked?.hasPermission === true || permissionAnswer === "granted";
  const bodyCompositionAccess = checked?.bodyCompositionAccess ?? noBodyComposition;
  const hasEitherBodyType = bodyCompositionAccess.bodyFat || bodyCompositionAccess.leanMass;

  // Opening the first-time flow while the runner is importing joins that import, so the result lands here
  // too. The add-later flow joins nothing, because the person has not been asked yet.
  const canJoin =
    mode === "first" && checked?.availability === "available" && checked.hasPermission;
  useEffect(() => {
    if (canJoin && isRunnerImporting && !hasAsked.current) {
      void runImport();
    }
  }, [canJoin, isRunnerImporting, runImport]);

  // In the add-later flow a body type that is held once the request is answered is read at once. This also
  // covers a type turned on in Health Connect after a denial, when the access is read again on returning.
  const shouldImportBodyComposition =
    mode === "add-body-composition" && hasAskedBodyComposition && hasEitherBodyType;
  useEffect(() => {
    if (shouldImportBodyComposition && !hasAsked.current) {
      void runImport();
    }
  }, [shouldImportBodyComposition, runImport]);

  async function askForPermission() {
    if (isAskingPermission.current) {
      return;
    }
    isAskingPermission.current = true;
    const answer = await provider
      .requestPermission({ includeBodyComposition: true })
      .catch((): HealthPermissionResult => "denied");
    // Weight is what connected means, so a refusal needs no look at the body types.
    const access =
      answer === "granted"
        ? await provider.bodyCompositionAccess().catch(() => noBodyComposition)
        : noBodyComposition;
    isAskingPermission.current = false;
    setChecked((current) => current && { ...current, bodyCompositionAccess: access });
    setPermissionAnswer(answer);
    // An import may have been joined while the system sheet was open, and a second would end with nothing new.
    if (answer === "granted" && !hasAsked.current) {
      await runImport();
    }
  }

  async function askForBodyComposition() {
    if (isAskingPermission.current) {
      return;
    }
    isAskingPermission.current = true;
    const access = await provider.requestBodyCompositionPermission().catch(() => noBodyComposition);
    isAskingPermission.current = false;
    setChecked((current) => current && { ...current, bodyCompositionAccess: access });
    setHasAskedBodyComposition(true);
  }

  function addBodyComposition() {
    hasAsked.current = false;
    setResult(null);
    setHasAskedBodyComposition(false);
    setMode("add-body-composition");
  }

  if (checked === null) {
    return { phase: "checking" };
  }
  if (checked.availability === "unsupported") {
    return { phase: "unsupported" };
  }

  const step = healthAccessStep({
    availability: checked.availability,
    hasPermission: hasWeightAccess,
    permissionAnswer,
    bodyCompositionAccess,
    mode,
    hasAskedBodyComposition,
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
    "explain-body-composition": () => {
      void askForBodyComposition();
    },
    "denied-body-composition": () => {
      provider.openSettings().catch(ignoreFailure);
    },
    "connected-partial": onFinish,
  };

  return {
    phase: "ready",
    step,
    importedCount: result?.inserted ?? 0,
    bodyCounts: {
      bodyFat: result?.body.bodyFat.inserted ?? 0,
      leanMass: result?.body.leanMass.inserted ?? 0,
    },
    bodyCompositionAccess,
    onPrimary: primaryOf[step],
    onAddBodyComposition: addBodyComposition,
  };
}
