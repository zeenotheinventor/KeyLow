import { useFoodByBarcode } from "@keylow/api-client";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { View } from "react-native";

import {
  BarcodeScanner,
  ScanResult,
  toScanOutcome,
  useBarcodeScan,
} from "../../components/BarcodeScanner";

import type { UseFoodByBarcodeOptions } from "@keylow/api-client";

const noLookup: UseFoodByBarcodeOptions = { enabled: false };

export default function ScanRoute() {
  const router = useRouter();
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

  // The stack keeps this screen mounted under the ones pushed over it, so a screen that is not in
  // focus never navigates: it could be the create form's save refreshing the lookup behind it.
  // Replacing the scan screen means back from the food goes to where the scan was started.
  useEffect(() => {
    if (isFocused && foundFoodId !== undefined) {
      router.replace(`/foods/${foundFoodId}`);
    }
  }, [isFocused, foundFoodId, router]);

  // Leaving the screen ends its scan. That drops the lookup, so saving a food on the form pushed
  // over this screen cannot refetch it, and what was showing is not stale when the screen is back.
  useFocusEffect(
    useCallback(() => {
      return () => {
        clearScan();
      };
    }, [clearScan]),
  );

  function cancel() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/foods");
    }
  }

  return (
    <View className="flex-1 bg-legacy-neutral-50">
      {scan === undefined ? null : (
        <ScanResult
          outcome={toScanOutcome(lookup)}
          onScanAgain={clearScan}
          onCreateFood={(code) => {
            router.push(`/foods/new?barcode=${code}`);
          }}
        />
      )}
      <BarcodeScanner
        isActive={scan === undefined && isFocused}
        onBarcodeScanned={handleBarcodeScanned}
        onCancel={cancel}
      />
    </View>
  );
}
