import { useEffect, useRef } from "react";
import { AccessibilityInfo, Modal, Pressable, View } from "react-native";

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
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleRef = useRef<View>(null);

  // A screen reader starts on the title, so the user hears what the dialog is for.
  useEffect(() => {
    if (open && titleRef.current !== null) {
      AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
    }
  }, [open]);

  return (
    <Modal
      transparent
      animationType="fade"
      navigationBarTranslucent
      statusBarTranslucent
      visible={open}
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-center px-6">
        <Pressable
          aria-hidden
          className="absolute inset-0 bg-overlay"
          role="button"
          onPress={onCancel}
        />
        <View
          aria-label={title}
          aria-modal
          className="gap-3 rounded-large border border-border bg-surface-sheet p-5 elevation-card"
          role="alertdialog"
          onAccessibilityEscape={onCancel}
        >
          {/* The view carries the heading role and takes the screen reader's focus, because the kit's Text takes no ref. */}
          <View ref={titleRef} accessible role="heading">
            <Text variant="h2">{title}</Text>
          </View>
          <Text tone="secondary">{body}</Text>
          <View className="mt-2 gap-2">
            <Button fullWidth loading={busy} {...confirmLook[tone]} onPress={onConfirm}>
              {confirmLabel}
            </Button>
            <Button fullWidth variant={cancelVariant[tone]} onPress={onCancel}>
              {cancelLabel}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
