import { useMealPlanRepeatLimit, useSetMealPlanRepeatLimit } from "@keylow/api-client";
import {
  MEAL_PLAN_WORDS,
  PLAN_SETTINGS_WORDS,
  REPEAT_LIMIT_CHOICES,
  RETRY_LABEL,
} from "@keylow/core/copy";
import { repeatLimitSelectionOf } from "@keylow/core/plans";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { ErrorState, OptionCardGroup, SheetHeader, Skeleton, Text, useToast } from "../ui";

import type { RepeatLimitAnswer } from "./types";

/**
 * The plan settings (`plan · settings`): "How often can a recipe repeat?" with eight answers, once a week to seven
 * times a week and No limit. An answer saves at once to the profile (1 to 7, or 0 for no limit) with a toast, and
 * there is no Save button. While nothing is chosen the starting limit of twice a week is marked as such. A new limit
 * applies to the next plan and to any day regenerated, and days already planned stay as they are.
 */
export function PlanSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const isReadEnabled = useReadsEnabled();
  const limit = useMealPlanRepeatLimit({ enabled: isReadEnabled });
  const save = useSetMealPlanRepeatLimit();

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/plan");
    }
  }

  function renderBody() {
    if (limit.data === undefined) {
      if (limit.isError) {
        return (
          <ErrorState
            body={PLAN_SETTINGS_WORDS.loadFailedBody}
            retry={{
              label: RETRY_LABEL,
              onPress: () => {
                void limit.refetch();
              },
            }}
            title={PLAN_SETTINGS_WORDS.loadFailedTitle}
          />
        );
      }
      return (
        <View
          accessible
          aria-label={PLAN_SETTINGS_WORDS.title}
          aria-live="polite"
          className="px-4"
          role="status"
        >
          <Skeleton variant="group" rows={4} />
        </View>
      );
    }
    const selection = repeatLimitSelectionOf(limit.data);
    const answers: RepeatLimitAnswer[] = REPEAT_LIMIT_CHOICES.map(
      ({ value, title, description }) => ({
        id: String(value),
        title,
        description,
        badge:
          selection.isStarting && value === selection.value
            ? { tone: "neutral", outlined: true, children: PLAN_SETTINGS_WORDS.startingLimit }
            : undefined,
      }),
    );

    return (
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-4 pb-6 pt-1">
        <View className="gap-1 px-1">
          <Text role="heading" variant="h2">
            {PLAN_SETTINGS_WORDS.question}
          </Text>
          <Text tone="secondary">{PLAN_SETTINGS_WORDS.hint}</Text>
        </View>
        <OptionCardGroup
          label={PLAN_SETTINGS_WORDS.question}
          options={answers}
          value={String(selection.value)}
          onChange={(id) => {
            save.mutate(Number(id), {
              onSuccess: () => {
                toast.show({ message: PLAN_SETTINGS_WORDS.saved, tone: "success", icon: "Check" });
              },
              onError: () => {
                toast.show({
                  message: PLAN_SETTINGS_WORDS.saveFailed,
                  tone: "danger",
                  icon: "CircleAlert",
                });
              },
            });
          }}
        />
        <Text className="px-1" tone="muted" variant="caption">
          {PLAN_SETTINGS_WORDS.caption}
        </Text>
      </ScrollView>
    );
  }

  return (
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: MEAL_PLAN_WORDS.back, onPress: goBack }}
        title={PLAN_SETTINGS_WORDS.title}
        variant="stack"
      />
      {renderBody()}
    </View>
  );
}
