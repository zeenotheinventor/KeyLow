import { useState } from "react";
import { userEvent, within } from "storybook/test";

import { DateField } from "./DateField";

import type { Meta, StoryObj } from "@storybook/nextjs";

// Saturday 17 October 2026, the day the weigh-in boards draw.
const meta = {
  title: "UI/DateField",
  component: DateField,
  args: {
    label: "Date",
    value: "2026-10-17",
    display: "Today, Sat 17 Oct",
    today: "2026-10-17",
    onChange: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="min-h-[460px] max-w-xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DateField>;

export default meta;

type Story = StoryObj<typeof meta>;

// The field keeps nothing but whether its picker is open. A story that lets the day change holds it here.
function Chosen(props: Parameters<typeof DateField>[0]) {
  const [value, setValue] = useState(props.value);

  return (
    <DateField
      {...props}
      value={value}
      display={value === props.today ? props.display : value}
      onChange={setValue}
    />
  );
}

export const Default: Story = { render: (args) => <Chosen {...args} /> };

// The picker opens as a popover under the field, with no day after today to choose.
export const Open: Story = {
  render: (args) => <Chosen {...args} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /^Date/ }));
  },
};

export const OpenNarrow: Story = {
  ...Open,
  globals: { viewport: { value: "mobile", isRotated: false } },
};
