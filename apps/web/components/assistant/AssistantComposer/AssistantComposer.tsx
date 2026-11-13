import { ASSISTANT_MAX_TEXT_LENGTH } from "@keylow/core";
import { ASSISTANT_SHEET } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { ArrowUp } from "lucide-react";

import type { AssistantComposerProps } from "./types";

import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";

/**
 * The message field and the round Send button under the thread, as the boards draw them: a field that grows
 * to six lines and then scrolls, and a 44 px accent circle with an arrow, with the line that says how the
 * keyboard sends under them. Enter sends, and Shift and Enter add a line. Nothing past the cap can be typed.
 */
export function AssistantComposer({
  value,
  onChange,
  onSend,
  isSendDisabled,
  isFieldDisabled,
  placeholder,
  fieldRef,
}: AssistantComposerProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <TextArea
            ref={fieldRef}
            className="max-h-36 min-h-control-md overflow-y-auto px-[14px]"
            disabled={isFieldDisabled}
            hideLabel
            label={ASSISTANT_SHEET.composerLabel}
            maxLength={ASSISTANT_MAX_TEXT_LENGTH}
            placeholder={placeholder}
            rows={1}
            value={value}
            onChange={(event) => {
              onChange(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              // A key that finishes a composition, such as an input method's candidate, is not a send.
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                onSend();
              }
            }}
          />
        </div>
        <Button
          aria-label={ASSISTANT_SHEET.sendLabel}
          className="rounded-pill"
          disabled={isSendDisabled}
          iconOnly
          onClick={onSend}
        >
          <ArrowUp aria-hidden strokeWidth={iconStroke} />
        </Button>
      </div>
      <p className="text-caption text-text-muted max-lg:hidden">
        {ASSISTANT_SHEET.composerKeyboardHint}
      </p>
    </div>
  );
}
