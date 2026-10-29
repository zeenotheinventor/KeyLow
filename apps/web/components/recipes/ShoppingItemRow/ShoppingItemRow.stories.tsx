import { ShoppingItemRow } from "./ShoppingItemRow";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { GroupedList } from "@/components/ui/GroupedList";

const meta = {
  title: "Recipes/ShoppingItemRow",
  component: ShoppingItemRow,
  decorators: [
    (Story) => (
      <div className="max-w-[480px]">
        <GroupedList title="To buy" headerSize="compact">
          <Story />
        </GroupedList>
      </div>
    ),
  ],
  args: {
    item: {
      id: "77777777-7777-4777-8777-000000000001",
      food_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "Onions",
      grams: 450,
      portion_label: "1 medium",
      portion_count: 3,
      sources: [
        { recipeId: "11111111-1111-4111-8111-111111111111", name: "Chilli" },
        { recipeId: "22222222-2222-4222-8222-222222222222", name: "Curry" },
      ],
      position: 0,
      checked_at: null,
    },
    disabled: false,
    onToggle: () => undefined,
    onRemove: () => undefined,
  },
} satisfies Meta<typeof ShoppingItemRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FromRecipes: Story = {};

export const TypedByHand: Story = {
  args: {
    item: {
      id: "77777777-7777-4777-8777-000000000002",
      food_id: null,
      name: "Kitchen roll",
      grams: null,
      portion_label: null,
      portion_count: null,
      sources: [],
      position: 1,
      checked_at: null,
    },
  },
};

export const Ticked: Story = {
  args: {
    item: {
      id: "77777777-7777-4777-8777-000000000003",
      food_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      name: "Chopped tomatoes",
      grams: 400,
      portion_label: null,
      portion_count: null,
      sources: [{ recipeId: "11111111-1111-4111-8111-111111111111", name: "Chilli" }],
      position: 2,
      checked_at: "2026-10-29T09:00:00Z",
    },
  },
};

export const Offline: Story = { args: { disabled: true } };
