import { userEvent } from "storybook/test";

import { FoodRow } from "./FoodRow";

import type { FoodRowContent } from "./types";
import type { Meta, StoryObj } from "@storybook/nextjs";

import { GroupedList } from "@/components/ui/GroupedList";

const chickenBreast = [
  { text: "Chicken", matched: true },
  { text: " ", matched: false },
  { text: "breast", matched: true },
  { text: ", grilled without skin, meat only", matched: false },
];

const chickenDetails: FoodRowContent = {
  nameSegments: chickenBreast,
  energy: "148",
  macros: {
    protein: "32",
    carbs: "0",
    fat: "2.2",
    description: "protein 32 grams, fat 2.2 grams, carbohydrate 0 grams",
  },
};

// A row lives in a list on a card, with a heading, as the foods page draws it. The props are a union
// (a link or a button), which Storybook's args typing cannot hold, so each story renders its own row.
const meta = {
  title: "UI/FoodRow",
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-6">
        <GroupedList title="Common foods" source="UK CoFID">
          <Story />
        </GroupedList>
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <FoodRow {...chickenDetails} href="/foods/chicken" />,
};

export const Branded: Story = {
  render: () => (
    <FoodRow
      nameSegments={[
        { text: "Savoury ", matched: false },
        { text: "Stock", matched: true },
        { text: " Cube", matched: false },
      ]}
      brand="Northfield Mills"
      energy="250"
      macros={{
        protein: "8",
        carbs: "25",
        fat: "12",
        description: "protein 8 grams, fat 12 grams, carbohydrate 25 grams",
      }}
      href="/foods/stock"
    />
  ),
};

export const PerHundredMillilitres: Story = {
  render: () => (
    <FoodRow
      nameSegments={[{ text: "Cold brew coffee", matched: false }]}
      energy="5"
      basis="per 100 ml"
      macros={{
        protein: "0.3",
        carbs: "0.6",
        fat: "0",
        description: "protein 0.3 grams, fat 0 grams, carbohydrate 0.6 grams",
      }}
      href="/foods/coffee"
    />
  ),
};

export const EnergyNotGiven: Story = {
  render: () => (
    <FoodRow
      nameSegments={[
        { text: "Stock", matched: true },
        { text: " ", matched: false },
        { text: "cubes", matched: true },
        { text: ", vegetable", matched: false },
      ]}
      note="Energy not given"
      href="/foods/cubes"
    />
  ),
};

export const LongName: Story = {
  render: () => (
    <FoodRow
      {...chickenDetails}
      nameSegments={[
        { text: "Chicken", matched: true },
        {
          text: " breast fillets, grilled without skin, trimmed of visible fat, cooked from frozen, meat only and unseasoned",
          matched: false,
        },
      ]}
      href="/foods/chicken"
    />
  ),
};

// A row that adds a product runs an action rather than going to a page.
export const Action: Story = {
  render: () => <FoodRow {...chickenDetails} brand="Northfield Mills" onClick={() => undefined} />,
};

export const Busy: Story = {
  render: () => (
    <FoodRow
      nameSegments={chickenBreast}
      brand="Northfield Mills"
      busyLabel="Adding to your foods"
      onClick={() => undefined}
    />
  ),
};

// While one row is busy the others around it are off.
export const Disabled: Story = {
  render: () => <FoodRow {...chickenDetails} disabled onClick={() => undefined} />,
};

// A story cannot hold a real :hover or :active, so these two apply the classes the hover and press
// states apply. The unit of truth is still the component's own classes.
export const Hover: Story = {
  render: () => <FoodRow {...chickenDetails} href="/foods/chicken" className="bg-hover-overlay" />,
};

export const Pressed: Story = {
  render: () => (
    <FoodRow {...chickenDetails} href="/foods/chicken" className="scale-[0.985] bg-press-overlay" />
  ),
};

// Focus is real: the play function tabs onto the row, so the ring shows as it does for a keyboard.
export const Focused: Story = {
  render: () => <FoodRow {...chickenDetails} href="/foods/chicken" />,
  play: async () => {
    await userEvent.tab();
  },
};
