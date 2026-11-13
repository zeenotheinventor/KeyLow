import { useMealPlanRepeatLimit } from "@keylow/api-client";
import {
  FIRST_PLAN_VARIETY_WORDS,
  MEAL_PLAN_WORDS,
  RETRY_LABEL,
  describePlanPrefill,
  describeWeekRange,
} from "@keylow/core/copy";
import { isCalendarDay } from "@keylow/core/dates";
import { nextWeek, previousWeek } from "@keylow/core/diary";
import {
  planOpeningDayOf,
  planPrefillDatesOf,
  planStripMarkOf,
  planWeekViewOf,
} from "@keylow/core/plans";
import { useLocalSearchParams, useRouter } from "expo-router";
import { vars } from "nativewind";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlanDayCard } from "./PlanDayCard";
import { usePlanData } from "./usePlanData";
import { PLAN_DAY_PARAMETER, PLAN_SETTINGS_PATH, planDayPath } from "../../lib/planRoutes";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { useOpenAssistant } from "../AssistantSheetHost";
import { Banner, EmptyState, ErrorState, SheetHeader, Skeleton, WeekStrip } from "../ui";

/**
 * The Plan screen, pushed over the tabs from the Diary's More sheet or its planned row, or from a plan card's
 * link (`plan · week`, `plan · empty` and `plan · first-plan-variety`): the week that holds today, or the day
 * the link names, as a strip of seven days and a card for each day that is planned. A day's card shows its
 * figures against that day's own target and opens the day. The newest plan wins a date several plans cover.
 * With nothing planned in the week the empty state offers Plan my week, which opens the assistant with the
 * words in its composer and sends nothing. While the person has not chosen a repeat limit a banner says the
 * starting limit applies, with a link to the settings.
 */
export function PlanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const openAssistant = useOpenAssistant();
  const isReadEnabled = useReadsEnabled();
  const { views, today, isError, refetch } = usePlanData();
  const repeatLimit = useMealPlanRepeatLimit({ enabled: isReadEnabled });
  const { [PLAN_DAY_PARAMETER]: dayParameter } = useLocalSearchParams<{
    day?: string | string[];
  }>();
  const linkedDay = Array.isArray(dayParameter) ? dayParameter[0] : dayParameter;

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to the Diary instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/diary");
    }
  }

  // The week the person has moved to, or null for the week it opened on: the linked day's, today's, or the first
  // week with a planned day when today's has none.
  const [shownDay, setShownDay] = useState<string | null>(null);
  const openingDay =
    today === undefined || views === undefined
      ? undefined
      : planOpeningDayOf(
          views,
          today,
          linkedDay !== undefined && isCalendarDay(linkedDay) ? linkedDay : undefined,
        );
  const anchor = shownDay ?? openingDay;
  const week =
    anchor === undefined || views === undefined ? undefined : planWeekViewOf(views, anchor);

  function renderBody() {
    if (isError) {
      return (
        <ErrorState
          body={MEAL_PLAN_WORDS.loadFailedBody}
          retry={{ label: RETRY_LABEL, onPress: refetch }}
          title={MEAL_PLAN_WORDS.loadFailedTitle}
        />
      );
    }
    if (week === undefined || today === undefined) {
      return (
        <View
          accessible
          aria-label={MEAL_PLAN_WORDS.title}
          aria-live="polite"
          className="px-4"
          role="status"
        >
          <Skeleton variant="group" rows={4} />
        </View>
      );
    }
    const strip = (
      <WeekStrip
        canSelectFutureDays
        days={week.days.map(({ localDate, view }) => ({
          localDate,
          isComplete: false,
          isUnavailable: view === null,
          mark: planStripMarkOf(view),
        }))}
        selectedDate={today}
        today={today}
        onSelectDay={(localDate) => {
          router.push(planDayPath(localDate));
        }}
        onWeekChange={(direction) => {
          const days =
            direction === "previous" ? previousWeek(week.weekStart) : nextWeek(week.weekStart);
          setShownDay(days[0] ?? week.weekStart);
        }}
      />
    );
    if (week.planned.length === 0) {
      const { start, end } = planPrefillDatesOf(today);
      const emptyState = (
        <EmptyState
          action={{
            label: MEAL_PLAN_WORDS.emptyAction,
            icon: "Sparkles",
            variant: "primary",
            onPress: () => {
              openAssistant({ localDate: today, draft: describePlanPrefill(start, end) });
            },
          }}
          body={MEAL_PLAN_WORDS.emptyBody}
          icon="CalendarDays"
          title={MEAL_PLAN_WORDS.emptyTitle}
        />
      );
      // Moved to a week with nothing planned, the strip stays so the person can go on to another week.
      return shownDay === null ? (
        emptyState
      ) : (
        <>
          {strip}
          {emptyState}
        </>
      );
    }
    return (
      <>
        {strip}
        <ScrollView className="flex-1" contentContainerClassName="gap-3 px-4 pb-6 pt-1">
          {repeatLimit.data === null ? (
            <Banner
              action={{
                label: FIRST_PLAN_VARIETY_WORDS.action,
                onPress: () => {
                  router.push(PLAN_SETTINGS_PATH);
                },
              }}
              body={FIRST_PLAN_VARIETY_WORDS.body}
              icon="Repeat2"
              title={FIRST_PLAN_VARIETY_WORDS.title}
              variant="info"
            />
          ) : null}
          {week.planned.map((view) => (
            <PlanDayCard
              key={view.dayId}
              isToday={view.localDate === today}
              view={view}
              onPress={() => {
                router.push(planDayPath(view.localDate));
              }}
            />
          ))}
        </ScrollView>
      </>
    );
  }

  return (
    // The insets are runtime values no class can name, so they go through variables, as the About screen's do.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: MEAL_PLAN_WORDS.back, onPress: goBack }}
        subtitle={
          // The empty state, as `plan · empty` draws it, has no line under the title.
          week === undefined || (week.planned.length === 0 && shownDay === null)
            ? undefined
            : describeWeekRange(week.weekStart)
        }
        title={MEAL_PLAN_WORDS.title}
        trailing={{
          icon: "SlidersHorizontal",
          label: MEAL_PLAN_WORDS.settingsLabel,
          onPress: () => {
            router.push(PLAN_SETTINGS_PATH);
          },
        }}
        variant="stack"
      />
      {renderBody()}
    </View>
  );
}
