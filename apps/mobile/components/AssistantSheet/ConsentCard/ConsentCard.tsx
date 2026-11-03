import { ASSISTANT_CONSENT_CARD, LEGAL_URLS } from "@keylow/core/copy";
import { Linking } from "react-native";

import { AssistantNotice } from "../../ui";

import type { ConsentCardProps } from "./types";

function openPrivacyPolicy() {
  // A device with no browser rejects, and there is nothing else to do about it, so the card stays as it is.
  Linking.openURL(LEGAL_URLS.privacy).catch(() => undefined);
}

/**
 * The consent card the sheet opens on before the assistant is turned on (`assistant · consent-needed`),
 * with the same words as the Settings consent row. Every word is core's `ASSISTANT_CONSENT_CARD`.
 */
export function ConsentCard({ isTurningOn, onTurnOn, onNotNow }: ConsentCardProps) {
  return (
    <AssistantNotice
      buttons={[
        {
          label: ASSISTANT_CONSENT_CARD.turnOnLabel,
          kind: "primary",
          isBusy: isTurningOn,
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
  );
}
