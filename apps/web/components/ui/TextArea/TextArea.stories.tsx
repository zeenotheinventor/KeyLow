import { userEvent } from "storybook/test";

import { TextArea } from "./TextArea";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { Button } from "@/components/ui/Button";

const stepText =
  "Heat the oil in a large pan and fry the chicken over a medium-high heat for 6 to 8 minutes, turning it now and then, until it is golden on every side and cooked through with no pink left in the middle.";

const meta = {
  title: "UI/TextArea",
  component: TextArea,
  args: { label: "Step 3 text", hideLabel: true, placeholder: "Describe this step" },
  decorators: [
    (Story) => (
      <div className="max-w-xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TextArea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// The box grows to hold the whole text, as the step board draws it.
export const Filled: Story = { args: { defaultValue: stepText } };

// Focus is real: the play function tabs onto the field, so the accent border shows. The ring joins
// it in the light theme.
export const Focused: Story = {
  args: { defaultValue: stepText },
  play: async () => {
    await userEvent.tab();
  },
};

export const WithCounter: Story = { args: { defaultValue: stepText, counter: "201 / 1,000" } };

// Past the limit the counter turns danger in dark, the border in both themes, and the sentence says why.
export const OverLimit: Story = {
  args: {
    defaultValue: stepText.repeat(6),
    counter: "1,206 / 1,000",
    isOverLimit: true,
    error: "Keep a step to 1,000 characters or fewer.",
  },
};

export const WithError: Story = {
  args: { error: "Describe the step in a few words.", label: "Step 3 text", hideLabel: false },
};

// The step editor's foot: Done and Cancel beside the count.
export const WithFooter: Story = {
  args: {
    defaultValue: stepText,
    counter: "201 / 1,000",
    footer: (
      <>
        <Button size="sm">Done</Button>
        <Button size="sm" variant="ghost">
          Cancel
        </Button>
      </>
    ),
  },
};

export const Disabled: Story = { args: { defaultValue: stepText, disabled: true } };

// At 375 the text wraps over more lines, and the foot keeps the buttons and the count on one line.
export const Mobile: Story = {
  args: WithFooter.args ?? {},
  globals: { viewport: { value: "mobile", isRotated: false } },
};
