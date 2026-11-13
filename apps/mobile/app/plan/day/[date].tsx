import { useLocalSearchParams } from "expo-router";

import { PlanDayScreen } from "../../../components/PlanDayScreen";

// A standard stack push over the Plan screen. A repeated parameter arrives as an array, so the first value is used.
export default function PlanDayRoute() {
  const { date } = useLocalSearchParams<{ date: string | string[] }>();

  return <PlanDayScreen localDate={Array.isArray(date) ? (date[0] ?? "") : date} />;
}
