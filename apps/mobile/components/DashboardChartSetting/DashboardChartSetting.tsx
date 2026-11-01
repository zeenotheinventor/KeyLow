import { MORE_SCREEN } from "@keylow/core/copy";
import { View } from "react-native";

import { useDashboardBodyScale } from "../../lib/dashboardBodyScale";
import { ListRow, SegmentedControl, Text } from "../ui";

import type { SegmentedControlOption } from "../ui";
import type { DashboardBodyScale } from "@keylow/core/training";

const { dashboardChart } = MORE_SCREEN.settings;

const options: SegmentedControlOption<DashboardBodyScale>[] = [
  { value: "heat", label: dashboardChart.options.heat },
  { value: "volume", label: dashboardChart.options.volume },
];

/**
 * The Dashboard chart setting of More, drawn as the Body map setting is inside the Settings card: a row with
 * an icon and the name, over a segmented control of Heat and Weekly volume. It picks the chart of the
 * dashboard's body map card. The choice applies at once and is kept per device, and the control always
 * shows what was chosen. Under Weekly volume the row says which days the week counts.
 */
export function DashboardChartSetting() {
  const { scale, setScale } = useDashboardBodyScale();

  return (
    <ListRow icon="LayoutDashboard" title={dashboardChart.title}>
      <View className="gap-2">
        <SegmentedControl
          label={dashboardChart.title}
          options={options}
          value={scale}
          onChange={setScale}
        />
        {scale === "volume" ? (
          <Text className="px-1" tone="secondary" variant="caption">
            {dashboardChart.volumeNote}
          </Text>
        ) : null}
      </View>
    </ListRow>
  );
}
