import { View } from "react-native";

import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import { PressableSurface } from "../PressableSurface";
import { Text } from "../Text";

import type { SearchLauncherProps } from "./types";

/**
 * The bar above the tab bar that opens the food search sheet. It is drawn as the sheet's search field
 * is, with the same box, but it is a button and not a text input: the field itself lives in the sheet.
 * A barcode control at its end opens the scanner. The bar brings the 8 points above and below it and the
 * 16 at its sides that the frames draw, and sits directly on the tab bar.
 */
export function SearchLauncher({ label, scanLabel, onPress, onScanPress }: SearchLauncherProps) {
  return (
    <View className="px-4 py-2">
      <View className="h-control-md flex-row items-center rounded-medium border border-border bg-surface-raised pr-1 elevation-card">
        <View className="flex-1">
          <PressableSurface
            className="h-[42px] flex-row items-center gap-2 pl-4"
            label={label}
            onPress={onPress}
          >
            <Icon name="Search" tone="muted" />
            <Text numberOfLines={1} tone="muted">
              {label}
            </Text>
          </PressableSurface>
        </View>
        <IconButton
          icon="ScanBarcode"
          label={scanLabel}
          size="sm"
          variant="ghost"
          onPress={onScanPress}
        />
      </View>
    </View>
  );
}
