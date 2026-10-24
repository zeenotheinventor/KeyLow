import { PROGRAM_ERROR, PROGRAM_SCREEN } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CheckinSummaryCard } from "./CheckinSummaryCard";
import { ExpenditureChartCard } from "./ExpenditureChartCard";
import { ExpenditureHeroCard } from "./ExpenditureHeroCard";
import { NoProgramView } from "./NoProgramView";
import { SettlingChecklist } from "./SettlingChecklist";
import { useProgramScreen } from "./useProgramScreen";
import { WeekTargetsCard } from "./WeekTargetsCard";
import { YourProgramme } from "./YourProgramme";
import { useCheckinArrival } from "../../lib/checkinSeen";
import { haptic } from "../../lib/haptics";
import { useOpenOnce } from "../../lib/useOpenOnce";
import { ErrorState, GroupedList, ListRow, SheetHeader, Skeleton, Text } from "../ui";

/**
 * The Programme screen, pushed inside the More tab so the tab bar stays: the header with Back, then the
 * estimate, what the first check-in needs while settling, this week's targets, what the last check-in changed
 * and the programme's own settings, or the no-program, loading and error boards.
 * The estimate says it is an estimate, and the screen ends with the not-medical-advice line. How it works opens
 * the explainer sheet, and Edit programme opens the edit form. The chart comes with its own card.
 * The first open after a new check-in (remembered per device by its date) counts the estimate up from the one
 * before, flashes the accent, cuts the check-in card in and plays the complete haptic, once.
 */
export function ProgramScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const openOnce = useOpenOnce();
  const state = useProgramScreen();
  const { isRead: isCheckinRead, isNew: isCheckinNew } = useCheckinArrival(
    state.status === "program" ? (state.view.checkin?.date ?? null) : null,
  );
  useEffect(() => {
    if (isCheckinNew) {
      void haptic.complete();
    }
  }, [isCheckinNew]);

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to More instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more");
    }
  }

  const loadingBody = (
    <View
      accessible
      aria-label={PROGRAM_SCREEN.loadingName}
      aria-live="polite"
      className="flex-1 px-4 pt-1"
      role="status"
    >
      <Skeleton variant="program" />
    </View>
  );

  function renderBody() {
    // The hero reads its arrival when it is mounted, so the programme waits for the device's answer. This matters
    // when the programme is already held, as it is when the screen is opened from More. An unreadable store answers too.
    if (state.status === "program" && !isCheckinRead) {
      return loadingBody;
    }
    switch (state.status) {
      case "loading":
        return loadingBody;
      case "error":
        return (
          <View className="flex-1 pb-16">
            <ErrorState
              body={PROGRAM_ERROR.body}
              retry={{ label: PROGRAM_ERROR.retryLabel, onPress: state.retry }}
              title={PROGRAM_ERROR.title}
            />
          </View>
        );
      case "no-program":
        return <NoProgramView ownTargetKcal={state.ownTargetKcal} />;
      case "program": {
        const { checkin, hero } = state.view;
        return (
          <ScrollView className="flex-1" contentContainerClassName="gap-3 px-4 pb-6 pt-1">
            <ExpenditureHeroCard
              arrival={
                isCheckinNew && checkin !== null
                  ? { fromKcal: checkin.previousMuKcal ?? hero.muKcal }
                  : null
              }
              view={hero}
            />
            {state.view.settlingChecklist === null ? null : (
              <SettlingChecklist {...state.view.settlingChecklist} />
            )}
            {state.view.targets === null ? null : <WeekTargetsCard view={state.view.targets} />}
            {checkin === null ? null : (
              <CheckinSummaryCard {...checkin.card} isArriving={isCheckinNew} />
            )}
            <ExpenditureChartCard />
            <YourProgramme rows={state.view.details} />
            <GroupedList hidesTitle title={PROGRAM_SCREEN.title}>
              <ListRow
                icon="Pencil"
                title={PROGRAM_SCREEN.editLabel}
                onPress={() => {
                  openOnce(() => {
                    router.push("/more/program/edit");
                  });
                }}
              />
              <ListRow
                icon="Info"
                title={PROGRAM_SCREEN.howItWorksLabel}
                onPress={() => {
                  openOnce(() => {
                    router.push("/more/program/explainer");
                  });
                }}
              />
            </GroupedList>
            <Text className="px-1" tone="muted" variant="caption">
              {PROGRAM_SCREEN.notMedicalAdvice}
            </Text>
          </ScrollView>
        );
      }
    }
  }

  return (
    // The top inset is a runtime value no class can name, so it goes through a variable, as the Targets screen's does.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: PROGRAM_SCREEN.backName, onPress: goBack }}
        title={PROGRAM_SCREEN.title}
      />
      {renderBody()}
    </View>
  );
}
