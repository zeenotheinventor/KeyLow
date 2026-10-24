import { PROGRAM_ERROR, PROGRAM_SCREEN } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExpenditureHeroCard } from "./ExpenditureHeroCard";
import { NoProgramView } from "./NoProgramView";
import { SettlingChecklist } from "./SettlingChecklist";
import { useProgramScreen } from "./useProgramScreen";
import { WeekTargetsCard } from "./WeekTargetsCard";
import { YourProgramme } from "./YourProgramme";
import { ErrorState, SheetHeader, Skeleton, Text } from "../ui";

/**
 * The Programme screen, pushed inside the More tab so the tab bar stays: the header with Back, then the
 * estimate, what the first check-in needs while settling, this week's targets and the programme's own settings,
 * or the no-program, loading and error boards.
 * The estimate says it is an estimate, and the screen ends with the not-medical-advice line. The cards the
 * check-in, the chart, the explainer and the edit add come with their own screens.
 */
export function ProgramScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const state = useProgramScreen();

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to More instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more");
    }
  }

  function renderBody() {
    switch (state.status) {
      case "loading":
        return (
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
      case "program":
        return (
          <ScrollView className="flex-1" contentContainerClassName="gap-3 px-4 pb-6 pt-1">
            <ExpenditureHeroCard view={state.view.hero} />
            {state.view.settlingChecklist === null ? null : (
              <SettlingChecklist {...state.view.settlingChecklist} />
            )}
            {state.view.targets === null ? null : <WeekTargetsCard view={state.view.targets} />}
            <YourProgramme rows={state.view.details} />
            <Text className="px-1" tone="muted" variant="caption">
              {PROGRAM_SCREEN.notMedicalAdvice}
            </Text>
          </ScrollView>
        );
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
