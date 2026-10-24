import { SETUP_SHELL } from "@keylow/core/copy";
import { vars } from "nativewind";
import { useRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardLift } from "../../../lib/useKeyboardLift";
import { useScrollFocusedInputIntoView } from "../../../lib/useScrollFocusedInputIntoView";
import { Button, ProgressBar, SheetHeader, Text } from "../../ui";

import type { SetupShellProps } from "./types";

// The footer sits on the screen's bottom inset with the 8 points the board adds, and never closer than 12.
const FOOTER_EXTRA_PADDING = 8;
const MINIMUM_FOOTER_BOTTOM_PADDING = 12;

/**
 * What every step of the setup wizard sits in: the sheet header with the group as its title and
 * "Step n of 8" under it, the progress bar, the question with its helper line, the step's controls
 * scrolling between the fixed header and the fixed footer, and the footer's Continue. Back and Close are
 * the caller's to give, because only it knows where the step is and how the wizard was opened.
 */
export function SetupShell({
  title,
  subtitle,
  progressName,
  progressPercent,
  question,
  helper,
  onBack,
  onClose,
  continueAction,
  children,
}: SetupShellProps) {
  const insets = useSafeAreaInsets();
  const footerRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const keyboardLift = useKeyboardLift(footerRef, Platform.OS === "android");
  const trackScrollOffset = useScrollFocusedInputIntoView(scrollViewRef, keyboardLift);

  return (
    // The top inset is a runtime value no class can name, so it goes through a variable, as the Targets screen's does.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={
          onBack === undefined
            ? undefined
            : { icon: "ChevronLeft", label: SETUP_SHELL.backName, onPress: onBack }
        }
        subtitle={subtitle}
        title={title}
        trailing={
          onClose === undefined
            ? undefined
            : { icon: "X", label: SETUP_SHELL.closeName, onPress: onClose }
        }
      />
      <View className="px-4">
        <ProgressBar label={progressName} value={progressPercent} />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          contentContainerClassName="gap-4 px-4 pb-4 pt-5"
          onScroll={trackScrollOffset}
        >
          {question === undefined ? null : (
            <View className="gap-2">
              <Text role="heading" variant="h1">
                {question}
              </Text>
              {helper === undefined ? null : <Text tone="secondary">{helper}</Text>}
            </View>
          )}
          {children}
        </ScrollView>
        {continueAction === undefined ? null : (
          // Continue stays in view and rides above the keyboard, as the Targets form's Save does. Its padding is
          // a runtime value no class can name, so it goes through a variable.
          <View
            ref={footerRef}
            className="gap-3 border-t border-border bg-surface-sheet px-4 pt-4 pb-[var(--footer-bottom-padding)]"
            style={vars({
              "--footer-bottom-padding":
                keyboardLift > 0
                  ? keyboardLift + MINIMUM_FOOTER_BOTTOM_PADDING
                  : Math.max(insets.bottom + FOOTER_EXTRA_PADDING, MINIMUM_FOOTER_BOTTOM_PADDING),
            })}
          >
            <Button
              disabled={!continueAction.isEnabled}
              fullWidth
              haptic="select"
              size="lg"
              onPress={continueAction.onPress}
            >
              {SETUP_SHELL.continueLabel}
            </Button>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
