import { ASSISTANT_CONSENT_CARD, ASSISTANT_OFFLINE, LEGAL_URLS } from "@keylow/core/copy";
import { Linking } from "react-native";

import { AssistantNotice, Banner } from "../../ui";

import type { ConsentCardProps } from "./types";

function openPrivacyPolicy() {
  // A device with no browser rejects, and there is nothing else to do about it, so the card stays as it is.
  Linking.openURL(LEGAL_URLS.privacy).catch(() => undefined);
}

/**
 * The consent card the sheet opens on before the assistant is turned on (`assistant · consent-needed`),
 * with the same words as the Settings consent row. Every word is core's `ASSISTANT_CONSENT_CARD`, and the
 * offline banner over it is the sheet's own.
 */
export function ConsentCard({ isTurningOn, isOnline, onTurnOn, onNotNow }: ConsentCardProps) {
  return (
    <>
      {isOnline ? null : (
        <Banner body={ASSISTANT_OFFLINE.body} title={ASSISTANT_OFFLINE.title} variant="offline" />
      )}
      <AssistantNotice
        buttons={[
          {
            label: ASSISTANT_CONSENT_CARD.turnOnLabel,
            kind: "primary",
            isBusy: isTurningOn,
            isDisabled: !isOnline,
            onPress: onTurnOn,
          },
          { label: ASSISTANT_CONSENT_CARD.notNowLabel, kind: "ghost", onPress: onNotNow },
        ]}
        icon="Sparkles"
        link={{ label: ASSISTANT_CONSENT_CARD.privacyLinkLabel, onPress: openPrivacyPolicy }}
        paragraphs={ASSISTANT_CONSENT_CARD.paragraphs}
        smallPrint={ASSISTANT_CONSENT_CARD.smallPrint}
        title={ASSISTANT_CONSENT_CARD.title}
        tone="accent"
      />
    </>
  );
}
