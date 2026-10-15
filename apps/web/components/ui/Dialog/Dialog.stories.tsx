import { useState } from "react";

import { Button } from "../Button";
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
