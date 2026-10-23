import { FOOD_FORM } from "@keylow/core/copy";
import { vars } from "nativewind";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dockBottomPadding } from "../../../lib/dockBottomPadding";
import { useKeyboardLift } from "../../../lib/useKeyboardLift";
import { SheetHeader, TimePicker, TimeRow } from "../../ui";

import type { PortionPickerShellProps } from "./types";

/**
 * The page both amount pickers are drawn in, a food's and a recipe's: the title under a Back control, a
 * scrolling body, and the dock at the bottom with the controls, the Time row and the buttons. It keeps what
 * the two share: the safe area, the keyboard's lift (the dock stays above the keyboard), and the time the Time
 * row shows with the picker that changes it. The picker draws the rest and hands the time over with its
 * amount through `renderActions`.
 */
export function PortionPickerShell({
  title,
  onBack,
  time,
  isNow,
  showsTime,
  controls,
  renderActions,
  children,
}: PortionPickerShellProps) {
  const insets = useSafeAreaInsets();
  const frameRef = useRef<View>(null);
  // Android 15 draws edge to edge, so the window does not resize for the keyboard. iOS has the padding view.
  const keyboardLift = useKeyboardLift(frameRef, Platform.OS === "android");
  const [chosenTime, setChosenTime] = useState(time);
  const [isTimeStillNow, setIsTimeStillNow] = useState(isNow);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  return (
    <View className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        {/* The insets and the keyboard's cover are runtime values no class can name, so they go through variables. */}
        <View
          ref={frameRef}
          className="flex-1 pb-[var(--keyboard-lift)] pt-[var(--inset-top)]"
          style={vars({ "--inset-top": insets.top, "--keyboard-lift": keyboardLift })}
        >
          <SheetHeader
            leading={{ icon: "ChevronLeft", label: FOOD_FORM.back, onPress: onBack }}
            title={title}
          />
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-3 px-4 pb-4"
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {/* The dock is the sheet's surface under a hairline, with the board's 42 below its controls. */}
          <View
            className="gap-3 border-t border-border bg-surface-sheet px-4 pb-[var(--dock-bottom)] pt-4"
            style={vars({ "--dock-bottom": dockBottomPadding(insets.bottom) })}
          >
            {controls}
            {showsTime ? (
              <TimeRow
                isNow={isTimeStillNow}
                open={isTimePickerOpen}
                time={chosenTime}
                onPress={() => {
                  setIsTimePickerOpen(true);
                }}
              />
            ) : null}
            {renderActions({ time: chosenTime, isNow: isTimeStillNow })}
          </View>
        </View>
        {showsTime ? (
          <TimePicker
            open={isTimePickerOpen}
            value={chosenTime}
            onChange={(next) => {
              setChosenTime(next);
              setIsTimeStillNow(false);
            }}
            onClose={() => {
              setIsTimePickerOpen(false);
            }}
          />
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}
