"use client";

import { useWeightTrend } from "@keylow/api-client";
import {
  TREND_EXPLAINER,
  TREND_EXPLAINER_BODY_SECTION,
  describeSettlingBanner,
} from "@keylow/core/copy";
import { TREND_SETTLED_OBS } from "@keylow/core/weight";

import type { TrendExplainerDialogProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SettlingProgressBar } from "@/components/ui/SettlingProgressBar";

const SECTIONS = [...TREND_EXPLAINER.sections, TREND_EXPLAINER_BODY_SECTION];

/**
 * The dialog that explains the trend weight, as the `web-weight` explainer boards draw it: the six sections,
 * the sixth on body fat and lean mass after Weekly rate, and the line that the trend is an estimate, with Done
 * in the footer. While the trend is settling a warning banner over the sections says how many of the 7
 * weigh-ins it has, with a progress bar. A short window scrolls the dialog's contents and keeps its header
 * and Done in view.
 *
 * The explanation does not wait for the weigh-ins. Still reading, or offline with nothing read, the trend has
 * no points and is not settling, so the dialog draws as it does for a settled trend or none: the sections
 * only, with no spinner and no claim about the user's own count. Render it only while it is open.
 */
export function TrendExplainerDialog({ onClose, returnFocusTo }: TrendExplainerDialogProps) {
  const trend = useWeightTrend();
  const lastPoint = trend.points[trend.points.length - 1];

  return (
    <Dialog
      open
      title={TREND_EXPLAINER.title}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
      footer={<Button onClick={onClose}>{TREND_EXPLAINER.done}</Button>}
    >
      <div className="flex flex-col gap-4">
        {trend.settling && lastPoint !== undefined && (
          <Banner
            tone="review"
            size="compact"
            hasIcon={false}
            title={describeSettlingBanner(lastPoint.nObs)}
          >
            {/* The banner's own words say the count, so the track has no caption. The board keeps 8 under the title, 2 of them the banner's. */}
            <SettlingProgressBar
              className="mt-1.5"
              hasCaption={false}
              count={lastPoint.nObs}
              target={TREND_SETTLED_OBS}
              label={TREND_EXPLAINER.progressName}
            />
          </Banner>
        )}
        {SECTIONS.map((section) => (
          <section key={section.title} className="flex flex-col gap-1">
            <h3 className="text-body-strong">{section.title}</h3>
            {/* The board sets the paragraphs at 14 over 21 in the regular weight, which no type class has. */}
            <p className="text-[14px] font-normal leading-[21px] text-text-secondary">
              {section.text}
            </p>
          </section>
        ))}
        <p className="text-caption text-text-muted">{TREND_EXPLAINER.footer}</p>
      </div>
    </Dialog>
  );
}
