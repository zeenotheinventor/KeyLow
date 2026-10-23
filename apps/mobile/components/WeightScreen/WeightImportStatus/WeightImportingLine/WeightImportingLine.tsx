import { WEIGHT_IMPORT_STATUS } from "@keylow/core/copy";
import { View } from "react-native";

import { SpinningGlyph } from "../../../SpinningGlyph";
import { Icon, Text } from "../../../ui";

/**
 * The line above the Weight screen's content while an import runs, as `weight: chart and weigh-ins · importing`
 * draws it: a turning ring and "Importing from Health Connect", centred. It is a status, so a screen reader
 * announces it.
 */
export function WeightImportingLine() {
  return (
    <View
      accessible
      aria-live="polite"
      className="flex-row items-center justify-center gap-2 pb-3 pt-2"
      role="status"
    >
      <SpinningGlyph>
        <Icon name="LoaderCircle" size={18} strokeWidth={2} tone="accent-ink" />
      </SpinningGlyph>
      <Text tone="secondary" variant="label-small">
        {WEIGHT_IMPORT_STATUS.importing}
      </Text>
    </View>
  );
}
