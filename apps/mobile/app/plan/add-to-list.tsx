import { useLocalSearchParams } from "expo-router";

import { PlanAddToListScreen } from "../../components/PlanAddToListScreen";
import { PLAN_ADD_END_PARAMETER, PLAN_ADD_START_PARAMETER } from "../../lib/planRoutes";

// A standard stack push over the Plan screen or a day of it, from the footer of the week or the day's button. The
// root layout's AuthGate covers it and the root stack gives it no header. A repeated parameter arrives as an
// array, so the first value is used.
export default function PlanAddToListRoute() {
  const parameters = useLocalSearchParams<{
    [PLAN_ADD_START_PARAMETER]?: string | string[];
    [PLAN_ADD_END_PARAMETER]?: string | string[];
  }>();
  const start = parameters[PLAN_ADD_START_PARAMETER];
  const end = parameters[PLAN_ADD_END_PARAMETER];

  return (
    <PlanAddToListScreen
      end={Array.isArray(end) ? end[0] : end}
      start={Array.isArray(start) ? start[0] : start}
    />
  );
}
