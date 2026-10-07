import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect } from "react";
import { AppState, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { CameraPermissionPrompt } from "./CameraPermissionPrompt";
import { SCANNABLE_BARCODE_TYPES } from "./symbology";

import type { BarcodeScannerProps } from "./types";

// One object for the life of the app, so the native camera is not reconfigured on every render.
const barcodeScannerSettings = { barcodeTypes: SCANNABLE_BARCODE_TYPES };

export function BarcodeScanner({ isActive, onBarcodeScanned, onCancel }: BarcodeScannerProps) {
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
    return <View className="flex-1 bg-neutral-50" />;
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
    <View className="flex-1 bg-neutral-900">
      <View
        accessible
        accessibilityLabel="Barcode viewfinder"
        className="flex-1 items-center justify-center overflow-hidden"
      >
        {/* The camera view takes no class, so it fills the viewfinder through its style prop. */}
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={barcodeScannerSettings}
          onBarcodeScanned={onBarcodeScanned}
        />
        <View className="pointer-events-none h-40 w-72 rounded-lg border-2 border-neutral-50" />
      </View>
      <View className="gap-4 px-6 py-6">
        <Text className="text-center text-base text-neutral-50">
          Point the camera at a food barcode
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          className="h-12 items-center justify-center rounded-lg border border-neutral-50"
        >
          <Text className="text-base font-semibold text-neutral-50">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
