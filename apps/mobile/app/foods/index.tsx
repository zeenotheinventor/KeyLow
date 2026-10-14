import { useLocalSearchParams, useRouter } from "expo-router";

import { FoodSearch } from "../../components/FoodSearch";

/**
 * The root of the food search sheet. `/foods?scope=own` is the same sheet titled "Your foods", which
 * More, Your foods opens. The sheet is presented over the tabs, so closing it goes back to where it was
 * opened.
 */
export default function FoodSearchRoute() {
  const router = useRouter();
  const { scope } = useLocalSearchParams<{ scope?: string }>();

  return (
    <FoodSearch
      scope={scope === "own" ? "own" : "all"}
      onClose={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)/diary");
        }
      }}
      onCreateFood={() => {
        router.push("/foods/new");
      }}
      onOpenFood={(foodId) => {
        router.push(`/foods/${foodId}`);
      }}
      onScanBarcode={() => {
        router.push("/foods/scan");
      }}
    />
  );
}
