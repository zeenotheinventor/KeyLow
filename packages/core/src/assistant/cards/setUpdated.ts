import {
  SET_UPDATED_LINK_LABEL,
  describeSetFigures,
  describeSetPutBack,
  describeSetRowName,
  describeSetUpdatedPlace,
  describeSetUpdatedSub,
  describeSetUpdatedTitle,
  describeSetWas,
} from "../../copy/assistantTrainingCards";
import { describeShortDate } from "../../copy/bodyMap";

import type { AssistantCardDraft } from "./entryCardEntry";
import type { LoadUnit } from "../../training/loads";
import type { SetValues } from "../../training/setInput";

export type SetUpdatedCardInput = {
  /** The session's routine day name, or null for a session that follows no routine day. */
  dayName: string | null;
  /** The session's day, as `YYYY-MM-DD`. */
  localDate: string;
  sessionId: string;
  /** The exercise's name as the set's own snapshot holds it. */
  exerciseName: string;
  /** Its number among the exercise's working sets, as the edit sheet counts it. */
  setNumber: number;
  /** The unit the person trains in. Both sets are given in kilograms and worded in this one. */
  unit: LoadUnit;
  /** The set as it was before the call, and as the write left it. */
  before: SetValues;
  after: SetValues;
};

/**
 * The card after an `update_past_set`: one row with the set's old numbers under its name and its new ones on
 * the right, a link to the session, and the line shown once Undo has put the set back. The loads are the
 * stored kilograms worded in the person's unit, and nothing the model sent.
 */
export function buildSetUpdatedCard({
  dayName,
  localDate,
  sessionId,
  exerciseName,
  setNumber,
  unit,
  before,
  after,
}: SetUpdatedCardInput): AssistantCardDraft {
  const show = {
    effort: before.rir !== after.rir || before.rpe !== after.rpe,
    type: before.setType !== after.setType,
  };
  const name = describeSetRowName(exerciseName, after.setType, setNumber);
  const was = describeSetFigures(before, unit, show);
  return {
    kind: "set_updated",
    title: describeSetUpdatedTitle(describeSetUpdatedPlace(dayName), 1),
    sub: describeSetUpdatedSub(localDate),
    rows: [
      {
        name,
        amountText: describeSetWas(was),
        time: null,
        kcalText: describeSetFigures(after, unit, show),
        match: null,
        matchedFood: null,
        estimate: false,
      },
    ],
    changeDetail: describeShortDate(localDate),
    totalText: null,
    note: null,
    link: { label: SET_UPDATED_LINK_LABEL, target: { screen: "session_detail", sessionId } },
    undo: "available",
    undoneSub: describeSetPutBack(name, was),
  };
}
