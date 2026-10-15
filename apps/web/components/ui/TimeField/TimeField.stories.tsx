import { useState } from "react";
import { userEvent, within } from "storybook/test";

import { TimeField } from "./TimeField";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/TimeField",
  component: TimeField,
  args: { value: "12:40", onChange: () => undefined },
  decorators: [
    (Story) => (
      <div className="min-h-[420px] max-w-xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TimeField>;

export default meta;

type Story = StoryObj<typeof meta>;

// The field keeps nothing but whether its picker is open. A story that lets the value change holds it here.
function Chosen(props: Parameters<typeof TimeField>[0]) {
  const [value, setValue] = useState(props.value);

  return <TimeField {...props} value={value} onChange={setValue} />;
}

export const Default: Story = { render: (args) => <Chosen {...args} /> };

export const WithNowHelper: Story = {
  args: { isNow: true },
  render: (args) => <Chosen {...args} />,
};

export const Compact: Story = { args: { compact: true }, render: (args) => <Chosen {...args} /> };

export const CompactNow: Story = {
  args: { compact: true, isNow: true },
  render: (args) => <Chosen {...args} />,
};

// The picker opens as a popover under the field from 700 px and as a bottom panel below it.
export const Open: Story = {
  args: { isNow: true },
  render: (args) => <Chosen {...args} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /^Time/ }));
  },
};

export const OpenNarrow: Story = {
  ...Open,
  globals: { viewport: { value: "mobile", isRotated: false } },
};

// Focus is real: the play function tabs onto the field, so the ring shows as it does for a keyboard.
export const Focused: Story = {
  render: (args) => <Chosen {...args} />,
  play: async () => {
    await userEvent.tab();
  },
};
