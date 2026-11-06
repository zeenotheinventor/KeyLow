import { progressBars } from "@keylow/core/diary";
import { useState } from "react";

import { Button } from "../Button";
import { MacroProgressStrip, MacroProgressStripSkeleton } from "../MacroProgressStrip";
import { PlateChip } from "../PlateChip";
import { Dialog } from "./Dialog";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/Dialog",
  component: Dialog,
  args: {
    open: true,
    onClose: () => undefined,
    title: "Add food",
    children: (
      <p className="text-body text-text-secondary">Pick a portion and a meal for this food.</p>
    ),
  },
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const cancelAndAdd = (
  <>
    <Button variant="ghost">Cancel</Button>
    <Button>Add to Lunch</Button>
  </>
);

export const Default: Story = { args: { footer: cancelAndAdd } };

export const WithLeadingDelete: Story = {
  args: {
    title: "Edit entry",
    footer: cancelAndAdd,
    leadingAction: <Button variant="destructive">Delete</Button>,
  },
};

export const WithoutFooter: Story = {};

const paragraphs = Array.from({ length: 14 }, (_, index) => (
  <p key={index} className="mb-4 text-body text-text-secondary">
    Chicken breast, grilled, per 100 g: 165 kcal, 31 g protein, 0 g carbohydrate, 3.6 g fat.
  </p>
));

export const LongContent: Story = { args: { footer: cancelAndAdd, children: paragraphs } };

export const LongTitle: Story = {
  args: {
    title: "Grilled chicken breast with roasted vegetables and a lemon and herb dressing",
    footer: cancelAndAdd,
  },
};

export const Narrow: Story = {
  args: { footer: cancelAndAdd, leadingAction: <Button variant="destructive">Delete</Button> },
  globals: { viewport: { value: "mobile", isRotated: false } },
};

// The dialog is controlled, so this one keeps its state and gives focus back to the button that
// opened it, which is the behaviour a still story cannot show.
function Opener() {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-6">
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Add food
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Add food"
        footer={cancelAndAdd}
      >
        <p className="text-body text-text-secondary">Pick a portion and a meal for this food.</p>
      </Dialog>
    </div>
  );
}

export const WithTrigger: Story = { render: () => <Opener /> };

// The plate's golden day: 1,039 kcal eaten, and four foods that come to 658 kcal, P 57.2, C 79.1, F 11.9.
const targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };
const eatenToday = { kcal: 1039, protein_g: 86, carbs_g: 129, fat_g: 19 };
const goldenPlateBars = progressBars(eatenToday, targets, {
  kcal: 658,
  protein_g: 57.2,
  carbs_g: 79.1,
  fat_g: 11.9,
});
// With the naan and the crisps on top: 2,257 kcal, so calories and carbs are over.
const overPlateBars = progressBars(eatenToday, targets, {
  kcal: 1218,
  protein_g: 71.2,
  carbs_g: 166.1,
  fat_g: 27.4,
});

const cancelAndLog = (
  <>
    <Button variant="ghost">Cancel</Button>
    <Button>Log foods</Button>
  </>
);

// A slot in the header before Close, for the plate chip.
export const WithHeaderAction: Story = {
  args: {
    footer: cancelAndLog,
    headerAction: <PlateChip count={4} onPress={() => undefined} />,
  },
};

// A band under the header that does not scroll with the body: the day's bars with the plate's share.
export const WithStrip: Story = {
  args: {
    footer: cancelAndLog,
    headerAction: <PlateChip count={4} onPress={() => undefined} />,
    strip: (
      <MacroProgressStrip bars={goldenPlateBars} label="Today with your plate" surface="sheet" />
    ),
    children: paragraphs,
  },
};

// Over target the outline's gap is the sheet's surface colour, which is the dialog's.
export const WithOverTargetStrip: Story = {
  args: {
    ...WithStrip.args,
    headerAction: <PlateChip count={6} onPress={() => undefined} />,
    strip: (
      <MacroProgressStrip bars={overPlateBars} label="Today with your plate" surface="sheet" />
    ),
  },
};

// The strip's place while the day is read: 51 px, so the rows do not move when the bars arrive.
export const WithStripLoading: Story = {
  args: { ...WithStrip.args, strip: <MacroProgressStripSkeleton /> },
};

// The body brings no padding, for two columns that bring their own.
export const WithoutBodyPadding: Story = {
  args: {
    footer: cancelAndLog,
    bodyPadding: false,
    children: (
      <div className="flex">
        <div className="min-w-0 flex-1 p-5 text-body text-text-secondary">Results</div>
        <div className="w-[160px] border-l border-border p-5 text-body text-text-secondary">
          Your plate
        </div>
      </div>
    ),
  },
};

// While the plate logs, Close is dimmed and Escape and a press on the dimmed page do nothing.
export const CloseDisabled: Story = {
  args: {
    footer: (
      <>
        <Button variant="ghost" disabled>
          Cancel
        </Button>
        <Button loading>Log foods</Button>
      </>
    ),
    headerAction: <PlateChip count={4} disabled onPress={() => undefined} />,
    closeDisabled: true,
  },
};
