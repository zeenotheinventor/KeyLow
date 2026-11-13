import { ASSISTANT_CONSENT_CARD, ASSISTANT_OFFLINE, LEGAL_PATHS } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Sparkles, WifiOff } from "lucide-react";
import Link from "next/link";

import type { AssistantConsentCardProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";

/**
 * The consent card the panel opens on before the assistant is turned on (`web-assistant · consent-needed`),
 * with the same words as the Settings consent row: a tile and a title, what it does, who processes it, the
 * Privacy policy link, the not-medical-advice line, and Turn on and Not now. Every word is core's
 * `ASSISTANT_CONSENT_CARD`. The policy opens in a new tab, so the conversation is not left behind.
 */
export function AssistantConsentCard({
  isOnline,
  isTurningOn,
  onTurnOn,
  onNotNow,
}: AssistantConsentCardProps) {
  return (
    <>
      {isOnline ? null : (
        <Banner icon={WifiOff} title={ASSISTANT_OFFLINE.title}>
          {ASSISTANT_OFFLINE.body}
        </Banner>
      )}
      <div className="flex flex-col gap-3 rounded-large border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-small bg-accent-muted text-accent-ink"
          >
            <Sparkles className="size-5" strokeWidth={iconStroke} />
          </span>
          <h2 className="min-w-0 flex-1 text-body-strong">{ASSISTANT_CONSENT_CARD.title}</h2>
        </div>
        {ASSISTANT_CONSENT_CARD.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-body text-text-secondary">
            {paragraph}
          </p>
        ))}
        <Link
          href={LEGAL_PATHS.privacy}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start rounded-small text-body-strong text-accent-ink underline outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {ASSISTANT_CONSENT_CARD.privacyLinkLabel}
        </Link>
        <p className="text-caption text-text-muted">{ASSISTANT_CONSENT_CARD.smallPrint}</p>
        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            disabled={!isOnline}
            loading={isTurningOn}
            loadingLabel={ASSISTANT_CONSENT_CARD.turnOnLabel}
            onClick={onTurnOn}
          >
            {ASSISTANT_CONSENT_CARD.turnOnLabel}
          </Button>
          <Button className="w-full" variant="ghost" onClick={onNotNow}>
            {ASSISTANT_CONSENT_CARD.notNowLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
