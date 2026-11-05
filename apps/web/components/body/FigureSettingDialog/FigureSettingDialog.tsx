import { BODY_MAP } from "@keylow/core/copy";

import type { FigureSettingDialogProps } from "./types";
import type { BodyArtworkFigure } from "@keylow/core/training";

import { BodyFigure } from "@/components/ui/BodyFigure";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const PREVIEW_WIDTH = 84;

const options = [
  { value: "male", label: BODY_MAP.figureSetting.options.male },
  { value: "female", label: BODY_MAP.figureSetting.options.female },
] as const satisfies readonly { value: BodyArtworkFigure; label: string }[];

/**
 * The dialog that asks for the figure the body is drawn as, on the first visit to the body map and from the
 * button in its header: a preview of the figure at 84 pixels, Male and Female, the line saying that only the
 * drawing changes, and Done. A choice applies at once and the dialog stays open, so the preview shows it.
 * No board draws it (KEY-467), so it is built from the kit as the mobile sheet is. The preview is decoration
 * beside the choice, which the buttons name, so a screen reader skips it.
 */
export function FigureSettingDialog({ open, onClose, figure, onChange }: FigureSettingDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={BODY_MAP.figureSetting.sheetTitle}
      className="min-[700px]:w-[400px]"
      footer={<Button onClick={onClose}>{BODY_MAP.figureSetting.done}</Button>}
    >
      <div className="flex flex-col gap-4">
        <div aria-hidden className="flex justify-center">
          <BodyFigure
            body={figure}
            label={BODY_MAP.figureSetting.options[figure]}
            scale="heat"
            side="front"
            values={{}}
            w={PREVIEW_WIDTH}
          />
        </div>
        <SegmentedControl
          label={BODY_MAP.figureSetting.label}
          options={options}
          value={figure}
          onChange={onChange}
        />
        <p className="text-center text-caption text-text-secondary">
          {BODY_MAP.figureSetting.description}
        </p>
      </div>
    </Dialog>
  );
}
