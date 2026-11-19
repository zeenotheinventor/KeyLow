import { achievementsOverview, unseenIdsOf } from "@keylow/core";
import { ACHIEVEMENTS_SCREEN } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { useEffect, useMemo } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { achievementPath } from "../../lib/achievementRoutes";
import { useCelebrationQueue } from "../../lib/achievements";
import { useIsOnline } from "../../lib/connectivity";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { Banner, Button, ErrorState, Skeleton, Text } from "../ui";
import { CategorySection } from "./CategorySection";
import { LevelCard } from "./LevelCard";
import { StatTiles } from "./StatTiles";
import { useAchievementsState } from "./useAchievementsState";
import { useMarkAchievementsSeen } from "./useMarkAchievementsSeen";

/**
 * The Achievements screen, pushed inside the More tab (board 1): the level and points, the streak, the freezes
 * and the badge count, then every category with its badges. It loads as a skeleton that shows after 200 ms, says
 * so when offline while it shows what it last read, and has its own error state with Try again. Opening it marks
 * every held row not yet seen as seen, the backfilled ones included, and tells the celebration queue the same
 * ids, so a toast never follows for a badge the person has now looked at.
 */
export function AchievementsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isOnline = useIsOnline();
  const state = useAchievementsState({ enabled: useReadsEnabled() });
  const { acknowledge } = useCelebrationQueue();
  const markSeen = useMarkAchievementsSeen();
  const { data } = state;

  const unseenKey = data === undefined ? "" : unseenIdsOf(data.held).join(",");
  useEffect(() => {
    if (unseenKey === "") {
      return;
    }
    const ids = unseenKey.split(",");
    acknowledge(ids);
    void markSeen(ids);
  }, [unseenKey, acknowledge, markSeen]);

  const overview = useMemo(
    () =>
      data === undefined
        ? undefined
        : achievementsOverview({
            results: data.run.perAchievementProgress,
            level: data.run.level,
            streakDays: data.run.streaks.daily.current,
            freezes: data.run.streaks.daily.freezesHeld,
          }),
    [data],
  );

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to More instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more");
    }
  }

  function renderBody() {
    if (overview === undefined) {
      if (state.isError) {
        return (
          <ErrorState
            body={ACHIEVEMENTS_SCREEN.error.body}
            retry={{
              label: ACHIEVEMENTS_SCREEN.error.retry,
              onPress: () => {
                void state.refetch();
              },
            }}
            title={ACHIEVEMENTS_SCREEN.error.title}
          />
        );
      }
      return (
        <View
          aria-busy
          aria-label={ACHIEVEMENTS_SCREEN.loadingLabel}
          className="flex-1 px-5"
          role="progressbar"
        >
          <Skeleton variant="achievements" />
        </View>
      );
    }

    return (
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-5 pb-4">
        {isOnline ? null : (
          <Banner sentence title={ACHIEVEMENTS_SCREEN.offline} variant="offline" />
        )}
        <LevelCard level={overview.level} />
        <StatTiles tiles={overview.tiles} />
        {overview.categories.map((category) => (
          <CategorySection
            key={category.category}
            category={category}
            onOpenBadge={(id) => {
              router.push(achievementPath(id));
            }}
          />
        ))}
      </ScrollView>
    );
  }

  return (
    <View className="flex-1">
      {/* The inset is a runtime value no class can name, so it goes through a variable, as the screen header's does. */}
      <View
        className="items-start px-5 pt-[var(--inset-top)]"
        style={vars({ "--inset-top": insets.top })}
      >
        <Button
          accessibilityLabel={ACHIEVEMENTS_SCREEN.backAccessibilityLabel}
          className="-ml-4"
          icon="ChevronLeft"
          tone="accent-ink"
          variant="ghost"
          onPress={goBack}
        >
          {ACHIEVEMENTS_SCREEN.backLabel}
        </Button>
      </View>
      <Text className="px-5 pb-3" role="heading" variant="h1">
        {ACHIEVEMENTS_SCREEN.title}
      </Text>
      {renderBody()}
    </View>
  );
}
