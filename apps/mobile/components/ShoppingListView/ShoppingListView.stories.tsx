import { View } from "react-native";

import { ShoppingListView } from "./ShoppingListView";

import type { ShoppingItem } from "@keylow/core/shopping";
import type { Meta, StoryObj } from "@storybook/react-native";

const CHILLI = { recipeId: "11111111-1111-4111-8111-111111111111", name: "Chilli" };
const CURRY = { recipeId: "22222222-2222-4222-8222-222222222222", name: "Curry" };

const itemOf = (serial: number, overrides: Partial<ShoppingItem>): ShoppingItem => ({
  id: `77777777-7777-4777-8777-${String(serial).padStart(12, "0")}`,
  food_id: null,
  name: "Kitchen roll",
  grams: null,
  portion_label: null,
  portion_count: null,
  sources: [],
  position: serial,
  checked_at: null,
  ...overrides,
});

const items: ShoppingItem[] = [
  itemOf(0, {
    food_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Beef mince",
    grams: 750,
    sources: [CHILLI, CURRY],
  }),
  itemOf(1, {
    food_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Onions",
    grams: 450,
    portion_label: "1 medium",
    portion_count: 3,
    sources: [CHILLI, CURRY],
  }),
  itemOf(2, {}),
  itemOf(3, {
    food_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    name: "Chopped tomatoes",
    grams: 400,
    sources: [CHILLI],
    checked_at: "2026-10-29T09:00:00Z",
  }),
];

const handlers = {
  isAddingItem: false,
  onBack: () => undefined,
  onToggle: () => undefined,
  onRemove: () => undefined,
  onAddItem: () => undefined,
  onAddRecipe: () => undefined,
  onClearTicked: () => undefined,
};

// No board draws the shopping list yet, so these stories are how its states are seen. The props are a
// union, which Storybook's args typing cannot hold, so each story renders its own view.
const meta = {
  title: "Recipes/ShoppingListView",
  decorators: [
    (Story) => (
      <View className="flex-1 bg-background">
        <Story />
      </View>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithItems: Story = {
  render: () => <ShoppingListView {...handlers} isOnline items={items} status="ready" />,
};

export const Empty: Story = {
  render: () => <ShoppingListView {...handlers} isOnline items={[]} status="ready" />,
};

// A list loaded earlier stays readable offline, and nothing on it can change.
export const OfflineWithItems: Story = {
  render: () => <ShoppingListView {...handlers} isOnline={false} items={items} status="ready" />,
};

export const Offline: Story = {
  render: () => <ShoppingListView status="offline" onBack={() => undefined} />,
};

export const Loading: Story = {
  render: () => <ShoppingListView status="loading" onBack={() => undefined} />,
};

export const Failed: Story = {
  render: () => (
    <ShoppingListView status="error" onBack={() => undefined} onRetry={() => undefined} />
  ),
};
