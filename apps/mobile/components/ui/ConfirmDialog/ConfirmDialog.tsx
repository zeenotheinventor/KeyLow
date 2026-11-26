import { vars } from "nativewind";
import { Children, useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
} from "react-native";

import { useKeyboardLift } from "../../../lib/useKeyboardLift";
import { Button } from "../Button";
import { Text } from "../Text";

import type { ConfirmDialogProps, ConfirmDialogTone } from "./types";
import type { ButtonProps } from "../Button";

// How each tone draws its two buttons. A destructive answer is the secondary button with its label in the
// danger colour and leaves the main fill to the way back.
const confirmLook = {
  destructive: { variant: "secondary", tone: "danger" },
  primary: { variant: "primary" },
} as const satisfies Record<ConfirmDialogTone, Pick<ButtonProps, "variant" | "tone">>;

// The Android modal asks for a handler to its back button, so a locked dialog gives it one that does nothing.
function doNothing() {}

const cancelVariant = {
  destructive: "primary",
  primary: "secondary",
} as const satisfies Record<ConfirmDialogTone, ButtonProps["variant"]>;

/**
 * Asks one question before something is thrown away or changed, as the session discard and the set active
 * boards draw it: a card centred over a dim, with the title, a sentence saying what the answer does, then
 * the confirm button and the one that backs out. A press on the dim, the screen reader's escape gesture and
 * the Android back button back out too, so only the confirm button goes ahead. While `busy` the confirm
 * button shows a spinner and ignores presses.
 *
 * A destructive answer is written in the danger colour and leaves the main button to Keep, so the way back
 * is the easy one, as the board draws it.
 *
 * `children` draws a field between the body and the buttons. The card then moves up to stay clear of the
 * keyboard: on iOS the padding view does it, and on Android, which draws edge to edge, the lift does.
 *
 * `lockWhileBusy` turns every way out into nothing while `busy`, for a step that cannot be left once it has
 * started, such as deleting an account.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone,
  busy = false,
  confirmBusyLabel,
  lockWhileBusy = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleRef = useRef<View>(null);
  const frameRef = useRef<View>(null);
  // Nothing, null and false draw nothing, so they are no field.
  const hasField = Children.toArray(children).length > 0;
  // Only a dialog with a field has a keyboard to clear, so every other one listens to nothing.
  const keyboardLift = useKeyboardLift(frameRef, hasField && Platform.OS === "android");
  const isLocked = busy && lockWhileBusy;
  const dismiss = isLocked ? doNothing : onCancel;
  const confirmName =
    busy && confirmBusyLabel !== undefined ? { accessibilityLabel: confirmBusyLabel } : {};

  // A screen reader starts on the title, so the user hears what the dialog is for.
  useEffect(() => {
    if (open && titleRef.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
    }
  }, [open]);

  // Only a dialog with a field is lifted, so every other one is drawn exactly as it was. The lift is a runtime
  // measure of the keyboard, so it goes through a variable, as the insets do elsewhere.
  const frameProps = hasField
    ? {
        ref: frameRef,
        className: "flex-1 justify-center px-6 pb-[var(--keyboard-lift)]",
        style: vars({ "--keyboard-lift": keyboardLift }),
      }
    : { className: "flex-1 justify-center px-6" };
  const frame = (
    <View {...frameProps}>
      <Pressable
        aria-hidden
        className="absolute inset-0 bg-overlay"
        role="button"
        onPress={dismiss}
      />
      <View
        aria-label={title}
        aria-modal
        className="gap-3 rounded-large border border-border bg-surface-sheet p-5 elevation-card"
        role="alertdialog"
        onAccessibilityEscape={dismiss}
      >
        {/* The view carries the heading role and takes the screen reader's focus, because the kit's Text takes no ref. */}
        <View ref={titleRef} accessible role="heading">
          <Text variant="h2">{title}</Text>
        </View>
        <Text tone="secondary">{body}</Text>
        {children}
        <View className={hasField ? "gap-2" : "mt-2 gap-2"}>
          <Button
            fullWidth
            loading={busy}
            {...confirmName}
            {...confirmLook[tone]}
            onPress={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button disabled={isLocked} fullWidth variant={cancelVariant[tone]} onPress={onCancel}>
            {cancelLabel}
          </Button>
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      transparent
      animationType="fade"
      navigationBarTranslucent
      statusBarTranslucent
      visible={open}
      onRequestClose={dismiss}
    >
      {/* Only a dialog with a field has a keyboard to clear, and the padding view listens to the keyboard on Android even when it is off. */}
      {hasField && Platform.OS === "ios" ? (
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          {frame}
        </KeyboardAvoidingView>
      ) : (
        frame
      )}
    </Modal>
  );
}
