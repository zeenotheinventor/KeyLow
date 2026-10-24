import { Children } from "react";
import { View } from "react-native";

import { rowPressScale } from "../../../lib/motion";
import { Badge } from "../Badge";
import { ButtonSpinner } from "../Button";
import { useGroupedRowPosition } from "../GroupedList";
import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";
import { Text } from "../Text";

import type { ListRowMacro, ListRowProps } from "./types";

// Written out in full so Tailwind sees each class.
const macroKeyClassName: Record<ListRowMacro, string> = {
  calories: "bg-calories",
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
};

/** A row of the diary, a menu or a list of foods: an icon, a title, a subtitle, a value and a chevron. */
export function ListRow({
  icon,
  title,
  macro,
  subtitle,
  badge,
  value,
  unit,
  valueLook = "numeral",
  size,
  valueTone,
  chevron = true,
  onPress,
  loading = false,
  disabled = false,
  variant,
  ref,
  children,
}: ListRowProps) {
  const isFooter = variant === "footer";
  const isCompact = size === "compact";
  const { isFirst } = useGroupedRowPosition();
  const trailingValue = value === undefined ? undefined : [value, unit].filter(Boolean).join(" ");
  const label = [title, subtitle, badge?.label, trailingValue].filter(Boolean).join(", ");
  const separatorClassName = isFirst ? "" : "border-t border-border";
  const dimClassName = disabled ? "opacity-50" : "";
  const sizeClassName = isFooter
    ? "min-h-[52px] px-4"
    : isCompact
      ? "min-h-[52px] px-3"
      : "min-h-[56px] px-3";
  const rowClassName = `${sizeClassName} flex-row items-center gap-3 py-2 ${separatorClassName} ${dimClassName}`;
  const valueToneName = valueTone === "muted" ? "muted" : "primary";

  const contents = (
    <>
      {icon === undefined ? null : isFooter ? (
        <Icon name={icon} />
      ) : (
        <View
          className={`${isCompact ? "h-8 w-8" : "h-control-sm w-control-sm"} shrink-0 items-center justify-center rounded-small bg-surface-raised`}
        >
          <Icon name={icon} size={isCompact ? 18 : "md"} tone="secondary" />
        </View>
      )}
      {macro === undefined ? null : (
        <View
          aria-hidden
          className={`h-2 w-2 shrink-0 rounded-[2px] ${macroKeyClassName[macro]}`}
        />
      )}
      <View className={isCompact ? "flex-1" : "flex-1 gap-[2px]"}>
        <Text numberOfLines={1} variant={isCompact ? "label-small" : "body-strong"}>
          {title}
        </Text>
        {subtitle === undefined ? null : (
          <Text numberOfLines={isCompact ? 2 : 1} tone="muted" variant="caption">
            {subtitle}
          </Text>
        )}
      </View>
      {badge === undefined ? null : (
        <View className="shrink-0">
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </View>
      )}
      {value === undefined ? null : isCompact ? (
        <Text className="shrink-0" tone={valueToneName} variant="body-strong">
          {trailingValue}
        </Text>
      ) : (
        <View className="shrink-0 flex-row items-baseline gap-[3px]">
          {valueLook === "quiet" ? (
            <Text tone="secondary">{value}</Text>
          ) : (
            <Text variant="numeral-small">{value}</Text>
          )}
          {unit === undefined ? null : (
            <Text tone="muted" variant="caption">
              {unit}
            </Text>
          )}
        </View>
      )}
      {loading ? (
        // The spinner is drawn over the middle of a box the size of its 18 point ring, so the row keeps its height.
        <View className="h-[18px] w-[18px] shrink-0">
          <ButtonSpinner variant="secondary" />
        </View>
      ) : chevron && !isFooter && onPress !== undefined ? (
        <Icon name="ChevronRight" size="sm" tone="muted" />
      ) : null}
    </>
  );

  // `null`, `undefined` and `false` draw nothing, so a conditional control that is off leaves a plain row.
  if (Children.toArray(children).length > 0) {
    // The title row is named on its own, and the control under it is not folded into that name, so a
    // screen reader reaches the control itself. The 12 points above and around match the design's card.
    return (
      <View className={`${separatorClassName} ${dimClassName}`}>
        <View
          accessible
          aria-disabled={disabled}
          aria-label={label}
          className="flex-row items-center gap-3 px-3 pt-3"
        >
          {contents}
        </View>
        <View className="p-3">{children}</View>
      </View>
    );
  }

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
      busy={loading || undefined}
      disabled={disabled}
      label={label}
      pressScale={rowPressScale}
      ref={ref}
      onPress={onPress}
    >
      {contents}
    </PressableSurface>
  );
}
