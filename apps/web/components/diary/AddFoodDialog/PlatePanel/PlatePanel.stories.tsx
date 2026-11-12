import { setPlateQuantity } from "@keylow/core/plate";
import { useState } from "react";

import { BackToResults } from "../BackToResults";
import { dayBarsFor, goldenPlate, overPlate } from "./goldenPlate";
import { PlatePanel } from "./PlatePanel";

import type { PlatePanelProps } from "./types";
import type { Meta, StoryObj } from "@storybook/nextjs";

import { DIARY_DIALOG_CLASSES } from "@/components/diary/diaryDialogClasses";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { PlateChip } from "@/components/ui/PlateChip";

// The panel draws the state it is given and keeps none, so a story holds the plate here: typing an amount
// moves the rows, the totals and the bars together, as the plate does. The panel sits in the add dialog as the
// boards draw it, with the chip pressed and Log foods in the footer. The bars are in the totals card while the panel is open, so the dialog's strip is not drawn. Under 1024 px
// it is a step of the 560 dialog with the Results link above it, and from 1024 px (the Column story) it is a 400 px column beside the results.
type LivePanelProps = Partial<PlatePanelProps> & {
  asColumn?: boolean;
  isLogging?: boolean;
};

function LivePanel({
  items: startingItems = goldenPlate,
  asColumn = false,
  ...props
}: LivePanelProps) {
  const [items, setItems] = useState(startingItems);
  const [time, setTime] = useState("19:20");
  const [isNow, setIsNow] = useState(true);
  const dayBars = "dayBars" in props ? props.dayBars : dayBarsFor(items);
  const isLogging = props.isLogging ?? false;

  const panel = (
    <PlatePanel
      items={items}
      dayBars={dayBars}
      time={time}
      isNow={isNow}
      isLogging={isLogging}
      resultsLink={asColumn ? <BackToResults onClick={() => undefined} /> : undefined}
      onTimeChange={(next) => {
        setTime(next);
        setIsNow(false);
      }}
      onAmountChange={(key, text) => {
        setItems((current) => setPlateQuantity(current, key, text));
      }}
      onRemove={(key) => {
        setItems((current) => current.filter((item) => item.key !== key));
      }}
      onClear={() => {
        setItems([]);
      }}
    />
  );

  return (
    <Dialog
      open
      onClose={() => undefined}
      title="Add food"
      closeDisabled={isLogging}
      bodyPadding={false}
      className={asColumn ? `${DIARY_DIALOG_CLASSES} min-[1024px]:w-[960px]` : DIARY_DIALOG_CLASSES}
      headerAction={
        <PlateChip count={items.length} isExpanded disabled={isLogging} onPress={() => undefined} />
      }
      footer={
        <>
          <Button variant="ghost" disabled={isLogging}>
            Cancel
          </Button>
          <Button loading={isLogging}>Log foods</Button>
        </>
      }
    >
      {asColumn ? (
        <div className="flex h-full min-h-0">
          <div className="min-w-0 flex-1 p-5 text-body text-text-secondary">Results</div>
          <div className="flex min-h-0 w-[400px] shrink-0 flex-col border-l border-border p-5">
            {panel}
          </div>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-2 p-5">
          <BackToResults onClick={() => undefined} />
          {panel}
        </div>
      )}
    </Dialog>
  );
}

const meta = {
  title: "Diary/PlatePanel",
  component: LivePanel,
} satisfies Meta<typeof LivePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

// The golden plate: 658 kcal, 1,697 with the day.
export const WithRowsAndTotals: Story = {};

// Beside the results from 1024 px, with the Results link in the heading.
export const AsColumn: Story = {
  args: { asColumn: true },
  globals: { viewport: { value: "desktop", isRotated: false } },
};

export const OnPhone: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

// Until the day, its targets and the time zone are read the totals card has no bars and no heading.
export const WithoutBars: Story = { args: { dayBars: undefined } };

// Six foods: 2,257 kcal with the day, calories and carbs at full bar with the outline.
export const OverTarget: Story = { args: { items: overPlate } };

export const OverTargetOnPhone: Story = {
  args: { items: overPlate },
  globals: { viewport: { value: "mobile", isRotated: false } },
};

// The milk's amount is empty: it counts as 0 across and says why under its row.
export const InvalidAmount: Story = {
  args: { items: setPlateQuantity(goldenPlate, "milk", "") },
};

// While the plate logs, the rows, Clear plate and Time dim, and the totals stay readable.
export const Logging: Story = { args: { isLogging: true } };
