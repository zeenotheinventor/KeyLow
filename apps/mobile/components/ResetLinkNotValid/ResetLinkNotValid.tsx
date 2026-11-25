import { RESET_LINK_INVALID, describeResetLinkInvalid } from "@keylow/core/copy";
import { View } from "react-native";

import { AuthMessage } from "../AuthMessage";

import type { ResetLinkNotValidProps } from "./types";

/**
 * What the auth callback shows when a password reset link could not be used, as the reset-link-error board
 * draws it: a danger message with Send a new link as the main action and Back to sign in under it.
 */
export function ResetLinkNotValid({ onSendNewLink, onBackToSignIn }: ResetLinkNotValidProps) {
  return (
    <View className="flex-1 bg-background">
      <AuthMessage
        body={describeResetLinkInvalid("phone")}
        icon="TriangleAlert"
        primary={{ label: RESET_LINK_INVALID.sendNewLinkLabel, onPress: onSendNewLink }}
        secondary={{ label: RESET_LINK_INVALID.backToSignInLabel, onPress: onBackToSignIn }}
        title={RESET_LINK_INVALID.title}
        tone="danger"
      />
    </View>
  );
}
