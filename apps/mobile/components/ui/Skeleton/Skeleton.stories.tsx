import { View } from "react-native";

import { Skeleton } from "./Skeleton";

import type { Meta, StoryObj } from "@storybook/react-native";

// The skeleton draws nothing for its first 200 ms, so a story is empty for a moment after it opens.
const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  decorators: [
    (Story) => (
      <View className="flex-1 p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

// One food row, which stands in for a single row while it loads.
export const Row: Story = { args: { variant: "row" } };

// A card of three rows, as the loading board draws a group of results.
export const Group: Story = { args: { variant: "group" } };

// A card of four recipe rows, as the recipe library's loading board draws them.
export const RecipeGroup: Story = { args: { variant: "recipeGroup", rows: 4 } };

// The recipe view while it loads: the Per serving and Servings cards as blocks, then three rows.
export const RecipeView: Story = { args: { variant: "recipeView" } };

// The refresh screen while it checks the foods: an intro line, the Per serving card of four lines, and two cards.
export const RecipeRefresh: Story = { args: { variant: "recipeRefresh" } };

// A food's page, as the food boards draw it while the food loads.
export const Detail: Story = { args: { variant: "detail" } };

// The diary's food log while it loads: the week's pills, the four bars and five hours.
export const Diary: Story = { args: { variant: "diary" } };

// The same without the week, for a day that loads under a week strip that is already on screen.
export const DiaryDay: Story = { args: { variant: "diaryDay" } };

// The dashboard's nutrition card while it loads: the title, a 200 point ring, three bar rows and a caption.
export const NutritionCard: Story = { args: { variant: "nutritionCard" } };

// The dashboard's This week card while it loads: the title, a value line, the 8 point bar, a caption and seven circles.
export const ThisWeekCard: Story = { args: { variant: "thisWeekCard" } };

// The dashboard's body map card while it loads: the title, two figures with the legend, and two lines.
export const BodyMapCard: Story = { args: { variant: "bodyMapCard" } };

// The Train home while it loads: the Today card, the two body figures and the seven days of the week.
export const TrainHome: Story = { args: { variant: "trainHome" } };

// The body map screen while it loads: the card with the view label and two figures, and the legend under it.
export const BodyMap: Story = { args: { variant: "bodyMap" } };

// The history list while it loads: a week heading and a card of three rows, each a date block, a name and a line.
export const HistoryList: Story = { args: { variant: "historyList" } };

// The Weight screen while it loads: the Trend weight card, the range control, the chart, a heading bar and the list.
export const Weight: Story = { args: { variant: "weight" } };

// The Programme screen while it loads: the expenditure card, the targets card, a heading bar and the rows.
export const Program: Story = { args: { variant: "program" } };

// The Weight screen's Body composition section while it loads: two 104 point blocks, one for each card.
export const BodyComposition: Story = { args: { variant: "bodyComposition" } };
