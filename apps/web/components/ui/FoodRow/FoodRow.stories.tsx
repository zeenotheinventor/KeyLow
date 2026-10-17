import { FOOD_ROW } from "@keylow/core/copy";
import { userEvent, within } from "storybook/test";

import { FoodRow } from "./FoodRow";

import type { FoodLogRowProps, FoodRowContent, FoodTableRowProps, RecipeRowProps } from "./types";
import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { FoodTable } from "@/components/ui/FoodTable";
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
    // The table stories draw their own card, with the column headings, so they skip the list.
    (Story, { parameters }) =>
      parameters["isTable"] === true ? (
        <Story />
      ) : (
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

// The food log's rows. The stats line carries the energy, so they take no big numeral on the right.
const grilledChickenBreast = [
  { text: "Chicken", matched: true },
  { text: " breast", matched: true },
  { text: ", grilled", matched: false },
];

const grilledChickenMacros = {
  protein: "48",
  carbs: "0",
  fat: "3.3",
  description: "protein 48 grams, fat 3.3 grams, carbohydrate 0 grams",
};

const stackedChicken: FoodLogRowProps = {
  layout: "stacked",
  nameSegments: [{ text: "Chicken breast, grilled", matched: false }],
  caption: "08:05 · 50 g",
  energy: "222",
  macros: grilledChickenMacros,
  onClick: () => undefined,
};

const searchChicken: FoodLogRowProps = {
  layout: "search",
  nameSegments: grilledChickenBreast,
  caption: "1 breast (150 g)",
  energy: "222",
  macros: grilledChickenMacros,
  onClick: () => undefined,
  onAdd: () => undefined,
};

// The diary's row: the name, the time and amount, the stats line and a chevron.
export const Stacked: Story = {
  render: () => <FoodRow {...stackedChicken} />,
};

export const StackedLongTitle: Story = {
  render: () => (
    <FoodRow
      {...stackedChicken}
      nameSegments={[
        {
          text: "Chicken breast fillets, grilled without skin, trimmed of visible fat, cooked from frozen, meat only and unseasoned",
          matched: false,
        },
      ]}
      caption="08:05 · 150 g, a serving with a very long description that has to stay on one line"
    />
  ),
};

// The stats line wraps between its items, never inside one. The list is narrowed to make it wrap.
export const StackedWrappedStats: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-[17rem]">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <FoodRow
      {...stackedChicken}
      energy="1,248"
      macros={{ ...grilledChickenMacros, protein: "112.5", carbs: "148.3", fat: "96.4" }}
    />
  ),
};

export const StackedNeedsReview: Story = {
  render: () => <FoodRow {...stackedChicken} needsReview />,
};

// A result in the add dialog: the food tile, the serving, the stats line and the quiet add button.
export const Search: Story = {
  render: () => <FoodRow {...searchChicken} />,
};

export const SearchLongTitle: Story = {
  render: () => (
    <FoodRow
      {...searchChicken}
      nameSegments={[
        { text: "Chicken", matched: true },
        {
          text: " breast fillets, grilled without skin, trimmed of visible fat, cooked from frozen, meat only and unseasoned",
          matched: false,
        },
      ]}
      caption="1 large breast fillet (150 g) with a very long description that has to stay on one line"
    />
  ),
};

export const SearchWrappedStats: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-[17rem]">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <FoodRow
      {...searchChicken}
      energy="1,248"
      macros={{ ...grilledChickenMacros, protein: "112.5", carbs: "148.3", fat: "96.4" }}
    />
  ),
};

// A food missing a macro says so and has a chevron where the add button would be.
export const SearchNeedsReview: Story = {
  render: () => <FoodRow {...searchChicken} needsReview />,
};

export const SearchAddDisabled: Story = {
  render: () => <FoodRow {...searchChicken} addDisabled />,
};

export const SearchDisabled: Story = {
  render: () => <FoodRow {...searchChicken} disabled />,
};

// A story cannot hold a real :hover or :active on the add button either, so this applies the classes.
export const SearchAddPressed: Story = {
  render: () => <FoodRow {...searchChicken} />,
  play: ({ canvasElement }) => {
    const add = within(canvasElement).getByRole("button", { name: /^Add / });
    add.classList.add("scale-press", "before:bg-press-overlay");
  },
};

// Focus is real: the play function tabs twice, onto the row and then the add button.
export const SearchAddFocused: Story = {
  render: () => <FoodRow {...searchChicken} />,
  play: async () => {
    await userEvent.tab();
    await userEvent.tab();
  },
};

// The diary's table at the wide width: an hour's foods under their column headings, in a card.
const porridgeOats: FoodTableRowProps = {
  layout: "table",
  nameSegments: [{ text: "Porridge oats", matched: false }],
  caption: "08:05 · 50 g",
  energy: "187",
  macros: { protein: "5.6", carbs: "27", fat: "3.4" },
  onEdit: () => undefined,
  onDelete: () => undefined,
};

const semiSkimmedMilk: FoodTableRowProps = {
  ...porridgeOats,
  nameSegments: [{ text: "Semi-skimmed milk", matched: false }],
  caption: "08:05 · 200 ml",
  energy: "92",
  macros: { protein: "6.6", carbs: "9.6", fat: "3.4" },
};

function HourTable({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-5xl p-6">
      <Card padding="none" className="overflow-hidden">
        <FoodTable label="Foods at 08:00">{children}</FoodTable>
      </Card>
    </div>
  );
}

