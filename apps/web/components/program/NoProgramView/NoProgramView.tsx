import { PROGRAM_NO_PROGRAM, describeOwnTargetsStay } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Calculator, ChartLine, Scale, Target } from "lucide-react";
import Link from "next/link";

import type { NoProgramViewProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { setupPath } from "@/lib/setupRoutes";

/**
 * `program-no-program`, for a user on their own targets: the chart tile, what a programme does in three points,
 * and Estimate my targets, a centred medium button (full width on a phone) that opens the wizard in recalculate
 * mode. Under it the person's own calorie target stays until they start, when they have one. The
 * not-medical-advice line is at the foot.
 */
export function NoProgramView({ ownTargetKcal }: NoProgramViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <span className="mb-2 flex size-14 items-center justify-center rounded-medium bg-surface-raised text-text-muted">
          <ChartLine aria-hidden className="size-8" strokeWidth={iconStroke} />
        </span>
        <h2 className="text-h2">{PROGRAM_NO_PROGRAM.title}</h2>
        <p className="text-body text-text-secondary">{PROGRAM_NO_PROGRAM.body}</p>
      </div>
      <Card asChild padding="none">
        <ul className="divide-y divide-border">
          <ListRow icon={Calculator} title={PROGRAM_NO_PROGRAM.points[0]} />
          <ListRow icon={Scale} title={PROGRAM_NO_PROGRAM.points[1]} />
          <ListRow icon={Target} title={PROGRAM_NO_PROGRAM.points[2]} />
        </ul>
      </Card>
      <div className="flex justify-center">
        <Button asChild size="lg" className="w-full md:h-control-md md:w-auto md:px-4">
          <Link href={setupPath("sex", "recalculate")}>{PROGRAM_NO_PROGRAM.startLabel}</Link>
        </Button>
      </div>
      {ownTargetKcal === null ? null : (
        <p className="px-1 text-center text-caption tabular-nums text-text-secondary">
          {describeOwnTargetsStay(ownTargetKcal)}
        </p>
      )}
      <p className="px-1 text-caption text-text-muted">{PROGRAM_NO_PROGRAM.notMedicalAdvice}</p>
    </div>
  );
}
