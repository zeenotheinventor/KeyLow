import { View } from "react-native";

import { Icon } from "../../Icon";
import { PressableSurface } from "../../PressableSurface";
import { Text } from "../../Text";

import type { ActionMenuItemProps } from "./types";

// The classes are written out so Tailwind sees them. A disabled item dims its icon and label to 40 percent
// and leaves the caption as it is. A destructive label is the danger colour in dark only: in light it is too
// faint for small text, so the label keeps the primary text colour and the icon keeps the danger colour (Q14).
const dimClassName = "opacity-40";
const destructiveLabelClassName = "dark:text-danger";

/** One action of a menu: a 52 point row with its icon, its label and, under the label, an optional caption. */
export function ActionMenuItem({
  label,
  icon,
  caption,
  disabled = false,
  destructive = false,
  onPress,
}: ActionMenuItemProps) {
  const dim = disabled ? dimClassName : "";

  return (
    <PressableSurface
      className="min-h-[52px] flex-row items-center gap-3 rounded-medium px-1 py-2"
      disabled={disabled}
      label={caption === undefined ? label : `${label}, ${caption}`}
      onPress={onPress}
    >
      <View className={`shrink-0 ${dim}`} testID="action-menu-icon">
        <Icon name={icon} tone={destructive ? "danger" : "secondary"} />
      </View>
      <View className="min-w-0 flex-1 gap-[2px]">
        <Text className={`${destructive ? destructiveLabelClassName : ""} ${dim}`}>{label}</Text>
        {caption === undefined ? null : (
          <Text tone="muted" variant="caption">
            {caption}
          </Text>
        )}
      </View>
    </PressableSurface>
  );
}