export const Table: Story = {
  parameters: { isTable: true },
  render: () => (
    <HourTable>
      <FoodRow {...porridgeOats} />
      <FoodRow {...semiSkimmedMilk} />
    </HourTable>
  ),
};

export const TableLongTitle: Story = {
  parameters: { isTable: true },
  render: () => (
    <HourTable>
      <FoodRow
        {...porridgeOats}
        nameSegments={[
          {
            text: "Porridge oats made with semi-skimmed milk, a spoon of honey, sliced banana and a handful of mixed seeds, cooked on the hob",
            matched: false,
          },
        ]}
        caption={`12:45 · ${FOOD_ROW.quickAdd}`}
      />
      <FoodRow {...semiSkimmedMilk} />
    </HourTable>
  ),
};

// A story cannot hold a real :hover, so this applies the overlay and shows the buttons the way hover does.
export const TableHover: Story = {
  parameters: { isTable: true },
  render: () => (
    <HourTable>
      <FoodRow {...porridgeOats} className="bg-hover-overlay [&>div:last-child]:opacity-100" />
      <FoodRow {...semiSkimmedMilk} />
    </HourTable>
  ),
};

// Focus is real: the play function tabs onto the Edit button, so the row shows its buttons as it does
// for a keyboard.
export const TableFocused: Story = {
  parameters: { isTable: true },
  render: () => (
    <HourTable>
      <FoodRow {...porridgeOats} />
      <FoodRow {...semiSkimmedMilk} />
    </HourTable>
  ),
  play: async () => {
    await userEvent.tab();
  },
};

// Offline, Delete is dimmed and stops responding, and Edit stays. The buttons are shown the way hover shows them.
export const TableDeleteDisabled: Story = {
  parameters: { isTable: true },
  render: () => (
    <HourTable>
      <FoodRow
        {...porridgeOats}
        deleteDisabled
        className="bg-hover-overlay [&>div:last-child]:opacity-100"
      />
      <FoodRow {...semiSkimmedMilk} deleteDisabled />
    </HourTable>
  ),
};

const chickenAndRice: RecipeRowProps = {
  layout: "recipe",
  nameSegments: [{ text: "Chicken and rice", matched: false }],
  href: "/recipes/chicken-and-rice",
  openLabel:
    "Chicken and rice, 1 serving 275 grams, makes 4, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams, open",
  caption: "1 serving (275 g) · makes 4",
  energy: "374",
  macros: { protein: "32", carbs: "43", fat: "8.1" },
};

// A recipe row is the library's, in a card with no heading, as the narrow library draws it.
export const Recipe: Story = {
  parameters: { isTable: true },
  render: () => (
    <div className="max-w-md p-6">
      <Card asChild padding="none">
        <ul className="divide-y divide-border">
          <FoodRow {...chickenAndRice} />
        </ul>
      </Card>
    </div>
  ),
};

// A search matched the first letters of two words, so only those are semibold.
export const RecipeMatched: Story = {
  parameters: { isTable: true },
  render: () => (
    <div className="max-w-md p-6">
      <Card asChild padding="none">
        <ul className="divide-y divide-border">
          <FoodRow
            {...chickenAndRice}
            nameSegments={[
              { text: "Chi", matched: true },
              { text: "cken and rice", matched: false },
            ]}
          />
        </ul>
      </Card>
    </div>
  ),
};

export const RecipeLongTitle: Story = {
  parameters: { isTable: true },
  render: () => (
    <div className="max-w-md p-6">
      <Card asChild padding="none">
        <ul className="divide-y divide-border">
          <FoodRow
            {...chickenAndRice}
            nameSegments={[
              {
                text: "Slow cooked chicken thighs with brown rice, roasted peppers, smoked paprika and a lot of garlic",
                matched: false,
              },
            ]}
          />
        </ul>
      </Card>
    </div>
  ),
};

export const RecipeTable: Story = {
  parameters: { isTable: true },
  render: () => (
    <div className="max-w-5xl p-6">
      <Card padding="none">
        <FoodTable variant="recipe" label="Recipes">
          <FoodRow
            layout="recipeTable"
            nameSegments={[{ text: "Beef chilli", matched: false }]}
            href="/recipes/beef-chilli"
            servingCaption="1 serving (350 g)"
            servings="6"
            energy="412"
            macros={{ protein: "34", carbs: "31", fat: "16" }}
          />
          <FoodRow
            layout="recipeTable"
            nameSegments={[{ text: "Chicken and rice", matched: false }]}
            href="/recipes/chicken-and-rice"
            servingCaption="1 serving (275 g)"
            servings="4"
            energy="374"
            macros={{ protein: "32", carbs: "43", fat: "8.1" }}
          />
        </FoodTable>
      </Card>
    </div>
  ),
};

export const IngredientTable: Story = {
  parameters: { isTable: true },
  render: () => (
    <div className="max-w-5xl p-6">
      <Card padding="none">
        <FoodTable variant="ingredient" label="Ingredients">
          <FoodRow
            layout="ingredientTable"
            nameSegments={[{ text: "Onions, raw", matched: false }]}
            amount="1 medium (110 g)"
            energy="39"
            macros={{ protein: "1.1", carbs: "8.8", fat: "0.1" }}
          />
          <FoodRow
            layout="ingredientTable"
            nameSegments={[{ text: "Milk, semi-skimmed, pasteurised, average", matched: false }]}
            amount="100 ml"
            energy="47"
            macros={{ protein: "3.6", carbs: "4.8", fat: "1.8" }}
          />
        </FoodTable>
      </Card>
    </div>
  ),
};
