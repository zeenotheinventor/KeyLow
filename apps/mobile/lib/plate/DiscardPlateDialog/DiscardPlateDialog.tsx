import { PLATE, describeDiscardPlateBody } from "@keylow/core/copy";

import { ConfirmDialog } from "../../../components/ui";
import { usePlate, usePlateExit } from "../usePlate";

/**
 * "Discard your plate?", drawn once by the food sheet's layout. The layout is the sheet itself, so its modal
 * sits above every screen in the sheet, the scanner and quick add included, which a dialog drawn by the covered
 * search would not on iOS. Keep adding takes it away; Discard tells the search to leave.
 */
export function DiscardPlateDialog() {
  const { count } = usePlate();
  const { isAsking, keep, discard } = usePlateExit();

  return (
    <ConfirmDialog
      body={describeDiscardPlateBody(count)}
      cancelLabel={PLATE.discard.cancelLabel}
      confirmLabel={PLATE.discard.confirmLabel}
      open={isAsking}
      title={PLATE.discard.title}
      tone="destructive"
      onCancel={keep}
      onConfirm={discard}
    />
  );
}
