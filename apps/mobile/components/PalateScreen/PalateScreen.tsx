import { useRemovePalatePreference, useSetNotUsual } from "@keylow/api-client";
import { palateSections, summaryLines } from "@keylow/core";
import {
  PALATE_WORDS,
  RETRY_LABEL,
  SAVE_FAILED_BANNER,
  describeAvoidedFoodName,
  describeEmptyPalate,
} from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PalateItemList } from "./PalateItemList";
import { usePalateProfileData } from "./usePalateProfileData";
import {
  Card,
  EmptyState,
  ErrorState,
  GroupedList,
  ListRow,
  SheetHeader,
  Skeleton,
  Text,
  useToast,
} from "../ui";

import type { PalateRow } from "@keylow/core";

// Never the item's name: what a person eats is health data, and the sentence is the whole of the toast.
const saveFailedToast = {
  message: SAVE_FAILED_BANNER,
  tone: "danger",
  icon: "CircleAlert",
} as const;

// How many usual foods show before "Show all", as `kitchen · palate` draws them.
const FOODS_SHOWN = 6;

/**
 * "What you usually eat", pushed from the Your food group of the Assistant settings (`kitchen · palate`,
 * `kitchen · palate-empty` and `kitchen · palate-corrected`): the summary lines and a caption, the usual
 * foods and recipes, the foods of each time of day, the groups rarely or never logged, and the foods to
 * avoid with a link to the screen that changes them. Not true on an item writes a correction, which keeps
 * the item in its place with Undo. With too few logged days an empty card says so and only the avoid list
 * stays. Until everything is read a loading status is drawn, and a failed first read is an error state with
 * Try again, since no board draws either.
 */
export function PalateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { profile, isError, refetch } = usePalateProfileData();
  // Told here, not in each press, so every failed write is reported and not only the latest.
  const setNotUsual = useSetNotUsual({
    onError: () => {
      toast.show(saveFailedToast);
    },
  });
  const remove = useRemovePalatePreference({
    onError: () => {
      toast.show(saveFailedToast);
    },
  });

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to the Assistant settings instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/more/assistant");
    }
  }

  const sayNotTrue = ({ target }: PalateRow) => {
    setNotUsual.mutate(target);
  };
  const undo = ({ correctionId }: PalateRow) => {
    if (correctionId !== null) {
      remove.mutate(correctionId);
    }
  };

  function renderBody() {
    if (profile === undefined) {
      if (isError) {
        return (
          <ErrorState
            body={PALATE_WORDS.loadFailedBody}
            retry={{ label: RETRY_LABEL, onPress: refetch }}
            title={PALATE_WORDS.loadFailedTitle}
          />
        );
      }
      return (
        <View
          accessible
          aria-label={PALATE_WORDS.title}
          aria-live="polite"
          className="px-4"
          role="status"
        >
          <Skeleton variant="group" />
        </View>
      );
    }

    const sections = palateSections(profile);
    const hasAvoided = profile.avoid.length > 0;
    return (
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-6 pt-1">
        {profile.hasEnoughToGoOn ? (
          <>
            <View className="gap-2">
              <Card padding={0}>
                <View className="gap-2 px-4 py-3">
                  {summaryLines(profile).map((line) => (
                    <Text key={line}>{line}</Text>
                  ))}
                </View>
              </Card>
              <View className="px-1">
                <Text tone="secondary" variant="caption">
                  {PALATE_WORDS.caption}
                </Text>
              </View>
            </View>
            {sections.foods.length === 0 ? null : (
              <PalateItemList
                limit={FOODS_SHOWN}
                rows={sections.foods}
                title={PALATE_WORDS.usualFoods}
                onNotTrue={sayNotTrue}
                onUndo={undo}
              />
            )}
            {sections.recipes.length === 0 ? null : (
              <PalateItemList
                rows={sections.recipes}
                title={PALATE_WORDS.usualRecipes}
                onNotTrue={sayNotTrue}
                onUndo={undo}
              />
            )}
            {sections.timesOfDay.length === 0 ? null : (
              <GroupedList title={PALATE_WORDS.byTimeOfDay}>
                {sections.timesOfDay.map(({ key, title, detail }) => (
                  <ListRow key={key} subtitle={detail} title={title} />
                ))}
              </GroupedList>
            )}
            {sections.rare.length === 0 ? null : (
              <PalateItemList
                rows={sections.rare}
                title={PALATE_WORDS.rarelyOrNever}
                onNotTrue={sayNotTrue}
                onUndo={undo}
              />
            )}
          </>
        ) : (
          <EmptyState
            body={describeEmptyPalate(profile.loggedDays)}
            icon="Utensils"
            title={PALATE_WORDS.emptyTitle}
            variant="card"
          />
        )}
        <View className="gap-2">
          <GroupedList title={PALATE_WORDS.foodsYouAvoid}>
            {profile.avoid.map(({ preferenceId, label, kind }) => (
              <ListRow
                key={preferenceId}
                badge={{
                  label: kind === "allergy" ? PALATE_WORDS.allergy : PALATE_WORDS.dislike,
                  tone: kind === "allergy" ? "danger" : "neutral",
                }}
                title={describeAvoidedFoodName(label)}
              />
            ))}
            <ListRow
              key="link"
              role="link"
              subtitle={hasAvoided ? undefined : PALATE_WORDS.noneYet}
              title={PALATE_WORDS.foodsToAvoidLink}
              titleTone="accent"
              onPress={() => {
                router.push("/more/assistant/foods-to-avoid");
              }}
            />
          </GroupedList>
          <View className="px-1">
            <Text tone="secondary" variant="caption">
              {hasAvoided ? PALATE_WORDS.avoidCaption : PALATE_WORDS.noneYetCaption}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    // The insets are runtime values no class can name, so they go through variables, as the About screen's do.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: PALATE_WORDS.back, onPress: goBack }}
        title={PALATE_WORDS.title}
      />
      {renderBody()}
    </View>
  );
}
