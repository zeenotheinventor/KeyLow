import { AUTH_SCREEN, SIGN_IN_LINK_INVALID } from "@keylow/core/copy";
import { View } from "react-native";

import { ErrorState } from "../ui";

import type { LinkNotValidProps } from "./types";

/**
 * What the auth callback shows when an email link could not be used, as the signing-in-link-error board
 * draws it: the kit's error state with the fixed sentence for a link that is not valid and a plain
 * button back to sign in, on the background.
 */
export function LinkNotValid({ onBackToSignIn }: LinkNotValidProps) {
  return (
    <View className="flex-1 bg-background">
      <ErrorState
        action={{ label: AUTH_SCREEN.backToSignIn, onPress: onBackToSignIn }}
        body={SIGN_IN_LINK_INVALID.body}
        inset="wide"
        title={SIGN_IN_LINK_INVALID.title}
      />
    </View>
  );
}
