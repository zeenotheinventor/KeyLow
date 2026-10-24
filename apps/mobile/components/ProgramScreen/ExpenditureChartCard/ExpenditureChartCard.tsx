import { PROGRAM_CHART, PROGRAM_ERROR } from "@keylow/core/copy";
import { View } from "react-native";

import { useExpenditureChart } from "./useExpenditureChart";
import { Card, EmptyState, ErrorState, LineChart, Text } from "../../ui";

/**
 * The expenditure estimate week by week with its likely range (`expenditure-chart: default`): the line chart
 * with its band and legend in a card, named by the sentence written under it. With no estimate yet the card keeps
 * its label over the empty state, and a history that cannot be read is an error state with a retry in the card's
 * place, so the rest of the screen stands. It draws nothing while the history is being read.
 */
export function ExpenditureChartCard() {
  const state = useExpenditureChart();

  switch (state.status) {
    case "pending":
      return null;
    case "error":
      return (
        <ErrorState
          body={PROGRAM_ERROR.body}
          retry={{ label: PROGRAM_ERROR.retryLabel, onPress: state.retry }}
          title={PROGRAM_ERROR.title}
          variant="card"
        />
      );
    case "empty":
      return (
        <View className="gap-2">
          <Text className="px-1" tone="secondary" variant="caption">
            {PROGRAM_CHART.label}
          </Text>
          <EmptyState
            body={PROGRAM_CHART.empty.body}
            icon="ChartLine"
            title={PROGRAM_CHART.empty.title}
            variant="card"
          />
        </View>
      );
    case "chart":
      return (
        <Card>
          <LineChart
            band={state.view.band}
            formatValue={state.view.formatValue}
            label={state.view.label}
            legend={state.view.legend}
            points={state.view.points}
            summary={state.view.summary}
            unit={state.view.unit}
          />
        </Card>
      );
  }
}
