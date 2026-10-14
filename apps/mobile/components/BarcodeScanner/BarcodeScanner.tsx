import { BARCODE_SCAN } from "@keylow/core/copy";
import { CameraView, useCameraPermissions } from "expo-camera";
import { cssInterop } from "nativewind";
import { useEffect } from "react";
import { AppState, Linking, View } from "react-native";

import { CameraPermissionPrompt } from "./CameraPermissionPrompt";
import { SCANNABLE_BARCODE_TYPES } from "./symbology";
import { Text } from "../ui";

import type { BarcodeScannerProps } from "./types";

// The camera view takes its look from a `style` prop, so this lets it take a class, as every other view does.
cssInterop(CameraView, { className: "style" });

// One object for the life of the app, so the native camera is not reconfigured on every render.
const barcodeScannerSettings = { barcodeTypes: SCANNABLE_BARCODE_TYPES };

/**
 * The camera with its viewfinder and the hint beneath, or the permission prompt that stands in for it.
 * It sits under the screen's header and its bottom inset is the screen's `--inset-bottom` variable,
 * which the hint's panel pads itself with, so the panel runs to the edge of the screen.
 */
export function BarcodeScanner({ isActive, onBarcodeScanned }: BarcodeScannerProps) {
  const [permission, requestPermission, getPermission] = useCameraPermissions();

  // The permission is only read when the hook mounts. A user who allowed the camera in the
  // settings app comes back to a stale refusal unless it is read again on return.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void getPermission();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [getPermission]);

  if (!isActive) {
    return null;
  }

  // The permission is unknown for the moment it takes to read it, which needs no screen of its own.
  if (permission === null) {
    return <View className="flex-1" />;
  }

  if (!permission.granted) {
    return (
      <CameraPermissionPrompt
        canAskAgain={permission.canAskAgain}
        onAllowCamera={() => void requestPermission()}
        onOpenSettings={() => void Linking.openSettings()}
      />
    );
  }

  return (
    <View className="flex-1">
      <View
        accessible
        aria-label={BARCODE_SCAN.viewfinderLabel}
        className="flex-1 items-center justify-center overflow-hidden bg-camera"
        role="img"
      >
        <CameraView
          barcodeScannerSettings={barcodeScannerSettings}
          className="absolute inset-0"
          onBarcodeScanned={onBarcodeScanned}
        />
        {/* The design's 288 by 160 frame is the size inside its 2 point border, which is 292 by 164 here. */}
        <View className="pointer-events-none h-[164px] w-[292px] rounded-medium border-2 border-accent viewfinder-dim" />
      </View>
      <View className="border-t border-border bg-surface-sheet px-4 pb-[var(--inset-bottom)] pt-4">
        <Text className="text-center">{BARCODE_SCAN.hint}</Text>
      </View>
    </View>
  );
}
