import {
  CHANGE_PASSWORD_SCREEN,
  PASSWORD_CHANGED,
  RESET_LINK_INVALID,
  SET_PASSWORD_SCREEN,
} from "@keylow/core/copy";
import { vars } from "nativewind";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { useNewPasswordForm } from "./useNewPasswordForm";
import { useKeyboardLift } from "../../lib/useKeyboardLift";
import { useScrollFocusedInputIntoView } from "../../lib/useScrollFocusedInputIntoView";
import { Banner, Button, Input } from "../ui";

import type { NewPasswordFormProps } from "./types";

// The classes are written out so Tailwind sees them. The set a new password board has no header, so its
// words start 80 points down (the 56 of the status bar it is drawn under, and 24), with 24 at the sides. The
// change password board has its header above, and 16 at the sides.
const contentClassName = {
  recovery: "flex-grow gap-4 px-6 pb-[34px] pt-[80px]",
  change: "flex-grow gap-4 px-4 pb-4 pt-2",
};

const copy = { recovery: SET_PASSWORD_SCREEN, change: CHANGE_PASSWORD_SCREEN };

/**
 * The part of the set a new password and change password boards that is the same: the New password and
 * Confirm new password fields, the error banner, and the Save password button. `children` is what the screen
 * draws above the fields, its heading and caption. It lifts above the keyboard as the sign in form does, so
 * the fields stay in view on Android 15. Once a changed password is saved the success notice replaces the
 * error banner, the fields drop to half strength and the button becomes Done.
 */
export function NewPasswordForm(props: NewPasswordFormProps) {
  const { context, children } = props;
  const form = useNewPasswordForm({
    context,
    onSaved: props.context === "recovery" ? props.onSaved : undefined,
  });
  const words = copy[context];

  const frameRef = useRef<View>(null);
  // Android 15 draws edge to edge, so the window does not resize for the keyboard. iOS has the padding view.
  const keyboardLift = useKeyboardLift(frameRef, Platform.OS === "android");

  const scrollViewRef = useRef<ScrollView>(null);
  const trackScrollOffset = useScrollFocusedInputIntoView(scrollViewRef, keyboardLift);

  const isLocked = props.context === "change" && form.isSaved;

  // Save unmounts and Done mounts, so the saved notice is not announced as it appears. Say it once.
  useEffect(() => {
    if (isLocked) {
      AccessibilityInfo.announceForAccessibility(PASSWORD_CHANGED.title);
    }
  }, [isLocked]);

  function renderNotice() {
    if (isLocked) {
      return (
        <Banner body={PASSWORD_CHANGED.body} title={PASSWORD_CHANGED.title} variant="success" />
      );
    }
    if (form.failureSentence === undefined) {
      return null;
    }
    // A reset that timed out can only be started again, so it carries the way to ask for a new link.
    const action =
      props.context === "recovery" && form.isSessionEnded
        ? { label: RESET_LINK_INVALID.sendNewLinkLabel, onPress: props.onSendNewLink }
        : undefined;

    return <Banner action={action} sentence title={form.failureSentence} variant="error" />;
  }

  function renderButton() {
    if (props.context === "change" && form.isSaved) {
      return (
        <Button fullWidth size="lg" onPress={props.onDone}>
          {PASSWORD_CHANGED.doneLabel}
        </Button>
      );
    }

    return (
      <Button
        fullWidth
        loading={form.isSaving}
        size="lg"
        onPress={form.save}
        {...(form.isSaving ? { accessibilityLabel: words.submittingLabel } : {})}
      >
        {words.submitLabel}
      </Button>
    );
  }

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
        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={trackScrollOffset}
          contentContainerClassName={contentClassName[context]}
        >
          {children}

          <Input
            autoCapitalize="none"
            autoComplete="new-password"
            autoCorrect={false}
            disabled={isLocked}
            error={form.problems.password}
            helper={SET_PASSWORD_SCREEN.helper}
            label={words.newPasswordLabel}
            secureTextEntry
            value={form.password}
            onChangeText={form.setPassword}
          />
          <Input
            autoCapitalize="none"
            autoComplete="new-password"
            autoCorrect={false}
            disabled={isLocked}
            error={form.problems.confirmation}
            label={words.confirmPasswordLabel}
            secureTextEntry
            value={form.confirmation}
            onChangeText={form.setConfirmation}
          />

          {renderNotice()}

          <View className="mt-2 gap-2">{renderButton()}</View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
