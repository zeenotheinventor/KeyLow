import { View } from "react-native";

import { IconButton } from "../IconButton";
import { Text } from "../Text";

import type { SheetHeaderControl, SheetHeaderProps } from "./types";
import type { IconButtonProps } from "../IconButton";

type ControlIconSize = NonNullable<IconButtonProps["iconSize"]>;

// The classes are written out so Tailwind sees them. The sheet header sits above a list with 12 points
// under it. The stack header has 8, because the view under it brings its own spacing.
const variants = {
  sheet: {
    className: "pb-3",
    buttonVariant: "secondary",
    leadingIconSize: "md",
    trailingIconSize: "md",
    titleVariant: "h2",
  },
  stack: {
    className: "pb-2",
    buttonVariant: "ghost",
    // The boards draw the stack header's glyphs larger than a control's own 20 points: 24 for back and 22
    // for close, which is off the icon scale, so it is given in points.
    leadingIconSize: "lg",
    trailingIconSize: 22,
    titleVariant: "body-strong",
  },
} satisfies Record<
  string,
  {
    className: string;
    buttonVariant: IconButtonProps["variant"];
    leadingIconSize: ControlIconSize;
    trailingIconSize: ControlIconSize;
    titleVariant: "h2" | "body-strong";
  }
>;

/**
 * The top of a sheet: a control at the left, a centred title and an optional control at the right, or two.
 * The screen gives the top inset and the header gives the 12 points under it, as the search field's dock
 * gives the 12 above the bottom inset. With two controls on the right the title is centred in the space
 * between the left control and the pair.
 */
export function SheetHeader({
  variant = "sheet",
  title,
  leading,
  trailing,
  subtitle,
  trailingSlot,
  isTitleHeading = true,
}: SheetHeaderProps) {
  const look = variants[variant];

  function renderControl(control: SheetHeaderControl, iconSize: ControlIconSize) {
    return (
      <IconButton
        icon={control.icon}
        iconSize={iconSize}
        disabled={control.disabled ?? false}
        key={control.label}
        label={control.label}
        variant={look.buttonVariant}
        onPress={control.onPress}
      />
    );
  }

  function renderTrailing() {
    if (trailing === undefined) {
      // Two slots of one width keep the title in the middle, so a header with no control on the right still centres it.
      return trailingSlot ?? <View className="w-touch-target" testID="sheet-header-empty-slot" />;
    }
    if ("icon" in trailing) {
      return renderControl(trailing, look.trailingIconSize);
    }
    return (
      <View className="shrink-0 flex-row gap-2" testID="sheet-header-trailing">
        {trailing.map((control) => renderControl(control, look.trailingIconSize))}
      </View>
    );
  }

  return (
    <View
      className={`flex-row items-center gap-2 px-4 pt-3 ${look.className}`}
      testID="sheet-header"
    >
      {renderControl(leading, look.leadingIconSize)}
      {subtitle === undefined ? (
        <Text
          className="flex-1 text-center"
          numberOfLines={1}
          role={isTitleHeading ? "heading" : undefined}
          variant={look.titleVariant}
        >
          {title}
        </Text>
      ) : (
        <View className="min-w-0 flex-1 items-center gap-0.5">
          <Text
            className="text-center"
            numberOfLines={1}
            role={isTitleHeading ? "heading" : undefined}
            variant={look.titleVariant}
          >
            {title}
          </Text>
          <Text tone="secondary" variant="caption">
            {subtitle}
          </Text>
        </View>
      )}
      {renderTrailing()}
    </View>
  );
}
