import { SETUP_TARGETS_ROW } from "@keylow/core/copy";
import { Calculator } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { forgetRecalculationSaved, setupPath } from "@/lib/setupRoutes";

/**
 * The row that opens the setup wizard in recalculate mode, first under the Targets heading whether the targets are
 * the person's own or a programme's (`setup-targets-row`). It is a link, so it works without a connection: the
 * answers are free to give, and only the save at the end needs one. Opening it clears the mark of an earlier
 * saved recalculation, which would otherwise send the new one back here.
 */
export function EstimateTargetsRow() {
  return (
    <Card asChild padding="none">
      <ul aria-label={SETUP_TARGETS_ROW.title} onClickCapture={forgetRecalculationSaved}>
        <ListRow
          icon={Calculator}
          title={SETUP_TARGETS_ROW.title}
          subtitle={SETUP_TARGETS_ROW.subtitle}
          href={setupPath("sex", "recalculate")}
        />
      </ul>
    </Card>
  );
}
