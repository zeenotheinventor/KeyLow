import { Pressable, Text, View } from "react-native";

import type { CameraPermissionPromptProps } from "./types";

export function CameraPermissionPrompt({
  canAskAgain,
  onAllowCamera,
  onOpenSettings,
}: CameraPermissionPromptProps) {
  return (
    <View className="flex-1 justify-center gap-4 bg-legacy-neutral-50 px-6">
      <View className="gap-2">
        <Text accessibilityRole="header" className="text-2xl font-semibold text-legacy-neutral-900">
          {canAskAgain ? "Camera access" : "Camera access is off"}
        </Text>
        <Text className="text-base text-legacy-neutral-500">
          {canAskAgain
            ? "KeyLow uses the camera to scan food barcodes so you can look up a product without typing."
            : "KeyLow cannot scan barcodes without the camera. Open the settings, allow camera access for KeyLow, then come back to scan."}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={canAskAgain ? onAllowCamera : onOpenSettings}
        className="h-12 items-center justify-center rounded-lg bg-legacy-brand-600"
      >
        <Text className="text-base font-semibold text-legacy-neutral-50">
          {canAskAgain ? "Allow camera" : "Open settings"}
        </Text>
      </Pressable>
    </View>
  );
}
