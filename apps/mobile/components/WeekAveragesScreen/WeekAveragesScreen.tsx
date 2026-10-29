import { useProfileTimeZone } from "@keylow/api-client";
import { DASHBOARD_LOAD_FAILED, WEEK_AVERAGES } from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { ErrorState, SheetHeader, Skeleton } from "../ui";
import { WeekAverages } from "./WeekAverages";

function WeekAveragesForZone({ timeZone }: { timeZone: string }) {
  return <WeekAverages isReadEnabled today={toLocalDate(useNow(), timeZone)} />;
}

/**
 * The weekly averages screen, pushed over the tabs by the dashboard's This week card: a stack header with
 * Back, then the week's averages once the profile's time zone says which day today is, and so which week.
 * Nothing is read while the terms gate is up.
 */
export function WeekAveragesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isReadEnabled = useReadsEnabled();
  const timeZone = useProfileTimeZone({ enabled: isReadEnabled });

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to the Dashboard instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/dashboard");
    }
  }

  function renderBody() {
    // A refetch that fails keeps the zone it already has: only a read that never produced one is a failure.
    if (timeZone.isError && timeZone.data === undefined) {
      return (
        <ErrorState
          body={DASHBOARD_LOAD_FAILED.body}
          retry={{
            label: DASHBOARD_LOAD_FAILED.action,
            onPress: () => {
              void timeZone.refetch();
            },
          }}
          title={DASHBOARD_LOAD_FAILED.title}
        />
      );
    }
    if (!isReadEnabled || timeZone.data === undefined) {
      return (
        <View className="px-4 pt-2">
          <Skeleton variant="group" rows={4} />
        </View>
      );
    }

    // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
    return <WeekAveragesForZone timeZone={timeZone.data ?? "UTC"} />;
  }

  return (
    // The insets are runtime values no class can name, so they go through variables, as the About screen's do.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: WEEK_AVERAGES.back, onPress: goBack }}
        title={WEEK_AVERAGES.title}
        variant="stack"
      />
      {renderBody()}
    </View>
  );
}
