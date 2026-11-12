import { SUGGESTION_CARD, SUGGESTION_NO_GOAL } from "@keylow/core/copy";
import { Check, ChevronRight, Sparkles, Target } from "lucide-react";

import { TrainIconTile } from "../TrainIconTile";

import type { SuggestionCardProps, SuggestionOfferState } from "./types";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Marks the card's primary button (Add, or Start for today), so the toast's keyboard route can bring focus
 * back to it after an Undo.
 */
export const SUGGESTION_PRIMARY_ATTRIBUTE = "data-suggestion-primary";
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
  isStarting,
  onDismiss,
  onOpenDetail,
}: {
  state: SuggestionOfferState;
  isStarting: boolean;
  onDismiss: SuggestionCardProps["onDismiss"];
  onOpenDetail: SuggestionCardProps["onOpenDetail"];
}) {
  const { copy } = state;
  // Add for a day to come, Start for today: one primary button, whose handler is the one the state holds.
  const primary = state.accept ?? state.start;
  const words = (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-caption text-text-muted">{copy.label}</span>
      <span className="text-body-strong break-words">{copy.headline}</span>
    </div>
  );
  return (
    <Card asChild>
      <section aria-label={copy.cardName} className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <TrainIconTile icon={Sparkles} tone="accent" />
          {state.detail === undefined || onOpenDetail === undefined ? (
            words
          ) : (
            // The board draws the label and headline with a chevron as the one way into the detail, and the
            // accessible name is core's "See why" one.
            <button
              aria-haspopup="dialog"
              aria-label={copy.linkName}
              className="flex min-h-touch-target min-w-0 flex-1 items-center gap-2 rounded-medium text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              type="button"
              onClick={onOpenDetail}
            >
              {words}
              <ChevronRight aria-hidden className="size-4 shrink-0 text-text-muted" />
            </button>
          )}
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
          {primary === undefined ? null : (
            <Button
              {...{ [SUGGESTION_PRIMARY_ATTRIBUTE]: "" }}
              aria-label={copy.primaryActionName}
              className="flex-1 md:flex-none"
              size="sm"
              loading={state.isAccepting || (state.isForToday && isStarting)}
              onClick={primary}
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
  action,
  isFocusTarget = false,
}: {
  name: string;
  tile: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
  isFocusTarget?: boolean;
}) {
  return (
    <Card asChild>
      <section
        aria-label={name}
        className="flex flex-col gap-3 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        {...(isFocusTarget ? { tabIndex: -1, [SUGGESTION_ACCEPTED_ATTRIBUTE]: "" } : {})}
      >
        <div className="flex items-center gap-3">
          {tile}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-body-strong">{title}</span>
            <span className="text-caption text-text-secondary">{body}</span>
          </div>
        </div>
        {action}
      </section>
    </Card>
  );
}

/**
 * The suggestion card on the Train page in its four states, as the `suggestion · *` boards draw them: the
 * offer with the reasons behind it and its two buttons, the card once it is added to the day, the card that
 * says there is nothing to add, and the card for a user with no goal. Every word is core's, given in the
 * state. A button is drawn only when its handler is given: the offer for today draws Start where a day to
 * come draws Add, and the accepted card draws a Start only for today, so no control is dead. `isStarting` is
 * a start under way anywhere on the page, which dims Start so that a second press does nothing. Only the
 * offer opens the detail, through the heading's button, and only when it holds the detail: the other states
 * have no session to show. The accepted card can take focus by script (not by Tab), because it is where the
 * toast's keyboard route lands once Add has gone.
 */
export function SuggestionCard({
  state,
  isStarting = false,
  onDismiss,
  onSetGoal,
  onOpenDetail,
}: SuggestionCardProps) {
  switch (state.status) {
    case "hidden":
      return null;
    case "offer":
      return (
        <Offer
          isStarting={isStarting}
          state={state}
          onDismiss={onDismiss}
          onOpenDetail={onOpenDetail}
        />
      );
    case "accepted":
      return (
        <Statement
          action={
            state.start === undefined ? undefined : (
              <Button
                aria-label={state.copy.startActionName}
                className="md:self-start"
                loading={isStarting}
                size="sm"
                onClick={state.start}
              >
                {SUGGESTION_CARD.startAction}
              </Button>
            )
          }
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
