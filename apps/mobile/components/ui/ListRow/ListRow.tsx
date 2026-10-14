import { View } from "react-native";

import { rowPressScale } from "../../../lib/motion";
import { useGroupedRowPosition } from "../GroupedList";
import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";
import { Text } from "../Text";

import type { ListRowProps } from "./types";

/** A row of the diary, a menu or a list of foods: an icon, a title, a subtitle, a value and a chevron. */
export function ListRow({
  icon,
  title,
  subtitle,
  value,
  unit,
  chevron = true,
  onPress,
  disabled = false,
}: ListRowProps) {
  const { isFirst } = useGroupedRowPosition();
  const trailingValue = value === undefined ? undefined : [value, unit].filter(Boolean).join(" ");
  const label = [title, subtitle, trailingValue].filter(Boolean).join(", ");
  const rowClassName = `min-h-[56px] flex-row items-center gap-3 px-3 py-2 ${isFirst ? "" : "border-t border-border"} ${disabled ? "opacity-50" : ""}`;

  const contents = (
    <>
      {icon === undefined ? null : (
        <View className="h-control-sm w-control-sm shrink-0 items-center justify-center rounded-small bg-surface-raised">
          <Icon name={icon} tone="secondary" />
        </View>
      )}
      <View className="flex-1 gap-[2px]">
        <Text numberOfLines={1} variant="body-strong">
          {title}
        </Text>
        {subtitle === undefined ? null : (
          <Text numberOfLines={1} tone="muted" variant="caption">
            {subtitle}
          </Text>
        )}
      </View>
      {value === undefined ? null : (
        <View className="shrink-0 flex-row items-baseline gap-[3px]">
          <Text variant="numeral-small">{value}</Text>
          {unit === undefined ? null : (
            <Text tone="muted" variant="caption">
              {unit}
            </Text>
          )}
        </View>
      )}
      {chevron && onPress !== undefined ? (
        <Icon name="ChevronRight" size="sm" tone="muted" />
      ) : null}
    </>
  );

  if (onPress === undefined) {
    return (
      <View accessible aria-disabled={disabled} aria-label={label} className={rowClassName}>
        {contents}
      </View>
    );
  }

  return (
    <PressableSurface
      className={rowClassName}
      disabled={disabled}
      label={label}
      pressScale={rowPressScale}
      onPress={onPress}
    >
      {contents}
    </PressableSurface>
  );
}
