import { FOOD_FORM } from "@keylow/core/copy";
import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCloseFoodsSheet, useGoBackInFoodsSheet } from "../../lib/navigation";
import { SheetHeader } from "../ui";

import type { FoodFormScreenProps } from "./types";

/**
 * The frame of every screen the food form flows draw: the sheet's stack header under the status bar, with
 * Back to the screen before and Close for the whole sheet, and the screen's body under it. A screen can
 * add one control between the title and Close, as the food detail's favourite heart is. Neither Back nor
 * Close saves anything, and the Android back button goes back as Back does, because nothing here
 * intercepts it.
 */
export function FoodFormScreen({
  title,
  isTitleHeading = true,
  extraControl,
  children,
}: FoodFormScreenProps) {
  const insets = useSafeAreaInsets();
  const goBack = useGoBackInFoodsSheet();
  const closeSheet = useCloseFoodsSheet();
  const closeControl = { icon: "X", label: FOOD_FORM.close, onPress: closeSheet } as const;

  return (
    // The top inset is a runtime value no class can name, so it goes through a variable, as the scanner's does.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        isTitleHeading={isTitleHeading}
        leading={{ icon: "ChevronLeft", label: FOOD_FORM.back, onPress: goBack }}
        title={title}
        trailing={extraControl === undefined ? closeControl : [extraControl, closeControl]}
        variant="stack"
      />
      {children}
    </View>
  );
}
