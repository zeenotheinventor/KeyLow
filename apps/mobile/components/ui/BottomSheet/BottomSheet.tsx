import GorhomBottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { easingCurve, motionDuration, spacing } from "@keylow/tokens";
import { vars } from "nativewind";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, View } from "react-native";
import { Easing, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { haptic } from "../../../lib/haptics";
import { useReducedMotion } from "../../../lib/motion";
import { Text } from "../Text";
import { SheetBackdrop } from "./SheetBackdrop";
import { SheetBackground } from "./SheetBackground";
import { SheetBackdropContext } from "./SheetCloseContext";
import { SheetHandle } from "./SheetHandle";
import { IsInsideSheetContext } from "./SheetInputContext";

import type { BottomSheetProps } from "./types";
import type { ComponentRef } from "react";

// The design's `--space-6`, which the sheet keeps under its contents before the safe area.
const bottomPadding = Number.parseInt(spacing["6"], 10);

// The design slams the sheet up with `--ease-spring` over `--duration-flourish` and takes it down with
// `--ease-exit` over `--duration-standard`. The bezier overshoots on the way up and settles.
const enterAnimation = {
  duration: motionDuration.flourish,
  easing: Easing.bezier(...easingCurve.spring),
};
const exitAnimation = {
  duration: motionDuration.standard,
  easing: Easing.bezier(...easingCurve.exit),
};

/**
 * A sheet that hosts one focused task above the current screen, as the design system's bottom sheet
 * does: a handle, an optional title, the contents, and a dim behind it. It sizes itself to its contents.
 * It draws inside its parent, so a screen mounts it where the sheet should cover, and the parent sits
 * under a gesture handler root view. With `snapPoints` it is a fixed height sheet instead, for contents
 * that scroll.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  isTitleCentred = false,
  isDismissible = true,
  isContentDraggable = true,
  label,
  snapPoints,
  children,
}: BottomSheetProps) {
  const isFixedHeight = snapPoints !== undefined;
  const sheetRef = useRef<ComponentRef<typeof GorhomBottomSheet>>(null);
  const titleRef = useRef<View>(null);
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const isReducedMotion = useReducedMotion();
  const [isMounted, setIsMounted] = useState(open);
  const isOpenRef = useRef(open);
  const isExitingRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // A sheet that opens is mounted in the same render, so it is never a frame late.
  if (open && !isMounted) {
    setIsMounted(true);
  }

  // The sheet is mounted to open and unmounted once it has closed, so a closed sheet leaves nothing
  // behind for a screen reader to reach. It is taken away when the exit has run its length. A sheet
  // opened again during the exit is snapped back up, or gorhom would finish closing it.
  useEffect(() => {
    isOpenRef.current = open;
    if (open) {
      if (isExitingRef.current) {
        isExitingRef.current = false;
        sheetRef.current?.snapToIndex(0);
      }
      void haptic.select();
      // A screen reader starts on the title, so the user hears what the sheet is for.
      if (titleRef.current !== null) {
        AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
      }
      return undefined;
    }
    isExitingRef.current = true;
    sheetRef.current?.close();
    const timer = setTimeout(() => {
      isExitingRef.current = false;
      setIsMounted(false);
    }, motionDuration.standard);
    return () => {
      clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onCloseRef.current();
      return true;
    });
    return () => {
      subscription.remove();
    };
  }, [open]);

  if (!open && !isMounted) {
    return null;
  }

  const dialog = (
    <>
      {/* The safe area is a runtime value no class can name, so it goes through a variable. */}
      <View
        aria-label={title ?? label}
        aria-modal
        className={`px-4 pb-[var(--sheet-bottom-padding)]${isFixedHeight ? " flex-1" : ""}`}
        role="dialog"
        style={vars({ "--sheet-bottom-padding": bottomPadding + safeAreaBottom })}
        onAccessibilityEscape={onClose}
      >
        {title === undefined ? null : (
          // The view carries the heading role and takes the screen reader's focus, because the kit's
          // Text takes no ref. Its words are read as the heading's name.
          <View ref={titleRef} accessible className="mb-3" role="heading">
            <Text className={isTitleCentred ? "text-center" : ""} variant="h2">
              {title}
            </Text>
          </View>
        )}
        <IsInsideSheetContext value>{children}</IsInsideSheetContext>
      </View>
    </>
  );

  return (
    <SheetBackdropContext.Provider value={{ requestClose: onClose, isOpen: open }}>
      <GorhomBottomSheet
        ref={sheetRef}
        accessible={false}
        animationConfigs={open ? enterAnimation : exitAnimation}
        backdropComponent={SheetBackdrop}
        backgroundComponent={SheetBackground}
        enableContentPanningGesture={isContentDraggable}
        enableDynamicSizing={!isFixedHeight}
        enablePanDownToClose={isDismissible}
        handleComponent={SheetHandle}
        index={0}
        {...(snapPoints === undefined ? {} : { snapPoints })}
        // A field in the sheet (the library's own input, which `TextArea` draws inside a sheet) lifts the
        // sheet with the keyboard, and the sheet goes back down when the keyboard is hidden. Android 15
        // draws edge to edge and does not resize the window for the keyboard, so the sheet pans itself.
        android_keyboardInputMode="adjustPan"
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        overrideReduceMotion={isReducedMotion ? ReduceMotion.Always : ReduceMotion.System}
        onClose={() => {
          // The sheet also reports a close the screen asked for, which the screen already knows about.
          if (isOpenRef.current) {
            onClose();
          }
        }}
      >
        {isFixedHeight ? (
          // The library's view is absolutely positioned with only its left, top and right set, so a flex-1
          // child would never fill it: the contents would grow to their own height and a list would not
          // scroll, nor shrink for the keyboard. The sheet sizes its content area itself in a fixed height
          // sheet, so a plain view fills that.
          <View className="flex-1">{dialog}</View>
        ) : (
          <BottomSheetView>{dialog}</BottomSheetView>
        )}
      </GorhomBottomSheet>
    </SheetBackdropContext.Provider>
  );
}
