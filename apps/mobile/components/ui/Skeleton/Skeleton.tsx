import { skeletonDelay } from "@keylow/tokens";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { SkeletonBone } from "./SkeletonBone";
import { useFadeInStyle } from "../../../lib/motion";
import { Card } from "../Card";

import type { SkeletonProps } from "./types";

// How wide the name's bone is on each row of a group, which the loading board varies so the rows do not
// look stamped. The classes are written out so Tailwind sees them.
const nameWidthClassNames = ["w-[70%]", "w-[52%]", "w-[64%]"];

// A row as the loading board draws a food row: the icon tile, a name over a macro line, and the energy.
// It is as tall as a food row, 60 points, with the hairline above every row after the first.
function SkeletonRow({ index }: { index: number }) {
  const nameWidthClassName = nameWidthClassNames[index % nameWidthClassNames.length];

  return (
    <View
      className={`min-h-[60px] flex-row items-center gap-3 px-3 py-2 ${index === 0 ? "" : "border-t border-border"}`}
      testID="skeleton-row"
    >
      <SkeletonBone className="h-control-sm w-control-sm shrink-0" />
      <View className="flex-1 gap-[6px]">
        <SkeletonBone className={`h-3 ${nameWidthClassName}`} />
        <SkeletonBone className="h-[10px] w-[35%]" />
      </View>
      <SkeletonBone className="h-4 w-touch-target shrink-0" />
    </View>
  );
}

// How wide the title's bone is on each row of the recipe library's loading board, and every caption is 55 percent.
const recipeTitleWidthClassNames = ["w-[70%]", "w-[55%]", "w-[80%]", "w-[62%]"];

// A row as the recipe library's loading board draws it: the icon tile, a title over a shorter caption, and
// nothing at the end. It is 80 points tall, with the hairline above every row after the first.
function SkeletonRecipeRow({ index }: { index: number }) {
  const titleWidthClassName = recipeTitleWidthClassNames[index % recipeTitleWidthClassNames.length];

  return (
    <View
      className={`min-h-[80px] flex-row items-center gap-3 px-3 py-2 ${index === 0 ? "" : "border-t border-border"}`}
      testID="skeleton-recipe-row"
    >
      <SkeletonBone className="h-control-sm w-control-sm shrink-0" />
      <View className="flex-1 gap-2">
        <SkeletonBone className={`h-[14px] ${titleWidthClassName}`} />
        <SkeletonBone className="h-[10px] w-[55%]" />
      </View>
    </View>
  );
}

// How wide the name's bone is on each row of the entry screen's loading board. The classes are written out so
// Tailwind sees them.
const entryNameWidthClassNames = ["w-[62%]", "w-[48%]"];

// A row as the entry screen's loading board draws it: a name over a shorter line, 64 points tall, with no tile
// and nothing at the end, and the hairline above every row after the first.
function SkeletonEntryRow({ index }: { index: number }) {
  const nameWidthClassName = entryNameWidthClassNames[index % entryNameWidthClassNames.length];

  return (
    <View
      className={`min-h-[64px] justify-center gap-2 px-4 py-3 ${index === 0 ? "" : "border-t border-border"}`}
      testID="skeleton-entry-row"
    >
      <SkeletonBone className={`h-[14px] ${nameWidthClassName}`} />
      <SkeletonBone className="h-[10px] w-[40%]" />
    </View>
  );
}

// A food's page as the loading board draws it: the name on two lines, the source as a pill, and the
// two cards under them. Its sides are the screen's, so it gives none of its own.
function SkeletonDetail() {
  return (
    <View className="gap-4" testID="skeleton-detail">
      <SkeletonBone className="h-6 w-[80%]" />
      <SkeletonBone className="h-6 w-[45%]" />
      <SkeletonBone className="h-5 w-[90px] rounded-pill" />
      <SkeletonBone className="h-[140px] rounded-large" />
      <SkeletonBone className="h-[236px] rounded-large" />
    </View>
  );
}

// The recipe view as its loading board draws it: the Per serving card as a numeral bar, a caption bar and
// three tiles, the Servings card as a label bar over a stepper-sized bar, and a card of three rows. Its
// sides are the screen's, so it gives none of its own.
const recipeViewNameWidthClassNames = ["w-[68%]", "w-[52%]", "w-[74%]"];
const recipeViewTileKeys = ["first", "second", "third"];

