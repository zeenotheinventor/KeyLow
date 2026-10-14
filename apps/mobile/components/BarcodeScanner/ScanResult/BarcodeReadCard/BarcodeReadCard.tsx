import { BARCODE_SCAN } from "@keylow/core/copy";
import { View } from "react-native";

import { Card, Icon, Text } from "../../../ui";

import type { BarcodeReadCardProps } from "./types";

/** The code the camera read, kept on screen under every result so the user can see what was looked up. */
export function BarcodeReadCard({ code }: BarcodeReadCardProps) {
  return (
    <Card padding={0}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <View className="h-[36px] w-[36px] items-center justify-center rounded-small bg-surface-raised">
          <Icon name="ScanBarcode" tone="secondary" />
        </View>
        <View className="flex-1">
          <Text tone="muted" variant="caption">
            {BARCODE_SCAN.barcodeReadLabel}
          </Text>
          {/* The design opens the code's letters up a little from the numeral style's own tracking. */}
          <Text className="tracking-[0.02em]" variant="numeral-small">
            {code}
          </Text>
        </View>
      </View>
    </Card>
  );
}
