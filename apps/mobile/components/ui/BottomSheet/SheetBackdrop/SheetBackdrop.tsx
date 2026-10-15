import { useContext } from "react";
import { Pressable } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated";

import { SheetBackdropContext } from "../SheetCloseContext";

import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";

/**
 * The dim behind the sheet, in the design's `--overlay`. It fades in as the sheet rises and a press on it
 * closes the sheet, until the sheet starts to exit. A screen reader never reaches it, because the sheet is
 * modal and has its own ways to close.
 */
export function SheetBackdrop({ animatedIndex, style }: BottomSheetBackdropProps) {
  const { requestClose, isOpen } = useContext(SheetBackdropContext);
  const fadeStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: interpolate(animatedIndex.get(), [-1, 0], [0, 1], Extrapolation.CLAMP),
  }));

  // A class and an animated style cannot share an element, so the fade sits on a wrapper with no class,
  // inside the view that covers the sheet's container, whose layout is gorhom's.
  return (
    <Animated.View style={style}>
      <Animated.View style={fadeStyle}>
        <Pressable
          aria-hidden
          className="flex-1 bg-overlay"
          pointerEvents={isOpen ? "auto" : "none"}
          role="button"
          onPress={requestClose}
        />
      </Animated.View>
    </Animated.View>
  );
}
