import { TRAIN_FIRST_TIME } from "@keylow/core/copy";
import { Clock, Flame, Target } from "lucide-react";

import { TrainIconTile } from "../TrainIconTile";

import type { TrainFirstTimeProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

// The three lines of `TRAIN_FIRST_TIME.points`, each with its icon.
const points = [
  { icon: Clock, text: TRAIN_FIRST_TIME.points[0] },
  { icon: Flame, text: TRAIN_FIRST_TIME.points[1] },
  { icon: Target, text: TRAIN_FIRST_TIME.points[2] },
];

/**
 * The first visit, when nothing has been logged, ever, as the `train · first-time` board draws it: a title
 * and a sentence, three lines with an icon each, and the two ways in. The board's body map at rest is left
 * out until the web has a body figure to draw it with. A button is drawn only when its handler is given, so
 * none is a dead control.
 */
export function TrainFirstTime({
  onSetGoal,
  onLogSession,
  isLogDisabled,
  isStarting = false,
}: TrainFirstTimeProps) {
  return (
    <Card padding="none" className="flex flex-col items-center gap-3 p-5 text-center">
      <h2 className="text-h2">{TRAIN_FIRST_TIME.title}</h2>
      <p className="text-body text-text-secondary">{TRAIN_FIRST_TIME.body}</p>
      <ul className="mt-2 flex flex-col gap-3 self-stretch text-left">
        {points.map(({ icon, text }) => (
          <li key={text} className="flex items-center gap-3">
            <TrainIconTile icon={icon} />
            <span className="min-w-0 flex-1 text-body">{text}</span>
          </li>
        ))}
      </ul>
      {onSetGoal === undefined && onLogSession === undefined ? null : (
        <div className="mt-3 flex flex-col gap-2 self-stretch md:flex-row md:justify-center">
          {onSetGoal === undefined ? null : (
            <Button onClick={onSetGoal}>{TRAIN_FIRST_TIME.goalAction}</Button>
          )}
          {onLogSession === undefined ? null : (
            <Button
              variant="secondary"
              disabled={isLogDisabled}
              loading={isStarting}
              onClick={onLogSession}
            >
              {TRAIN_FIRST_TIME.logAction}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
