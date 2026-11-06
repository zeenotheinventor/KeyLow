import { PROGRAM_NO_PROGRAM, PROGRAM_TARGETS_SCREEN } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Calculator, ChartLine, Scale, Target } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";

/**
 * `program-no-program`, for a user on their own targets: the chart tile, what a programme does in three points,
 * and the way on. Until the web setup wizard exists, the way on is Set my own targets, a secondary button to the
 * Targets page, so the page does not promise an estimate it cannot make, and the line that the own targets stay
 * until the person starts is left out, as there is nothing to start. The estimate button replaces it with the
 * wizard (KEY-875). The not-medical-advice line is at the foot.
 */
export function NoProgramView() {
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
        <Button
          asChild
          variant="secondary"
          size="lg"
          className="w-full md:h-control-md md:w-auto md:px-4"
        >
          <Link href="/more/targets">{PROGRAM_TARGETS_SCREEN.setOwnTargetsLabel}</Link>
        </Button>
      </div>
      <p className="px-1 text-caption text-text-muted">{PROGRAM_NO_PROGRAM.notMedicalAdvice}</p>
    </div>
  );
}
