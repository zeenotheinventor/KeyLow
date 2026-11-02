import { MORE_SCREEN } from "@keylow/core/copy";
import { View } from "react-native";

import { useDashboardBodyChart } from "../../lib/dashboardBodyChart";
import { ListRow, SegmentedControl, Text } from "../ui";

import type { SegmentedControlOption } from "../ui";
import type { DashboardBodyChart } from "@keylow/core/training";

const { dashboardBodyChart } = MORE_SCREEN.settings;

const options: SegmentedControlOption<DashboardBodyChart>[] = [
  { value: "heat", label: dashboardBodyChart.options.heat },
  { value: "volume", label: dashboardBodyChart.options.volume },
];

/**
 * The Dashboard body map setting of More, as the `tab-shell.more · dashboard-chart-setting` board draws it
 * inside the Settings card: a row with an icon and the name, over a segmented control of Heat and Weekly
 * volume, and a caption that says what the chosen one shows. The choice applies at once and is kept per
 * device, and the control always shows what was chosen.
 */
export function DashboardBodyChartSetting() {
  const { chart, setChart } = useDashboardBodyChart();

  return (
    <ListRow icon="LayoutDashboard" title={dashboardBodyChart.title}>
      <View className="gap-2">
        <SegmentedControl
          label={dashboardBodyChart.title}
          options={options}
          value={chart}
          onChange={setChart}
        />
        <Text className="px-1" tone="secondary" variant="caption">
          {dashboardBodyChart.captions[chart]}
        </Text>
      </View>
    </ListRow>
  );
}
