import { CAMERA_PERMISSION } from "@keylow/core/copy";
import { View } from "react-native";

import { Button, Icon, Text } from "../../ui";

import type { CameraPermissionPromptProps } from "./types";

/**
 * What stands in for the camera until it may be used: why it is wanted, with the one action that gets it.
 * The design draws the message in an empty state's tile, but with a primary full width action, which the
 * kit's empty state does not take, so the tile is drawn here from the same pieces.
 */
export function CameraPermissionPrompt({
  canAskAgain,
  onAllowCamera,
  onOpenSettings,
}: CameraPermissionPromptProps) {
  const copy = canAskAgain ? CAMERA_PERMISSION.ask : CAMERA_PERMISSION.denied;

  return (
    <View className="flex-1 items-center justify-center gap-2 px-8 pb-[96px]">
      <View className="mb-2 h-[56px] w-[56px] items-center justify-center rounded-medium bg-surface-raised">
        <Icon name={canAskAgain ? "Camera" : "CameraOff"} size="xl" tone="muted" />
      </View>
      <Text className="text-center" role="heading" variant="h2">
        {copy.title}
      </Text>
      <Text className="text-center" tone="secondary">
        {copy.body}
      </Text>
      <Button
        className="mt-4"
        fullWidth
        size="lg"
        onPress={canAskAgain ? onAllowCamera : onOpenSettings}
      >
        {copy.action}
      </Button>
    </View>
  );
}
