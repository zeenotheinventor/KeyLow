import { useEffect } from "react";

import { DashboardBodyChartSetting } from "./DashboardBodyChartSetting";
import { useDashboardBodyChart } from "../../lib/dashboardBodyChart";
import { Card } from "../ui";

import type { DashboardBodyChart } from "@keylow/core/training";
import type { Meta, StoryObj } from "@storybook/react-native";

// The setting reads and writes the choice kept on the device, so a story picks the chart through the same hook.
function WithChart({ chart }: { chart: DashboardBodyChart }) {
  const { setChart } = useDashboardBodyChart();

  useEffect(() => {
    setChart(chart);
  }, [chart, setChart]);

  return (
    <Card padding={0}>
      <DashboardBodyChartSetting />
    </Card>
  );
}

const meta = {
  title: "More/DashboardBodyChartSetting",
  component: WithChart,
  args: { chart: "heat" },
} satisfies Meta<typeof WithChart>;

export default meta;

type Story = StoryObj<typeof meta>;

// Heat, the default, with its caption.
export const Heat: Story = {};

// Weekly volume chosen, with its caption.
export const WeeklyVolume: Story = { args: { chart: "volume" } };
