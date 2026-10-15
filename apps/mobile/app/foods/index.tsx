import { useLocalSearchParams, useRouter } from "expo-router";

import { FoodSearch } from "../../components/FoodSearch";
import { readLogContext, withLogContext } from "../../lib/navigation";

/**
 * The root of the food search sheet. `/foods?scope=own` is the same sheet titled "Your foods", which
 * More, Your foods opens. The sheet is presented over the tabs, so closing it goes back to where it was
 * opened.
 */
export default function FoodSearchRoute() {
  const router = useRouter();
  const { scope, day, time } = useLocalSearchParams<{
    scope?: string;
    day?: string;
    time?: string;
  }>();
  const logContext = readLogContext({ day, time });

  return (
    <FoodSearch
      scope={scope === "own" ? "own" : "all"}
      onClose={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)/dashboard");
        }
      }}
      onCreateFood={() => {
        router.push("/foods/new");
      }}
      onOpenFood={(foodId) => {
        router.push(`/foods/${foodId}`);
      }}
      onScanBarcode={() => {
        // While food is being logged the scanner carries the day and the time on to the portion picker.
        router.push(withLogContext("/foods/scan", logContext));
      }}
    />
  );
}
