import { useConfirmPlanDay, useTargets } from "@keylow/api-client";
import {
  MEAL_PLAN_BAND_NAMES,
  MEAL_PLAN_WORDS,
  RETRY_LABEL,
  describePlanConfirmCaption,
  describePlanConfirmedBody,
  describePlanDaySubtitle,
  describePlanTolerance,
  describeReplanPrefill,
  describeDateInWords,
} from "@keylow/core/copy";
import { progressBars } from "@keylow/core/diary";
import { PLAN_STATUS_BADGE, planProgressTargetsOf, planShortBannerOf } from "@keylow/core/plans";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useIsOnline } from "../../lib/connectivity";
import { diaryHref } from "../../lib/navigation";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { useOpenAssistant } from "../AssistantSheetHost";
import { usePlanData } from "../PlanScreen";
import {
  Badge,
  Banner,
  Button,
  Card,
  ErrorState,
  GroupedList,
  ListRow,
  MacroProgressStrip,
  SheetHeader,
  Skeleton,
  Text,
  useToast,
} from "../ui";

import type { PlanDayScreenProps } from "./types";

/**
 * One day of the plan (`plan · day`, `plan · day-confirmed` and `plan · day-short`): the totals against the
 * day's target with its status, the review banner of a short day, the items in their bands, and at the foot Confirm
 * day (which writes the items to the diary through `confirm_meal_plan_day`) and Regenerate day (which opens the
 * assistant with "Replan Wed 18 Nov: " in the composer and sends nothing). A confirmed day is final: it shows
 * a banner with a link to the diary, a tick on each item and no buttons, and cannot be confirmed again. A short day
 * can still be confirmed.
 */
export function PlanDayScreen({ localDate }: PlanDayScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const isOnline = useIsOnline();
  const isReadEnabled = useReadsEnabled();
  const openAssistant = useOpenAssistant();
  const { views, rawDayOf, timeZone, isError, refetch } = usePlanData();
  const confirm = useConfirmPlanDay();
  const targets = useTargets({ enabled: isReadEnabled, localDate });
  const view = views?.find((candidate) => candidate.localDate === localDate);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/plan");
    }
  }

  function confirmDay() {
    // A second tap while the first is being written must not send the day again.
    if (confirm.isPending || view === undefined || timeZone === undefined) {
      return;
    }
    const day = rawDayOf(view.dayId);
    if (day === undefined) {
      return;
    }
    confirm.mutate(
      { day, timeZone },
      {
        onError: () => {
          toast.show({
            message: MEAL_PLAN_WORDS.confirmFailed,
            tone: "danger",
            icon: "CircleAlert",
          });
        },
      },
    );
  }

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
    if (views === undefined) {
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
    if (view === undefined) {
      return (
        <ErrorState
          action={{ label: MEAL_PLAN_WORDS.back, onPress: goBack }}
          title={MEAL_PLAN_WORDS.dayNotFoundTitle}
        />
      );
    }

    const badge = PLAN_STATUS_BADGE[view.status];
    const shortBanner = planShortBannerOf(view);
    const tolerance = view.status === "empty" ? null : describePlanTolerance(view.target);
    const bars = progressBars(
      {
        kcal: view.totals.kcal,
        protein_g: view.totals.protein_g,
        carbs_g: view.totals.carbs_g,
        fat_g: view.totals.fat_g,
      },
      planProgressTargetsOf(view, targets.data ?? null),
    );

    return (
      <>
        <ScrollView className="flex-1" contentContainerClassName="gap-3 px-4 pb-6 pt-1">
          <Card>
            <View className="gap-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text role="heading" variant="body-strong">
                  {view.isConfirmed ? MEAL_PLAN_WORDS.loggedFromPlan : MEAL_PLAN_WORDS.planned}
                </Text>
                <Badge
                  dot={view.status === "confirmed" || view.status === "short"}
                  outlined={view.status === "within" || view.status === "empty"}
                  tone={badge.tone}
                >
                  {badge.label}
                </Badge>
              </View>
              <MacroProgressStrip
                bars={bars}
                label={view.isConfirmed ? MEAL_PLAN_WORDS.loggedFromPlan : MEAL_PLAN_WORDS.planned}
                surface="card"
              />
            </View>
          </Card>
          {view.isConfirmed ? (
            <Banner
              action={{
                label: MEAL_PLAN_WORDS.openInDiary,
                onPress: () => {
                  router.push(diaryHref(localDate));
                },
              }}
              body={describePlanConfirmedBody(view.itemCount)}
              title={MEAL_PLAN_WORDS.confirmedBannerTitle}
              variant="success"
            />
          ) : shortBanner === null ? (
            tolerance === null ? null : (
              <Text className="px-1" tone="secondary" variant="caption">
                {tolerance}
              </Text>
            )
          ) : (
            <Banner body={shortBanner.body} title={shortBanner.title} variant="review" />
          )}
          {view.bands.map((band) => (
            <View key={band.band} className="gap-2">
              <View className="flex-row items-baseline justify-between gap-2 px-1">
                <Text role="heading" variant="body-strong">
                  {MEAL_PLAN_BAND_NAMES[band.band]}
                  <Text tone="muted" variant="caption">{` ${band.time}`}</Text>
                </Text>
                <Text tone="secondary" variant="caption">
                  {band.summary}
                </Text>
              </View>
              <GroupedList
                hidesTitle
                label={`${MEAL_PLAN_BAND_NAMES[band.band]} ${band.time}`}
                title={MEAL_PLAN_BAND_NAMES[band.band]}
              >
                {band.items.map((item) => (
                  <ListRow
                    key={item.id}
                    badge={item.badge === null ? undefined : { label: item.badge, tone: "neutral" }}
                    chevron={false}
                    subtitle={item.detail}
                    title={item.name}
                    {...(item.kcalText === null ? {} : { value: item.kcalText })}
                    {...(view.isConfirmed
                      ? { trailing: { kind: "tick" as const, label: MEAL_PLAN_WORDS.inDiaryTick } }
                      : {})}
                  />
                ))}
              </GroupedList>
            </View>
          ))}
        </ScrollView>
        <View className="gap-3 border-t border-border bg-background px-4 pb-2 pt-3">
          {view.isConfirmed ? (
            <Text className="text-center" tone="muted" variant="caption">
              {MEAL_PLAN_WORDS.confirmedFooter}
            </Text>
          ) : (
            <>
              <Text className="text-center" tone="muted" variant="caption">
                {view.status === "empty"
                  ? MEAL_PLAN_WORDS.emptyDayCaption
                  : describePlanConfirmCaption(view.itemCount)}
              </Text>
              <View className="flex-row gap-3">
                <Button
                  className="flex-1"
                  disabled={!isOnline || view.itemCount === 0}
                  loading={confirm.isPending}
                  onPress={confirmDay}
                >
                  {MEAL_PLAN_WORDS.confirmDay}
                </Button>
                <Button
                  className="flex-1"
                  icon="Sparkles"
                  variant="secondary"
                  onPress={() => {
                    openAssistant({ localDate, draft: describeReplanPrefill(localDate) });
                  }}
                >
                  {MEAL_PLAN_WORDS.regenerateDay}
                </Button>
              </View>
            </>
          )}
        </View>
      </>
    );
  }

  return (
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: MEAL_PLAN_WORDS.back, onPress: goBack }}
        subtitle={
          view === undefined ? undefined : describePlanDaySubtitle(view.planStart, view.planEnd)
        }
        title={describeDateInWords(localDate)}
        variant="stack"
      />
      {renderBody()}
    </View>
  );
}
