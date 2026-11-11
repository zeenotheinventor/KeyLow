import {
  useAssistantConsent,
  useProfileTimeZone,
  useProgramSummary,
  useTargets,
  useTrainingGoals,
} from "@keylow/api-client";
import {
  ACCOUNT_EXPORT_COPY,
  MORE_SCREEN,
  TAB_TITLES,
  describeAssistantMoreRow,
  describeGoalSetOn,
  describeNextCheckInSubtitle,
} from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import { formatCalories } from "@keylow/core/format";
import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { AppearanceSetting } from "../../../components/AppearanceSetting";
import { BodyMapRendererSetting } from "../../../components/BodyMapRendererSetting";
import { DashboardBodyChartSetting } from "../../../components/DashboardBodyChartSetting";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { GroupedList, ListRow } from "../../../components/ui";
import { goalPath } from "../../../lib/goalRoutes";
import { recipesPath } from "../../../lib/recipeRoutes";
import { signOut } from "../../../lib/signOut";
import { useOpenOnce } from "../../../lib/useOpenOnce";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";

// The sections of the `tab-shell.more` board, with Nutrition between Food and Body. Your foods opens the search
// sheet in its own-foods mode, Targets opens the Targets screen and shows the calorie target once one is set,
// Programme sits under it and opens the Programme screen inside this tab, its subtitle the next check-in or the offer to
// let Ki-Lo set the targets, and Targets says "From your programme" while the programme's targets are in force.
// Recipes is Nutrition's last row and opens the recipe library inside this tab, where it moved from the bar.
// Weight opens the Weight screen inside this tab, and Goal sits under it and opens the Goal screen, which
// shows the current goal's answers and asks the first question itself when there is no goal. Its sub line is
// the day the goal was set or the invitation to set one, and none until both the goal and the time zone it is
// dated in are read, so the invitation does not show and then flip. Appearance, the Body map and the Dashboard body map are set here, and Account
// holds Export my data, which opens its screen inside this tab, above Sign out.
// Assistant is the first row of Settings and opens its settings screen inside this tab, its sub line and value
// following whether the assistant is on, and none until that is read.
// Request a feature is the last row of Settings and opens its screen inside this tab, where a request is typed
// and sent to the Ki-Lo team. No board draws it, so it follows Export my data.
// Reminders and About are under Settings and open their screens. No board draws Reminders, and its icon is the
// clock because the kit has no bell.
export default function MoreRoute() {
  const router = useRouter();
  const isReadEnabled = useReadsEnabled();
  const targets = useTargets({ enabled: isReadEnabled });
  const programSummary = useProgramSummary({ enabled: isReadEnabled });
  const assistantConsent = useAssistantConsent({ enabled: isReadEnabled });
  const trainingGoals = useTrainingGoals({ enabled: isReadEnabled });
  const timeZone = useProfileTimeZone({ enabled: isReadEnabled });
  const openOnce = useOpenOnce();
  const assistantRow = describeAssistantMoreRow(assistantConsent.data?.isOn);
  const kcalTarget = targets.data?.kcal ?? null;
  const program = programSummary.data?.program;
  // Nothing is said until the read is in, and a programme with no check-in date yet has nothing to say.
  const programSubtitle =
    program === undefined
      ? undefined
      : program === null
        ? MORE_SCREEN.nutrition.program.subtitleWithoutProgram
        : program.nextCheckinDate === null
          ? undefined
          : describeNextCheckInSubtitle(program.nextCheckinDate);

  // Nothing is said until the read is in. A goal that cannot be read says nothing either, as it is not known
  // that there is none. A goal is dated in the user's time zone, which is read with it.
  const goal = trainingGoals.data;
  const goalSubtitle =
    goal === undefined
      ? undefined
      : goal === null
        ? MORE_SCREEN.body.goal.subtitleWithoutGoal
        : timeZone.isPending
          ? undefined
          : describeGoalSetOn(toLocalDate(new Date(goal.effective_from), timeZone.data ?? "UTC"));

  return (
    <View className="flex-1">
      <ScreenHeader title={TAB_TITLES.more} />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-4 pt-1">
        <GroupedList title={MORE_SCREEN.food.title}>
          <ListRow
            icon="Apple"
            subtitle={MORE_SCREEN.food.yourFoods.subtitle}
            title={MORE_SCREEN.food.yourFoods.title}
            onPress={() => {
              router.push("/foods?scope=own");
            }}
          />
        </GroupedList>
        <GroupedList title={MORE_SCREEN.nutrition.title}>
          <ListRow
            icon="Target"
            subtitle={
              targets.data?.source === "engine"
                ? MORE_SCREEN.nutrition.targets.subtitleFromProgram
                : MORE_SCREEN.nutrition.targets.subtitle
            }
            title={MORE_SCREEN.nutrition.targets.title}
            unit={kcalTarget === null ? undefined : "kcal"}
            value={kcalTarget === null ? undefined : formatCalories(kcalTarget)}
            onPress={() => {
              router.push("/targets");
            }}
          />
          <ListRow
            icon="ChartLine"
            subtitle={programSubtitle}
            title={MORE_SCREEN.nutrition.program.title}
            onPress={() => {
              openOnce(() => {
                router.push("/more/program");
              });
            }}
          />
          <ListRow
            icon="ChefHat"
            title={MORE_SCREEN.nutrition.recipes.title}
            onPress={() => {
              openOnce(() => {
                router.push(recipesPath());
              });
            }}
          />
        </GroupedList>
        <GroupedList title={MORE_SCREEN.body.title}>
          <ListRow
            icon="Scale"
            title={MORE_SCREEN.body.weight.title}
            onPress={() => {
              router.push("/more/weight");
            }}
          />
          <ListRow
            icon="Dumbbell"
            subtitle={goalSubtitle}
            title={MORE_SCREEN.body.goal.title}
            onPress={() => {
              openOnce(() => {
                router.push(goalPath());
              });
            }}
          />
        </GroupedList>
        <GroupedList title={MORE_SCREEN.settings.title}>
          <ListRow
            icon="Sparkles"
            subtitle={assistantRow.subtitle}
            title={assistantRow.title}
            value={assistantRow.value}
            valueLook="quiet"
            onPress={() => {
              openOnce(() => {
                router.push("/more/assistant");
              });
            }}
          />
          <AppearanceSetting />
          <BodyMapRendererSetting />
          <DashboardBodyChartSetting />
          <ListRow
            icon="Clock"
            title={MORE_SCREEN.settings.reminders.title}
            onPress={() => {
              router.push("/reminders");
            }}
          />
          <ListRow
            icon="Info"
            title={MORE_SCREEN.settings.about.title}
            onPress={() => {
              router.push("/about");
            }}
          />
          <ListRow
            icon="MessageSquareText"
            subtitle={MORE_SCREEN.settings.featureRequest.subtitle}
            title={MORE_SCREEN.settings.featureRequest.title}
            onPress={() => {
              openOnce(() => {
                router.push("/more/feature-request");
              });
            }}
          />
        </GroupedList>
        <GroupedList title={MORE_SCREEN.account.title}>
          <ListRow
            icon="Download"
            subtitle={ACCOUNT_EXPORT_COPY.moreRow.subtitle}
            title={ACCOUNT_EXPORT_COPY.moreRow.title}
            onPress={() => {
              openOnce(() => {
                router.push("/more/export");
              });
            }}
          />
          <ListRow
            chevron={false}
            icon="LogOut"
            title={MORE_SCREEN.account.signOut}
            onPress={() => {
              void signOut();
            }}
          />
        </GroupedList>
      </ScrollView>
    </View>
  );
}
