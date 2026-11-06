"use client";

import { useProgramScreen } from "@keylow/api-client";
import { OFFLINE_BANNER, PROGRAM_ERROR, PROGRAM_SCREEN } from "@keylow/core/copy";
import { WifiOff } from "lucide-react";

import { COLUMNS_CLASS_NAME } from "./columns";
import { ProgramActionsCard } from "./ProgramActionsCard";
import { CheckinSummaryCard } from "../CheckinSummaryCard";
import { ExpenditureChartCard } from "../ExpenditureChartCard";
import { ExpenditureHeroCard } from "../ExpenditureHeroCard";
import { NoProgramView } from "../NoProgramView";
import { ProgramLoading } from "../ProgramLoading";
import { SettlingChecklist } from "../SettlingChecklist";
import { WeekTargetsCard } from "../WeekTargetsCard";
import { YourProgramme } from "../YourProgramme";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Banner } from "@/components/ui/Banner";
import { ErrorState } from "@/components/ui/ErrorState";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

// The Programme page is a row of More's Nutrition section, so its way back leads there.
const MORE_HREF = "/more";

/**
 * The Programme page, as the `program-*` boards draw it: the estimate, what the first check-in needs while
 * settling, this week's targets, what the last check-in changed and the expenditure chart in the first column, and
 * Your programme with its actions card and the not-medical-advice line in the second, or the no-programme,
 * loading and error boards. The estimate says it is an estimate, and the page ends with the legal line.
 *
 * The web has no persisted cache and a read pauses offline, so `useProgramScreen` stays loading with nothing read.
 * Offline with nothing read is the error board with no Try again, which would do nothing: the read goes ahead by
 * itself when the connection returns. The connection going while the page is open keeps the figures read in this
 * session under an offline banner over both columns. Edit programme comes with its own ticket.
 */
export function ProgramScreen() {
  const state = useProgramScreen({ enabled: true, now: useNow() });
  const isOnline = useIsOnline();

  function renderBody() {
    switch (state.status) {
      case "loading":
        return state.isPaused || !isOnline ? (
          <ErrorState title={PROGRAM_ERROR.title} body={PROGRAM_ERROR.body} size="page" />
        ) : (
          <ProgramLoading />
        );
      case "error":
        return (
          <ErrorState
            title={PROGRAM_ERROR.title}
            body={PROGRAM_ERROR.body}
            retryLabel={PROGRAM_ERROR.retryLabel}
            size="page"
            onRetry={state.retry}
          />
        );
      case "no-program":
        return <NoProgramView />;
      case "program": {
        const { checkin, hero, settlingChecklist, targets, details } = state.view;

        return (
          <>
            {!isOnline && (
              <Banner title={OFFLINE_BANNER.title} icon={WifiOff}>
                {PROGRAM_SCREEN.offlineBody}
              </Banner>
            )}
            <div className={COLUMNS_CLASS_NAME}>
              <div className="flex flex-col gap-4">
                <ExpenditureHeroCard view={hero} />
                {settlingChecklist === null ? null : <SettlingChecklist {...settlingChecklist} />}
                {targets === null ? null : <WeekTargetsCard view={targets} />}
                {checkin === null ? null : <CheckinSummaryCard {...checkin.card} />}
                <ExpenditureChartCard />
              </div>
              <div className="flex flex-col gap-4">
                <YourProgramme rows={details} />
                <ProgramActionsCard />
                <p className="px-1 text-caption text-text-muted">
                  {PROGRAM_SCREEN.notMedicalAdvice}
                </p>
              </div>
            </div>
          </>
        );
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 lg:gap-6">
      <div className="flex flex-col gap-1">
        {/* The board draws the link 44 high with 8 px off its top and bottom in the flow, so its target is 44 and the title sits as drawn. */}
        <div className="-my-2 flex">
          <BackToFoodsLink tone="accent" label={PROGRAM_SCREEN.backName} href={MORE_HREF} />
        </div>
        <h1 className="text-h1">{PROGRAM_SCREEN.title}</h1>
      </div>
      {renderBody()}
    </div>
  );
}
