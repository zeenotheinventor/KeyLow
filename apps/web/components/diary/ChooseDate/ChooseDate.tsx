import { useCompleteDays } from "@keylow/api-client";
import { DAY_STEPPER } from "@keylow/core/copy";
import { monthOf } from "@keylow/core/dates";
import { iconStroke } from "@keylow/tokens";
import { Calendar } from "lucide-react";
import { useRef, useState } from "react";

import type { ChooseDateProps } from "./types";

import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";

function PickerWithCompleteDays({
  selectedDate,
  today,
  opener,
  onSelectDate,
  onClose,
}: ChooseDateProps & {
  opener: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(monthOf(selectedDate));
  const completeDays = useCompleteDays(month);

  return (
    <DatePicker
      className="absolute left-0 top-full z-20 mt-1"
      selectedDate={selectedDate}
      today={today}
      completeDays={completeDays.data ?? []}
      opener={opener}
      onMonthChange={setMonth}
      onSelectDate={onSelectDate}
      onClose={onClose}
    />
  );
}

/**
 * The calendar button of the diary's header and the date picker it opens. The picker is drawn under the
 * header, so put this inside a positioned element. The complete days of the month on view are read only
 * while the picker is open, and again for each month it moves to.
 */
export function ChooseDate({ selectedDate, today, onSelectDate }: ChooseDateProps) {
  const opener = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        ref={opener}
        type="button"
        variant="ghost"
        iconOnly
        aria-label={DAY_STEPPER.chooseDate}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen(!isOpen);
        }}
      >
        <Calendar aria-hidden strokeWidth={iconStroke} />
      </Button>
      {isOpen && (
        <PickerWithCompleteDays
          selectedDate={selectedDate}
          today={today}
          opener={opener}
          onSelectDate={onSelectDate}
          onClose={() => {
            setIsOpen(false);
          }}
        />
      )}
    </>
  );
}
