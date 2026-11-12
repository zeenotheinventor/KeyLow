import { TRAIN_PICK_DAY, describePickDayRow } from "@keylow/core/copy";

import type { PickDayDialogProps } from "./types";

import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { ListRow } from "@/components/ui/ListRow";

/**
 * The dialog Pick day opens: the active routine's days in routine order, each with its name, load and
 * weekday. Pressing a day hands its id to `onPick` and nothing more: the screen starts the session and closes
 * the dialog once the card no longer offers Pick day. No board draws it (KEY-505's waiver), so it is built
 * from the kit, as the phone's sheet is: the dialog over a card of rows. The rows are not a `GroupedList`,
 * whose heading would repeat the dialog's own.
 */
export function PickDayDialog({
  open,
  onClose,
  days,
  startingDayId,
  isDisabled,
  onPick,
}: PickDayDialogProps) {
  return (
    <Dialog
      open={open}
      title={TRAIN_PICK_DAY.sheetTitle}
      closeLabel={TRAIN_PICK_DAY.closeName}
      onClose={onClose}
    >
      <Card asChild padding="none">
        <ul aria-label={TRAIN_PICK_DAY.sheetTitle} className="divide-y divide-border">
          {days.map((day) => {
            const row = describePickDayRow(day);
            const isStarting = day.id === startingDayId;
            return (
              <ListRow
                key={day.id}
                disabled={isDisabled && !isStarting}
                loading={isStarting}
                subtitle={row.meta}
                title={row.title}
                value={row.weekdayLabel}
                onClick={() => {
                  onPick(day.id);
                }}
              />
            );
          })}
        </ul>
      </Card>
    </Dialog>
  );
}
