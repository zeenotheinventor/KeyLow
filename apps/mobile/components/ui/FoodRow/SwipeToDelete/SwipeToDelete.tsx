import { FOOD_ROW } from "@keylow/core/copy";
import { motionDuration } from "@keylow/tokens";
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { PanResponder, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { actionWidth, followFinger, restingOffsetFor } from "./swipeOffset";
import { useReducedMotion } from "../../../../lib/motion";
import { Icon } from "../../Icon";
import { PressableSurface } from "../../PressableSurface";
import { Text } from "../../Text";

import type { SwipeToDeleteProps } from "./types";

// A swipe has to be mostly sideways to take the touch from the list that scrolls.
const sidewaysSlop = 8;

/**
 * Slides a row left to show a danger Delete action, 88 points wide. The gesture is one way in: the
 * route that does not need it is the row's own Delete accessibility action.
 */
export function SwipeToDelete({
  children,
  onDelete,
  startsSwiped = false,
  isOpen: isOpenFromScreen,
  onOpenChange,
}: SwipeToDeleteProps) {
  const isReducedMotion = useReducedMotion();
  const startsOpen = isOpenFromScreen ?? startsSwiped;
  // Open is where the row rests, and decides whether a screen reader can reach the action. A screen
  // that controls the row says where that is. Revealed lasts until the row has slid back, because the
  // action is drawn only while the row is off it.
  const [isOpenByRow, setIsOpenByRow] = useState(startsOpen);
  const isOpen = isOpenFromScreen ?? isOpenByRow;
  const [isRevealed, setIsRevealed] = useState(startsOpen);
  if (isOpen && !isRevealed) {
    setIsRevealed(true);
  }
  // The gesture reads where the row rests as it happens, and must not be rebuilt in the middle of one.
  const restsOpen = useSharedValue(startsOpen);
  // What the screen is to be told, as a new object each time so that the same word twice is two notices.
  const [notice, setNotice] = useState<{ isOpen: boolean } | null>(null);
  const offset = useSharedValue(startsOpen ? -actionWidth : 0);
  const offsetAtGrab = useSharedValue(0);

  // The latest `onOpenChange`, called from the effect below without that effect depending on it.
  const tellScreen = useEffectEvent((isNowOpen: boolean) => {
    onOpenChange?.(isNowOpen);
  });

  useEffect(() => {
    if (notice !== null) {
      tellScreen(notice.isOpen);
    }
  }, [notice]);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  const slideTo = useCallback(
    (target: number) => {
      const duration = isReducedMotion ? 0 : motionDuration.quick;
      restsOpen.set(target !== 0);
      offset.set(
        withTiming(target, { duration }, (isFinished) => {
          // A swipe that took hold of the row mid-slide has the action still in use.
          if (isFinished && target === 0) {
            scheduleOnRN(setIsRevealed, false);
          }
        }),
      );
    },
    [isReducedMotion, offset, restsOpen],
  );

  // The row comes to rest where the swipe or the tap leaves it, and tells the screen when that changed it.
  const settleAt = useCallback(
    (target: number) => {
      const wasOpen = restsOpen.get();
      slideTo(target);
      setIsOpenByRow(target !== 0);
      if ((target !== 0) !== wasOpen) {
        setNotice({ isOpen: target !== 0 });
      }
    },
    [restsOpen, slideTo],
  );

  // A screen that controls the row moves it by setting `isOpen`, and is not told about its own move.
  useEffect(() => {
    if (isOpenFromScreen !== undefined && isOpenFromScreen !== restsOpen.get()) {
      slideTo(isOpenFromScreen ? -actionWidth : 0);
    }
  }, [isOpenFromScreen, restsOpen, slideTo]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // An open row takes the touch at once, so a tap on it closes it and does not press the row.
        onStartShouldSetPanResponderCapture: () => restsOpen.get(),
        // A swipe has to be mostly sideways, and to the left, unless the row is open and the swipe is
        // the way back. A drag to the right of a closed row is left to a parent that swipes sideways.
        onMoveShouldSetPanResponder: (_event, { dx, dy }) =>
          Math.abs(dx) > sidewaysSlop &&
          Math.abs(dx) > Math.abs(dy) * 2 &&
          (dx < 0 || restsOpen.get()),
        onPanResponderGrant: () => {
          offsetAtGrab.set(offset.get());
          setIsRevealed(true);
        },
        onPanResponderMove: (_event, { dx }) => {
          offset.set(followFinger(offsetAtGrab.get(), dx));
        },
        onPanResponderRelease: (_event, { dx, dy, vx }) => {
          const isTap = Math.abs(dx) <= sidewaysSlop && Math.abs(dy) <= sidewaysSlop;
          settleAt(isTap && restsOpen.get() ? 0 : restingOffsetFor(offset.get(), vx));
        },
        onPanResponderTerminate: () => {
          settleAt(restingOffsetFor(offset.get()));
        },
      }),
    [offset, offsetAtGrab, restsOpen, settleAt],
  );

  return (
    <View className="overflow-hidden">
      {/* The action is a row so that the pressable's wrapper fills its height. */}
      <View
        aria-hidden={!isOpen}
        className={`absolute inset-y-0 right-0 w-[88px] flex-row bg-danger ${isRevealed ? "" : "opacity-0"}`}
      >
        <PressableSurface
          className="w-[88px] flex-1 items-center justify-center gap-[2px]"
          label={FOOD_ROW.deleteAction}
          onPress={() => {
            settleAt(0);
            onDelete();
          }}
        >
          <Icon name="Trash2" tone="on-status" />
          <Text tone="on-status" variant="body-strong">
            {FOOD_ROW.deleteAction}
          </Text>
        </PressableSurface>
      </View>
      <Animated.View style={rowStyle} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}
