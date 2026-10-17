import { useState } from "react";
import { View } from "react-native";

import { Banner } from "../Banner";
import { FoodRow } from "../FoodRow";
import { ListRow } from "../ListRow";
import { GroupedList } from "./GroupedList";

import type { GroupedListProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/GroupedList",
  component: GroupedList,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: { title: "Common foods", source: "UK CoFID", children: [] },
} satisfies Meta<typeof GroupedList>;

export default meta;

type Story = StoryObj<typeof meta>;

const chicken = [
  {
    name: [
      { text: "Chicken", matched: true },
      { text: ", breast, grilled without skin, meat only", matched: false },
    ],
    energy: "148",
    macros: {
      protein: "32",
      carbs: "0",
      fat: "2.2",
      description: "protein 32 grams, fat 2.2 grams, carbohydrate 0 grams",
    },
  },
  {
    name: [
      { text: "Chicken", matched: true },
      { text: ", breast, grilled with skin, meat only", matched: false },
    ],
    energy: "147",
    macros: {
      protein: "30",
      carbs: "0",
      fat: "3.1",
      description: "protein 30 grams, fat 3.1 grams, carbohydrate 0 grams",
    },
  },
  {
    name: [
      { text: "Chicken", matched: true },
      { text: ", breast, grilled, meat and skin", matched: false },
    ],
    energy: "173",
    macros: {
      protein: "29",
      carbs: "0",
      fat: "6.4",
      description: "protein 29 grams, fat 6.4 grams, carbohydrate 0 grams",
    },
  },
];

function foodRows(count: number) {
  return chicken
    .slice(0, count)
    .map((food, index) => (
      <FoodRow
        key={index}
        energy={food.energy}
        macros={food.macros}
        nameSegments={food.name}
        onPress={() => undefined}
      />
    ));
}

export const Default: Story = {
  render: (args) => <GroupedList {...args}>{foodRows(3)}</GroupedList>,
};

function RevealingGroupedList(props: GroupedListProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <GroupedList
      {...props}
      seeMore={
        isRevealed
          ? undefined
          : {
              hiddenCount: 1,
              onPress: () => {
                setIsRevealed(true);
              },
            }
      }
    >
      {foodRows(isRevealed ? 3 : 2)}
    </GroupedList>
  );
}

// Two of the three rows are shown and "See 1 more" reveals the rest, after which the button goes.
export const WithSeeMore: Story = { render: (args) => <RevealingGroupedList {...args} /> };

// A group with a title and no source, of plain rows.
export const TitleOnly: Story = {
  render: (args) => (
    <GroupedList {...args} source={undefined} title="Food">
      <ListRow
        icon="Utensils"
        subtitle="Foods you created or copied"
        title="Your foods"
        onPress={() => undefined}
      />
    </GroupedList>
  ),
};

// A notice about the group sits between its heading and its card, as the add failure board draws one.
export const WithNotice: Story = {
  render: (args) => (
    <GroupedList
      {...args}
      notice={
        <Banner
          body="Check your connection and try again."
          title="This product could not be added"
          variant="error"
        />
      }
    >
      {foodRows(3)}
    </GroupedList>
  ),
};

// The recipe library's card: the rows alone, with no heading over them.
export const TitleHidden: Story = {
  render: (args) => (
    <GroupedList {...args} hidesTitle source={undefined} title="Recipes">
      <ListRow icon="ChefHat" title="Beef chilli" onPress={() => undefined} />
      <ListRow icon="ChefHat" title="Chicken and rice" onPress={() => undefined} />
    </GroupedList>
  ),
};
