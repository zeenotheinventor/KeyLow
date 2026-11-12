"use client";

import { useAssistantConsent } from "@keylow/api-client";
import { describeAssistantMoreRow } from "@keylow/core/copy";

import { ListRow } from "@/components/ui/ListRow";

/**
 * The Assistant row of More, first in Settings (`web-assistant-settings · assistant-row`): it opens the Assistant
 * settings page, and says under its title and at its end whether the assistant is off or on. It says nothing but
 * its title until the setting is read, and while the read waits for a connection. The row is drawn and opens in
 * every one of those, with no skeleton.
 */
export function AssistantRow() {
  const { title, subtitle, value } = describeAssistantMoreRow(useAssistantConsent().data?.isOn);

  return <ListRow title={title} subtitle={subtitle} value={value} href="/more/assistant" />;
}
