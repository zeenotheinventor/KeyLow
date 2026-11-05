// Saves the person's own calorie and macro targets, as the Targets screen does. Saving your own targets
// ends the programme and its weekly check-in (ADR 0002, Amendment 2), so the call always asks first, and
// the question and the buttons are the board's (Amendment 1 A). Undo reopens the programme the call
// ended, and only while nothing has touched the targets or the programme since.
import { z } from "zod";

import {
  buildTargetsChangedCard,
  confirmTargetsButtons,
  confirmTargetsQuestion,
  describeMacrosAdjustedNote,
  scaleMacroTargets,
  validateTargets,
} from "../../core.ts";
import { getMyTargets, reopenProgram, updateMyTargets } from "../../repos.ts";
import { invalidInput } from "./entryWrite.ts";
import {
  readActiveProgramId,
  readProgramStamp,
  readTargetsStamp,
  sameInstant,
} from "./targetsWrite.ts";

import type { ScaledMacros, ValidTargets } from "../../core.ts";
import type { Targets } from "../../repos.ts";
import type { ConfirmationNeed, WriteRunOutput, WriteToolDefinition } from "../tool.ts";

const macrosInput = z.strictObject({
  protein_g: z.number().min(0).max(1000).describe("The new daily protein target in grams."),
  carbs_g: z.number().min(0).max(1000).describe("The new daily carbs target in grams."),
  fat_g: z.number().min(0).max(1000).describe("The new daily fat target in grams."),
});

const updateTargetsInput = z.strictObject({
  kcal: z
    .number()
    .int()
    .min(800)
    .max(6000)
    .describe("The new daily calorie target, a whole number."),
  macros: macrosInput
    .nullable()
    .describe(
      "The new protein, carbs and fat targets when the user gave all three, or null when the user gave only calories. Never a partial set.",
    ),
  current_kcal: z
    .number()
    .int()
    .nullable()
    .describe(
      "The user's calorie target right now, from the targets in get_day, or null when none is set. The user is shown this number, so it must be their own. If the call is refused with current_kcal, call again with that number.",
    ),
});

type UpdateTargetsInput = z.infer<typeof updateTargetsInput>;

// What to save, and the scaled macros when the person gave only calories and there were macros to scale.
// A refusal names the fields only, because a value can be health data.
type Plan =
  | { ok: true; targets: ValidTargets; adjusted: ScaledMacros | null }
  | { ok: false; fields: string[] };

function planOf(input: UpdateTargetsInput, current: Targets): Plan {
  if (input.macros !== null) {
    const valid = validateTargets({ kcal: input.kcal, ...input.macros });
    return valid.ok
      ? { ok: true, targets: valid.value, adjusted: null }
      : { ok: false, fields: Object.keys(valid.problems) };
  }
  const scaled = scaleMacroTargets(current, input.kcal);
  if (scaled.outcome !== "scaled") {
    return { ok: false, fields: ["macros"] };
  }
  const valid = validateTargets({ kcal: input.kcal, ...scaled.macros });
  return valid.ok
    ? { ok: true, targets: valid.value, adjusted: scaled.anyMacroSet ? scaled.macros : null }
    : { ok: false, fields: Object.keys(valid.problems) };
}

