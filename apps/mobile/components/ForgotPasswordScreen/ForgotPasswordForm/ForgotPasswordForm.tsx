import { AUTH_SCREEN, FORGOT_PASSWORD_SCREEN } from "@keylow/core/copy";
import { vars } from "nativewind";
import { useRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { useKeyboardLift } from "../../../lib/useKeyboardLift";
import { useScrollFocusedInputIntoView } from "../../../lib/useScrollFocusedInputIntoView";
import { AuthFooter } from "../../AuthForm/AuthFooter";
import { Banner, Button, IconButton, Input, Text } from "../../ui";

import type { ForgotPasswordFormProps } from "./types";

/**
 * The forgot password board's form: a back chevron, a heading and a sentence, the Email field, the error
 * banner when a request failed, Send link and the line that offers Sign in. It lifts above the keyboard as
 * the sign in form does, so the field stays in view on Android 15.
 */
export function ForgotPasswordForm({
  email,
  onChangeEmail,
  fieldError,
  failure,
  isSending,
  onSend,
  onBackToSignIn,
}: ForgotPasswordFormProps) {
  const frameRef = useRef<View>(null);
  // Android 15 draws edge to edge, so the window does not resize for the keyboard. iOS has the padding view.
  const keyboardLift = useKeyboardLift(frameRef, Platform.OS === "android");

  const scrollViewRef = useRef<ScrollView>(null);
  const trackScrollOffset = useScrollFocusedInputIntoView(scrollViewRef, keyboardLift);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      {/* The keyboard's cover is a runtime value no class can name, so it goes through a variable, as the sign
          in form does. */}
      <View
        ref={frameRef}
        className="flex-1 pb-[var(--keyboard-lift)]"
        style={vars({ "--keyboard-lift": keyboardLift })}
      >
        {/* The board's 56 above is the status bar it is drawn under. */}
        <View className="flex-row items-center pl-2 pr-4 pt-[56px]">
          <IconButton
            icon="ChevronLeft"
            iconSize="lg"
            label={AUTH_SCREEN.backToSignIn}
            variant="ghost"
            onPress={onBackToSignIn}
          />
        </View>
        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={trackScrollOffset}
          contentContainerClassName="flex-grow gap-4 px-6 pb-[34px] pt-4"
        >
          <View className="mb-2 items-start gap-2">
            <Text role="heading" variant="h1">
              {FORGOT_PASSWORD_SCREEN.heading}
            </Text>
            <Text tone="secondary">{FORGOT_PASSWORD_SCREEN.body}</Text>
          </View>

          <Input
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            error={fieldError}
            keyboardType="email-address"
            label={AUTH_SCREEN.emailLabel}
            value={email}
            onChangeText={onChangeEmail}
          />

          {failure === undefined ? null : <Banner sentence title={failure} variant="error" />}

          <View className="mt-2 gap-2">
            <Button
              fullWidth
              loading={isSending}
              size="lg"
              onPress={onSend}
              {...(isSending ? { accessibilityLabel: FORGOT_PASSWORD_SCREEN.submittingLabel } : {})}
            >
              {FORGOT_PASSWORD_SCREEN.submitLabel}
            </Button>
          </View>

          <AuthFooter
            footer={{
              prompt: FORGOT_PASSWORD_SCREEN.footerPrompt,
              linkLabel: FORGOT_PASSWORD_SCREEN.footerLink,
              href: "/(auth)/sign-in",
            }}
            onPress={onBackToSignIn}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
