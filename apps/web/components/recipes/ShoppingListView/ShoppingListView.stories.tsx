import { ShoppingListView } from "./ShoppingListView";

import type { ShoppingItem } from "@keylow/core/shopping";
import type { Meta, StoryObj } from "@storybook/nextjs";

import { PageFrame } from "@/app/(dashboard)/PageFrame";

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
  isClearing: false,
  onToggle: () => undefined,
  onRemove: () => undefined,
  onAddItem: () => undefined,
  onAddRecipe: () => undefined,
  onClearTicked: () => undefined,
};

// The props are a union, which Storybook's args typing cannot hold, so each story renders its own view,
// under the dashboard layout's side padding and the diary's vertical padding.
const meta = {
  title: "Recipes/ShoppingListView",
  decorators: [
    (Story) => (
      <main className="px-4 lg:px-8">
        <PageFrame variant="diary">
          <Story />
        </PageFrame>
      </main>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithItems: Story = {
  render: () => <ShoppingListView status="ready" items={items} isOnline {...handlers} />,
};

export const Empty: Story = {
  render: () => <ShoppingListView status="ready" items={[]} isOnline {...handlers} />,
};

export const Offline: Story = {
  render: () => <ShoppingListView status="ready" items={items} isOnline={false} {...handlers} />,
};

// The rows appear after 200 ms, as the skeleton does everywhere.
export const Loading: Story = { render: () => <ShoppingListView status="loading" /> };

export const Failed: Story = {
  render: () => <ShoppingListView status="error" onRetry={() => undefined} />,
};
