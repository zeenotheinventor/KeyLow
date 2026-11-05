import { SUGGESTION_NO_GOAL } from "@keylow/core/copy";
import { Check, Sparkles, Target } from "lucide-react";

import { TrainIconTile } from "../TrainIconTile";

import type { SuggestionCardProps, SuggestionOfferState } from "./types";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** Marks the Add button, so the toast's keyboard route can bring focus back to it after an Undo. */
export const SUGGESTION_ADD_ATTRIBUTE = "data-suggestion-add";
/** Marks the accepted card, which takes focus when Add is gone and the toast closes. */
export const SUGGESTION_ACCEPTED_ATTRIBUTE = "data-suggestion-accepted";

// The swatch before each reason, written out so Tailwind sees them. The volume swatch is the nearest token
// to the board's `--volume-under`, which the live tokens no longer have.
const reasonSwatchClassNames = {
  volume: "bg-volume-maintaining",
  heat: "bg-heat-1",
  length: "bg-text-muted",
} as const;

function Offer({
  state,
  onDismiss,
}: {
  state: SuggestionOfferState;
  onDismiss: SuggestionCardProps["onDismiss"];
}) {
  const { copy } = state;
  return (
    <Card asChild>
      <section aria-label={copy.cardName} className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <TrainIconTile icon={Sparkles} tone="accent" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-caption text-text-muted">{copy.label}</span>
            <span className="text-body-strong break-words">{copy.headline}</span>
          </div>
        </div>
        <p className="text-body break-words">{copy.sentence}</p>
        <ul aria-label={copy.reasonsName} className="flex flex-col gap-1.5">
          {copy.reasons.map(({ kind, text }) => (
            <li key={text} className="flex gap-2">
              <span
                aria-hidden
                className={`mt-[3px] size-2.5 shrink-0 rounded-[3px] ${reasonSwatchClassNames[kind]}`}
              />
              <span className="min-w-0 flex-1 break-words text-caption text-text-secondary">
                {text}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          {state.accept === undefined ? null : (
            <Button
              {...{ [SUGGESTION_ADD_ATTRIBUTE]: "" }}
              className="flex-1 md:flex-none"
              size="sm"
              loading={state.isAccepting}
              onClick={state.accept}
            >
              {copy.primaryAction}
            </Button>
          )}
          {onDismiss === undefined ? null : (
            <Button
              aria-label={copy.dismissActionName}
              size="sm"
              variant="ghost"
              onClick={() => {
                onDismiss(state.day);
              }}
            >
              {copy.dismissAction}
            </Button>
          )}
        </div>
      </section>
    </Card>
  );
}

function Statement({
  name,
  tile,
  title,
  body,
  isFocusTarget = false,
}: {
  name: string;
  tile: ReactNode;
  title: string;
  body: string;
  isFocusTarget?: boolean;
}) {
  return (
    <Card asChild>
      <section
        aria-label={name}
        className="flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        {...(isFocusTarget ? { tabIndex: -1, [SUGGESTION_ACCEPTED_ATTRIBUTE]: "" } : {})}
      >
        {tile}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body-strong">{title}</span>
          <span className="text-caption text-text-secondary">{body}</span>
        </div>
      </section>
    </Card>
  );
}

/**
 * The suggestion card on the Train page in its four states, as the `suggestion · *` boards draw them: the
 * offer with the reasons behind it and its two buttons, the card once it is added to the day, the card that
 * says there is nothing to add, and the card for a user with no goal. Every word is core's, given in the
 * state. A button is drawn only when its handler is given, and the offer for today draws no Add, so no
 * control is dead. The card is not pressable: the link to the detail waits for the web detail ticket. The
 * accepted card can take focus by script (not by Tab), because it is where the toast's keyboard route lands
 * once Add has gone.
 */
export function SuggestionCard({ state, onDismiss, onSetGoal }: SuggestionCardProps) {
  switch (state.status) {
    case "hidden":
      return null;
    case "offer":
      return <Offer state={state} onDismiss={onDismiss} />;
    case "accepted":
      return (
        <Statement
          isFocusTarget
          body={state.copy.detail}
          name={state.copy.cardName}
          tile={<TrainIconTile icon={Check} tone="success" />}
          title={state.copy.title}
        />
      );
    case "nothing":
      return (
        <Statement
          body={state.copy.body}
          name={state.copy.cardName}
          tile={<TrainIconTile icon={Target} />}
          title={state.copy.title}
        />
      );
    case "no_goal":
      return (
        <Card asChild>
          <section aria-label={SUGGESTION_NO_GOAL.sectionName} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <TrainIconTile icon={Sparkles} tone="accent" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-body-strong">{SUGGESTION_NO_GOAL.title}</span>
                <span className="text-caption text-text-secondary">{SUGGESTION_NO_GOAL.body}</span>
              </div>
            </div>
            {onSetGoal === undefined ? null : (
              <Button className="md:self-start" size="sm" onClick={onSetGoal}>
                {SUGGESTION_NO_GOAL.action}
              </Button>
            )}
          </section>
        </Card>
      );
  }
}