function SkeletonRecipeView() {
  return (
    <View className="gap-6" testID="skeleton-recipe-view">
      <Card>
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <SkeletonBone className="h-10 w-28" />
            <SkeletonBone className="h-3 w-24" />
          </View>
          <View className="flex-row gap-2">
            {recipeViewTileKeys.map((key) => (
              <SkeletonBone key={key} className="h-[82px] flex-1 rounded-medium" />
            ))}
          </View>
          <SkeletonBone className="h-3 w-[150px]" />
        </View>
      </Card>
      <Card padding={0}>
        <View className="gap-3 px-4 py-3">
          <View className="flex-row items-center justify-between">
            <SkeletonBone className="h-[14px] w-[72px]" />
            <SkeletonBone className="h-touch-target w-[176px] rounded-medium" />
          </View>
          <SkeletonBone className="h-3 w-40" />
        </View>
      </Card>
      <View
        className="overflow-hidden rounded-large border border-border bg-surface elevation-card"
        testID="skeleton-card"
      >
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            className={`min-h-[60px] flex-row items-center gap-3 px-3 py-2 ${index === 0 ? "" : "border-t border-border"}`}
          >
            <SkeletonBone className="h-control-sm w-control-sm shrink-0" />
            <View className="flex-1 gap-2">
              <SkeletonBone className={`h-[14px] ${recipeViewNameWidthClassNames[index]}`} />
              <SkeletonBone className="h-[10px] w-[45%]" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// The refresh screen as its loading board draws it: an intro line, the Per serving card as a heading over
// four lines of a label and a value, and two cards of bars. Its sides are the screen's, so it gives none of its own.
const refreshValueWidthClassNames = ["w-[84px]", "w-[64px]", "w-[48px]", "w-[64px]"];

function SkeletonRecipeRefresh() {
  return (
    <View className="gap-5" testID="skeleton-recipe-refresh">
      <SkeletonBone className="h-[14px] w-[90%]" />
      <Card>
        <View className="gap-4">
          <SkeletonBone className="h-[14px] w-24" />
          {refreshValueWidthClassNames.map((valueWidthClassName, index) => (
            <View key={index} className="flex-row justify-between">
              <SkeletonBone className="h-3 w-[72px]" />
              <SkeletonBone className={`h-3 ${valueWidthClassName}`} />
            </View>
          ))}
        </View>
      </Card>
      <Card>
        <View className="gap-3">
          <SkeletonBone className="h-[14px] w-[60%]" />
          <SkeletonBone className="h-[10px] w-[30%]" />
          <SkeletonBone className="h-3 w-[45%]" />
        </View>
      </Card>
      <Card>
        <View className="gap-3">
          <SkeletonBone className="h-[14px] w-[50%]" />
          <SkeletonBone className="h-[10px] w-[25%]" />
        </View>
      </Card>
    </View>
  );
}

// The food log as the loading board draws it: seven pills, four bars and five hours, the second and fourth
// with a food under their chip. It carries the screen's 16 points at its sides.
const dayBoneKeys = ["mo", "tu", "we", "th", "fr", "sa", "su"];
const barBoneKeys = ["calories", "protein", "carbs", "fat"];
const hourBones = [
  { key: "first", hasFood: false },
  { key: "second", hasFood: true },
  { key: "third", hasFood: false },
  { key: "fourth", hasFood: true },
  { key: "fifth", hasFood: false },
];

function SkeletonDiary({ includesWeek }: { includesWeek: boolean }) {
  return (
    <View className="gap-3" testID="skeleton-diary">
      {includesWeek ? (
        <View className="flex-row gap-[6px] px-4">
          {dayBoneKeys.map((key) => (
            <SkeletonBone key={key} className="h-[56px] flex-1 rounded-pill" />
          ))}
        </View>
      ) : null}
      <View className="flex-row gap-2 px-4 pt-1">
        {barBoneKeys.map((key, index) => (
          <View key={key} className={`gap-[10px] ${index === 0 ? "flex-[1.5]" : "flex-1"}`}>
            <SkeletonBone className="h-3" />
            <SkeletonBone className="h-1" />
          </View>
        ))}
      </View>
      <View className="gap-3 px-4 py-2">
        {hourBones.map(({ key, hasFood }) => (
          <View key={key} className="gap-2">
            <View className="flex-row items-center justify-between">
              <SkeletonBone className="h-[28px] w-[64px] rounded-pill" />
              <SkeletonBone className="h-[32px] w-[32px] rounded-pill" />
            </View>
            {hasFood ? <SkeletonBone className="ml-2 h-[64px] rounded-large" /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

// The dashboard's card as its loading board draws it: a title, the ring as an outline in the skeleton base
// colour (it does not shine), three bar rows with a label, a track and the grams, and a caption. The
// label and the grams sit in the columns of a bar row, 72 and 96 points wide.
const barRowKeys = ["protein", "carbs", "fat"];

function SkeletonNutritionCard() {
  return (
    <Card>
      <View className="gap-4" testID="skeleton-nutrition-card">
        <SkeletonBone className="h-5 w-[72px]" />
        <View
          className="h-[200px] w-[200px] self-center rounded-full border-[14px] border-skeleton-base"
          testID="skeleton-ring"
        />
        <View className="gap-3">
          {barRowKeys.map((key) => (
            <View key={key} className="flex-row items-center gap-3">
              <View className="w-[72px]">
                <SkeletonBone className="h-3 w-[56px]" />
              </View>
              <SkeletonBone className="h-2 min-w-0 flex-1 rounded-pill" />
              <View className="w-[96px]">
                <SkeletonBone className="h-3" />
              </View>
            </View>
          ))}
        </View>
        <SkeletonBone className="h-3 w-[140px]" />
      </View>
    </Card>
  );
}

// The dashboard's This week card as its loading board draws it: a title, a value line, the 8 point bar,
// a caption line and seven small circles, one under each day marker's place.
function SkeletonThisWeekCard() {
  return (
    <Card>
      <View className="gap-3" testID="skeleton-this-week-card">
        <SkeletonBone className="h-5 w-[104px]" />
        <SkeletonBone className="h-3 w-[60%]" />
        <SkeletonBone className="h-2 rounded-pill" />
        <SkeletonBone className="h-3 w-[45%]" />
        <View className="flex-row pt-2">
          {dayBoneKeys.map((key) => (
            <View key={key} className="flex-1 items-center">
              <SkeletonBone className="h-5 w-5 rounded-full" />
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

// The dashboard's body map card as it loads, as tall as the card it becomes so the cards under it do not
// jump: the title and the view, the two 100 by 220 figures and the legend, and the two lines under a
// hairline.
function SkeletonBodyMapCard() {
  return (
    <Card padding={0}>
      <View className="gap-2 py-3 pl-4 pr-3" testID="skeleton-body-map-card">
        <View className="gap-[6px]">
          <SkeletonBone className="h-[12px] w-[72px]" />
          <SkeletonBone className="h-[14px] w-[104px]" />
        </View>
        <View className="flex-row items-end justify-center gap-[28px]">
          <SkeletonBone className="h-[220px] w-[100px] rounded-medium" />
          <SkeletonBone className="h-[220px] w-[100px] rounded-medium" />
          <SkeletonBone className="mb-[6px] h-[120px] w-[32px]" />
        </View>
        <View className="flex-row items-center justify-between gap-3 border-t border-border pt-2">
          <SkeletonBone className="h-3 w-[60%]" />
          <SkeletonBone className="h-3 w-[56px]" />
        </View>
      </View>
    </Card>
  );
}

// The Train home as its loading board draws it: the Today card as a label, a title, a line and a button,
// the body map as two figures, and the week as seven cells. The cards are 12 points apart and the screen
// gives their sides.
const trainFigureBoneKeys = ["front", "back"];

function SkeletonTrainHome() {
  return (
    <View className="gap-3" testID="skeleton-train-home">
      <Card>
        <View className="gap-2">
          <SkeletonBone className="h-3 w-[140px]" />
          <SkeletonBone className="h-[22px] w-[90px]" />
          <SkeletonBone className="h-3 w-[200px]" />
          <SkeletonBone className="mt-2 h-[44px] rounded-medium" />
        </View>
      </Card>
      <Card>
        <View className="flex-row justify-center gap-[28px]">
          {trainFigureBoneKeys.map((key) => (
            <SkeletonBone
              key={key}
              className="h-[198px] w-[90px] rounded-b-[20px] rounded-t-[45px]"
            />
          ))}
        </View>
      </Card>
      <Card padding={3}>
        <View className="flex-row gap-1">
          {dayBoneKeys.map((key) => (
            <SkeletonBone key={key} className="h-[56px] flex-1" />
          ))}
        </View>
      </Card>
    </View>
  );
}

/**
 * What a list shows while it loads, shaped like the content that replaces it. It draws nothing for the
 * first 200 ms (`--skeleton-delay`), so a load that is quick never flickers, then fades in. It is hidden
 * from screen readers, because the screen says what is loading in words.
 */
export function Skeleton({ variant = "row", rows = 3 }: SkeletonProps) {
  const animatedStyle = useFadeInStyle(skeletonDelay);

  return (
    <Animated.View aria-hidden style={animatedStyle} testID="skeleton">
      {variant === "detail" ? <SkeletonDetail /> : null}
      {variant === "recipeView" ? <SkeletonRecipeView /> : null}
      {variant === "recipeRefresh" ? <SkeletonRecipeRefresh /> : null}
      {variant === "diary" || variant === "diaryDay" ? (
        <SkeletonDiary includesWeek={variant === "diary"} />
      ) : null}
      {variant === "nutritionCard" ? <SkeletonNutritionCard /> : null}
      {variant === "thisWeekCard" ? <SkeletonThisWeekCard /> : null}
      {variant === "bodyMapCard" ? <SkeletonBodyMapCard /> : null}
      {variant === "trainHome" ? <SkeletonTrainHome /> : null}
      {variant === "row" ? <SkeletonRow index={0} /> : null}
      {variant === "recipeGroup" ? (
        <View
          className="overflow-hidden rounded-large border border-border bg-surface elevation-card"
          testID="skeleton-card"
        >
          {Array.from({ length: rows }, (_, index) => (
            <SkeletonRecipeRow key={index} index={index} />
          ))}
        </View>
      ) : null}
      {variant === "entryGroup" ? (
        <View
          className="overflow-hidden rounded-large border border-border bg-surface elevation-card"
          testID="skeleton-card"
        >
          {Array.from({ length: rows }, (_, index) => (
            <SkeletonEntryRow key={index} index={index} />
          ))}
        </View>
      ) : null}
      {variant === "group" ? (
        <View
          className="overflow-hidden rounded-large border border-border bg-surface elevation-card"
          testID="skeleton-card"
        >
          {Array.from({ length: rows }, (_, index) => (
            <SkeletonRow key={index} index={index} />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}
