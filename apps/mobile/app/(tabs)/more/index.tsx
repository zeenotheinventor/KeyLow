import { useProgramSummary, useTargets } from "@keylow/api-client";
import { MORE_SCREEN, TAB_TITLES, describeNextCheckInSubtitle } from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";
import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { AppearanceSetting } from "../../../components/AppearanceSetting";
import { BodyMapRendererSetting } from "../../../components/BodyMapRendererSetting";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { GroupedList, ListRow } from "../../../components/ui";
import { signOut } from "../../../lib/signOut";
import { useOpenOnce } from "../../../lib/useOpenOnce";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";

// The sections of the `tab-shell.more` board, with Nutrition between Food and Body. Your foods opens the search
// sheet in its own-foods mode, Targets opens the Targets screen and shows the calorie target once one is set,
// Programme sits under it and opens the Programme screen inside this tab, its subtitle the next check-in or the offer to
// let Ki-Lo set the targets, and Targets says "From your programme" while the programme's targets are in force.
// Weight opens the Weight screen inside this tab, Appearance and the Body map are set here, and Sign out is Account's one row.
// Reminders and About are under Settings and open their screens. No board draws Reminders, and its icon is the
// clock because the kit has no bell.
export default function MoreRoute() {
  const router = useRouter();
  const isReadEnabled = useReadsEnabled();
  const targets = useTargets({ enabled: isReadEnabled });
  const programSummary = useProgramSummary({ enabled: isReadEnabled });
  const openOnce = useOpenOnce();
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
        </GroupedList>
        <GroupedList title={MORE_SCREEN.body.title}>
          <ListRow
            icon="Scale"
            title={MORE_SCREEN.body.weight.title}
            onPress={() => {
              router.push("/more/weight");
            }}
          />
        </GroupedList>
        <GroupedList title={MORE_SCREEN.settings.title}>
          <AppearanceSetting />
          <BodyMapRendererSetting />
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
        </GroupedList>
        <GroupedList title={MORE_SCREEN.account.title}>
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
