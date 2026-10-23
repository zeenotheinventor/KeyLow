import { useFoodByBarcode } from "@keylow/api-client";
import { BARCODE_SCAN } from "@keylow/core/copy";
import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { vars } from "nativewind";
import { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BarcodeScanner,
  ScanResult,
  toScanOutcome,
  useBarcodeScan,
} from "../../components/BarcodeScanner";
import { SheetHeader } from "../../components/ui";
import { finishIngredientScan } from "../../lib/ingredientScan";
import {
  readIngredientRequestId,
  readLogContext,
  useCloseFoodsSheet,
  withLogContext,
} from "../../lib/navigation";

import type { UseFoodByBarcodeOptions } from "@keylow/api-client";

const noLookup: UseFoodByBarcodeOptions = { enabled: false };

export default function ScanRoute() {
  const router = useRouter();
  const closeSheet = useCloseFoodsSheet();
  const { day, time, ingredient } = useLocalSearchParams<{
    day?: string;
    time?: string;
    ingredient?: string;
  }>();
  // With a request from the recipe editor the scanner is in ingredient mode: a hit goes back to the editor,
  // never to the diary, so the day and the time of a log are not read.
  const ingredientRequestId = readIngredientRequestId(ingredient);
  const logContext = ingredientRequestId === undefined ? readLogContext({ day, time }) : undefined;
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { scan, handleBarcodeScanned, clearScan } = useBarcodeScan(isFocused);
  const lookup = useFoodByBarcode(
    scan?.rawCode ?? "",
    scan === undefined
      ? noLookup
      : { enabled: true, ...(scan.symbology === undefined ? {} : { symbology: scan.symbology }) },
  );

  const foundFoodId =
    scan !== undefined && lookup.error === null && lookup.result?.status === "found"
      ? lookup.result.food.id
      : undefined;

  // Where a hit goes: the portion picker, the page a search result opens, with the scanned code and, when the
  // sheet carries them, the day and the time. With no day the picker opens on now, as it does for a search.
  const foundHref =
    foundFoodId === undefined || scan === undefined || ingredientRequestId !== undefined
      ? undefined
      : withLogContext(`/foods/${foundFoodId}/log`, logContext, { barcode: scan.rawCode });

  // The stack keeps this screen mounted under the ones pushed over it, so a screen that is not in
  // focus never navigates: it could be the create form's save refreshing the lookup behind it.
  // Replacing the scan screen means back from the food goes to where the scan was started.
  useEffect(() => {
    if (isFocused && foundHref !== undefined) {
      router.replace(foundHref);
    }
  }, [isFocused, foundHref, router]);

  // In ingredient mode a hit goes back to the editor that asked for it and the whole sheet closes, so the
  // editor is under it, as it was left. The ref is defence in depth: the effect would run again if
  // `closeSheet` changed identity, and the food must be handed back once.
  const hasHandedBackRef = useRef(false);
  useEffect(() => {
    if (foundFoodId === undefined) {
      hasHandedBackRef.current = false;
      return;
    }
    if (isFocused && ingredientRequestId !== undefined && !hasHandedBackRef.current) {
      hasHandedBackRef.current = true;
      finishIngredientScan(ingredientRequestId, foundFoodId);
      closeSheet();
    }
  }, [isFocused, foundFoodId, ingredientRequestId, closeSheet]);

  // Leaving the screen ends its scan. That drops the lookup, so saving a food on the form pushed
  // over this screen cannot refetch it, and what was showing is not stale when the screen is back.
  useFocusEffect(
    useCallback(() => {
      return () => {
        clearScan();
      };
    }, [clearScan]),
  );

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/foods");
    }
  }

  return (
    // The insets are runtime values no class can name, so they go through variables, as the search sheet's
    // do. The camera's hint and the result's actions read the bottom one.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: BARCODE_SCAN.backLabel, onPress: goBack }}
        title={BARCODE_SCAN.title}
        trailing={{ icon: "X", label: BARCODE_SCAN.closeLabel, onPress: closeSheet }}
        variant="stack"
      />
      {scan === undefined ? null : (
        <ScanResult
          code={scan.rawCode}
          outcome={toScanOutcome(lookup)}
          onScanAgain={clearScan}
          // A recipe has no way to continue from the form yet, and the diary's leads to the portion picker.
          onCreateFood={
            ingredientRequestId === undefined
              ? (code) => {
                  router.push(withLogContext("/foods/new", logContext, { barcode: code }));
                }
              : undefined
          }
        />
      )}
      <BarcodeScanner
        isActive={scan === undefined && isFocused}
        onBarcodeScanned={handleBarcodeScanned}
      />
    </View>
  );
}
