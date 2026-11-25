import {
  RESET_LINK_SENT_SCREEN,
  describeResetLinkSent,
  describeSendAgainCountdown,
} from "@keylow/core/copy";
import { useEffect } from "react";
import { BackHandler, View } from "react-native";

import { AuthMessage } from "../AuthMessage";
import { Button, Text } from "../ui";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { useForgotPassword } from "./useForgotPassword";

import type { ForgotPasswordScreenProps } from "./types";

/**
 * The forgot password screens: the form that asks for the email, then, once a link was sent, the Check your
 * email message with its Send again countdown. The sent message reads the same for an address with an
 * account and one without.
 */
export function ForgotPasswordScreen({ onBackToSignIn }: ForgotPasswordScreenProps) {
  const forgotPassword = useForgotPassword();

  // Back is always Sign in, in the form and in the sent message, even when this screen replaced another
  // (Send a new link) and has nothing of its own under it.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBackToSignIn();
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [onBackToSignIn]);

  if (forgotPassword.sentTo === undefined) {
    return (
      <ForgotPasswordForm
        email={forgotPassword.email}
        failure={forgotPassword.failure}
        fieldError={forgotPassword.fieldError}
        isSending={forgotPassword.isSending}
        onBackToSignIn={onBackToSignIn}
        onChangeEmail={forgotPassword.setEmail}
        onSend={forgotPassword.send}
      />
    );
  }

  const isLocked = forgotPassword.secondsLeft > 0;

  return (
    <View className="flex-1 bg-background">
      <AuthMessage
        body={describeResetLinkSent(forgotPassword.sentTo, "phone")}
        icon="Mail"
        secondary={{ label: RESET_LINK_SENT_SCREEN.backToSignInLabel, onPress: onBackToSignIn }}
        title={RESET_LINK_SENT_SCREEN.heading}
        tone="neutral"
      >
        <Text className="mt-2" tone="secondary" variant="caption">
          {RESET_LINK_SENT_SCREEN.spamHint}
        </Text>
        <Button
          disabled={isLocked}
          fullWidth
          loading={forgotPassword.isSending}
          variant="ghost"
          onPress={forgotPassword.sendAgain}
        >
          {isLocked
            ? describeSendAgainCountdown(forgotPassword.secondsLeft)
            : RESET_LINK_SENT_SCREEN.sendAgainLabel}
        </Button>
      </AuthMessage>
    </View>
  );
}