export const updateTargetsTool: WriteToolDefinition<UpdateTargetsInput> = {
  name: "update_targets",
  description:
    "Saves the user's own daily calorie, protein, carbs and fat targets, with Undo. Saving your own " +
    "targets ends the user's programme and its weekly check-in, so read the targets with get_day first " +
    "and pass the calorie target the user has now as current_kcal. When the user gave only calories " +
    '("set my calories to 2,000"), pass macros as null: Ki-Lo adjusts their current protein, carbs and ' +
    "fat by the same proportion. Do not work out the new grams and do not ask for them. When the user " +
    "gave all three, pass macros with the three numbers. If the user gave some macros but not all, ask " +
    "for the rest with ask_user, never guess one. The call first answers needs_confirmation with a " +
    "confirmation_id: in the same response as the call, before it, write the question in your own words, " +
    "asking the user to change their calorie target from the current number to the new one, and when " +
    "they have a programme say that this ends it and its weekly check-in and that today and later days " +
    "use their own targets. Ki-Lo adds the line about their macros after your question, so do not write " +
    "one. When they say yes call again with the same input and that confirmation_id. When they say no, " +
    "do not call again. If the call is " +
    "refused naming macros, ask the user for all three of protein, carbs and fat with ask_user, then " +
    "call again with them. If the call is refused with current_kcal, call again with that number.",
  kind: "write",
  input: updateTargetsInput,
  annotations: { readOnlyHint: false, destructiveHint: true },
  // The profile and the programme change together. The programme's id is what Undo needs, so the action
  // names the programme when one ended and the user's own id otherwise, which no programme row has.
  targetTable: "programs",
  // Asks only for a change that `run` would make: a refusal (a number out of range, a current_kcal that is
  // not the person's own, macros that cannot be scaled) must not spend a confirmation or show a button for
  // it. When the macros will be scaled, the answer carries the line that tells the person the figures.
  async needsConfirmation(input, ctx): Promise<ConfirmationNeed> {
    const current = await getMyTargets(ctx.caller);
    if ((current.kcal ?? null) !== input.current_kcal) {
      return false;
    }
    const plan = planOf(input, current);
    if (!plan.ok) {
      return false;
    }
    const asked = {
      question: confirmTargetsQuestion({
        currentKcal: input.current_kcal,
        newKcal: plan.targets.kcal,
        programmeActive: (await readActiveProgramId(ctx)) !== null,
      }),
      confirmLabel: confirmTargetsButtons(input.current_kcal).confirmLabel,
    };
    return plan.adjusted === null
      ? asked
      : { ...asked, note: describeMacrosAdjustedNote(plan.adjusted) };
  },
  async run(ctx, input): Promise<WriteRunOutput> {
    const before = await getMyTargets(ctx.caller);
    // The person was shown this number. Other targets now are not what they agreed to change. It is
    // checked before anything is scaled, because the scale is only right for the number they saw.
    if ((before.kcal ?? null) !== input.current_kcal) {
      return {
        data: { error: "invalid_input", fields: ["current_kcal"], current_kcal: before.kcal },
        target: null,
      };
    }
    const plan = planOf(input, before);
    if (!plan.ok) {
      return invalidInput(plan.fields);
    }
    const { targets, adjusted } = plan;
    const activeProgramId = await readActiveProgramId(ctx);

    try {
      await updateMyTargets(ctx.caller, ctx.userId, targets);
    } catch (caught) {
      // The repo ends the programme and then writes the profile. When the second step fails the programme
      // would stay ended with no action and no card, so the person's plan is put back. The repo's error
      // names the action and a code only, and so does the reopen's.
      if (activeProgramId !== null) {
        try {
          await reopenProgram(ctx.caller, activeProgramId);
        } catch (reopenFailure) {
          ctx.reportError("assistant tool update_targets", "internal_error", reopenFailure);
        }
      }
      throw caught;
    }

    // The write has landed. Nothing below may throw, or the model would save the targets a second time.
    let stamp: string | null = null;
    try {
      stamp = await readTargetsStamp(ctx);
    } catch (caught) {
      ctx.reportError("assistant tool update_targets", "internal_error", caught);
    }
    return {
      data: {
        saved: true,
        kcal: targets.kcal,
        programme_ended: activeProgramId !== null,
        ...(adjusted === null ? {} : { adjusted_macros: adjusted }),
      },
      structured: {
        card: buildTargetsChangedCard({
          kcal: targets.kcal,
          ...(adjusted === null ? {} : { adjustedMacros: adjusted }),
          previousKcal: before.kcal ?? null,
          endedProgramme: activeProgramId !== null,
          // Undo needs the stamp to compare. Without it Undo would always be unavailable.
          undoable: stamp !== null,
        }),
      },
      target:
        activeProgramId === null
          ? { targetId: ctx.userId }
          : { targetId: activeProgramId, ...(stamp === null ? {} : { targetUpdatedAt: stamp }) },
    };
  },
  // Reopens the programme the call ended, unless the person has saved their targets again, or reopened
  // or changed the programme, since. The programme's targets row was never touched, so the figures the
  // person had are in force again. The manual targets stay on the profile, where nothing reads them while
  // a programme is active, because the profile's old numbers are stored nowhere.
  async inverse(ctx, action) {
    const { targetId, targetUpdatedAt } = action;
    if (targetId === null || targetUpdatedAt === null || targetId === ctx.userId) {
      return "unavailable";
    }
    const [program, targetsStamp] = await Promise.all([
      readProgramStamp(ctx, targetId),
      readTargetsStamp(ctx),
    ]);
    if (
      program === null ||
      program.endedOn === null ||
      targetsStamp === null ||
      !sameInstant(program.updatedAt, targetUpdatedAt) ||
      !sameInstant(targetsStamp, targetUpdatedAt)
    ) {
      return "unavailable";
    }
    return (await reopenProgram(ctx.caller, targetId)) ? "undone" : "unavailable";
  },
};
