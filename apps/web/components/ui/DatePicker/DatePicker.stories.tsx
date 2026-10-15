import { useRef, useState } from "react";

import { DatePicker } from "./DatePicker";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { Button } from "@/components/ui/Button";

// Thursday 15 October 2026, with the 12th and 13th complete, as the diary board draws it.
const meta = {
  title: "UI/DatePicker",
  component: DatePicker,
  args: {
    selectedDate: "2026-10-15",
    today: "2026-10-15",
    completeDays: ["2026-10-12", "2026-10-13"],
    onSelectDate: () => undefined,
    onClose: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="p-4 md:p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DatePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OnToday: Story = {};

// Next month is enabled when the month on view is before the month of today.
export const OnAnEarlierMonth: Story = {
  args: { selectedDate: "2026-08-20", completeDays: ["2026-08-18", "2026-08-19"] },
};

// June 2026 begins on a Monday, so its first week has no blank cells.
export const MonthStartingOnMonday: Story = {
  args: { selectedDate: "2026-06-10", today: "2026-10-15", completeDays: [] },
};

function OpeningPicker() {
  const opener = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("2026-10-15");

  return (
    <div className="relative">
      <Button
        ref={opener}
        variant="secondary"
        onClick={() => {
          setIsOpen(!isOpen);
        }}
      >
        Choose a date
      </Button>
      {isOpen && (
        <DatePicker
          className="absolute left-0 top-full mt-1"
          selectedDate={selectedDate}
          today="2026-10-15"
          completeDays={["2026-10-12", "2026-10-13"]}
          opener={opener}
          onSelectDate={setSelectedDate}
          onClose={() => {
            setIsOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Open it with the button, move with the arrow keys, and close it with Escape to see focus return.
export const Opening: Story = { render: () => <OpeningPicker /> };
