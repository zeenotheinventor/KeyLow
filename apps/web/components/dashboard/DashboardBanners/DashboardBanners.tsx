import { NO_TARGET_BANNER, OFFLINE_BANNER } from "@keylow/core/copy";
import { WifiOff } from "lucide-react";

import type { DashboardBannersProps } from "./types";

import { Banner } from "@/components/ui/Banner";

const TARGETS_HREF = "/more/targets";

/**
 * The notices that stand over the whole dashboard, above both cards: that no target is set, and that the
 * page is offline. They span the page rather than one column, so the two cards stay top aligned.
 */
export function DashboardBanners({ isOnline, hasNoTarget }: DashboardBannersProps) {
  return (
    <>
      {hasNoTarget && (
        <Banner
          title={NO_TARGET_BANNER.title}
          action={{ label: NO_TARGET_BANNER.action, href: TARGETS_HREF }}
          actionPlacement="below"
        >
          {NO_TARGET_BANNER.body}
        </Banner>
      )}
      {isOnline ? null : (
        <Banner title={OFFLINE_BANNER.title} icon={WifiOff}>
          {OFFLINE_BANNER.body}
        </Banner>
      )}
    </>
  );
}
