import { useUpdateTargets } from "@keylow/api-client";
import {
  DIARY_PROBLEMS,
  MACROS_OPTIONAL,
  PROGRAM_TARGETS_SCREEN,
  SAVE_FAILED_BANNER,
  TARGETS_NOTE,
  TARGETS_PAGE,
  TARGETS_SAVED_TOAST,
  TARGETS_SCREEN,
  TARGET_KCAL_HELPER,
  describeMacroTargetField,
  describeMacroTotal,
} from "@keylow/core/copy";
import { enteredNumber, fieldText, macroKcal, validateTargets } from "@keylow/core/diary";
import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SwitchToManualDialog } from "../SwitchToManualDialog";

import type { TargetsFormProps } from "./types";
import type { SyntheticEvent } from "react";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { NumericInput } from "@/components/ui/NumericInput";
import { useToast } from "@/components/ui/Toast";

const MORE_HREF = "/more";

// The three macro fields share one row at the wide width, as the board draws them. They are plain
// labels, not marked with the macro colours.
const MACRO_FIELDS = [
  { name: "protein", label: TARGETS_SCREEN.protein },
  { name: "carbs", label: TARGETS_SCREEN.carbs },
  { name: "fat", label: TARGETS_SCREEN.fat },
] as const;

// The Cancel link is the board's text link: a 14 px label, secondary ink, and a 44 px target.
const cancelLinkClassName =
  "flex min-h-touch-target items-center rounded-small text-[14px] font-semibold leading-5 text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

/**
 * The Targets form: calories (whole numbers from 800 to 6,000, required) and protein, carbohydrate and fat
 * in grams, with a live note of what the macros add up to. Save is disabled until the targets pass core's
 * `validateTargets`. A save returns to More with the Toast "Targets saved". Nothing the person typed goes
 * into an error or a log: a failed save says so in the same words whatever the reason. While a programme
 * sets the targets (`source` is "engine") Save asks first, because saving ends the programme, and only
 * Save my targets in the dialog goes on to save.
 */
export function TargetsForm({ initial }: TargetsFormProps) {
  const router = useRouter();
  const toast = useToast();
  const updateTargets = useUpdateTargets();
  const [kcal, setKcal] = useState(fieldText(initial.kcal));
  const [protein, setProtein] = useState(fieldText(initial.protein_g));
  const [carbs, setCarbs] = useState(fieldText(initial.carbs_g));
  const [fat, setFat] = useState(fieldText(initial.fat_g));
  const [isKcalTouched, setIsKcalTouched] = useState(false);
  const [hasSaveFailed, setHasSaveFailed] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const endsProgramme = initial.source === "engine";

  const input = {
    kcal: enteredNumber(kcal),
    protein_g: enteredNumber(protein),
    carbs_g: enteredNumber(carbs),
    fat_g: enteredNumber(fat),
  };
  const result = validateTargets(input);
  const kcalProblem = result.ok ? undefined : result.problems.kcal;
  // A blank field asks for a number once the person has touched it. A number out of range says so at once.
  const kcalError =
    kcalProblem === "out_of_range"
      ? DIARY_PROBLEMS.targetKcal
      : kcalProblem === "not_whole"
        ? DIARY_PROBLEMS.targetKcalWhole
        : kcalProblem === "required" && isKcalTouched
          ? DIARY_PROBLEMS.targetKcalRequired
          : undefined;
  const hasMacro = protein.trim() !== "" || carbs.trim() !== "" || fat.trim() !== "";
  const macroNote = hasMacro
    ? describeMacroTotal(Math.round(macroKcal(input.protein_g, input.fat_g, input.carbs_g)))
    : MACROS_OPTIONAL;
  const macroValue = { protein, carbs, fat };
  const setMacro = { protein: setProtein, carbs: setCarbs, fat: setFat };

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (!result.ok || updateTargets.isPending) {
      return;
    }
    if (endsProgramme) {
      setIsConfirming(true);
    } else {
      void save();
    }
  }

  async function save() {
    if (!result.ok || updateTargets.isPending) {
      return;
    }
    setHasSaveFailed(false);
    try {
      await updateTargets.mutateAsync(input);
    } catch {
      setHasSaveFailed(true);
      return;
    } finally {
      setIsConfirming(false);
    }
    toast.show({ message: TARGETS_SAVED_TOAST, tone: "success", icon: Check });
    router.push(MORE_HREF);
  }

  return (
    <>
      <Card asChild padding="none">
        <form
          aria-label={TARGETS_SCREEN.title}
          className="flex flex-col gap-4 p-5"
          onSubmit={submit}
        >
          <NumericInput
            label={TARGETS_SCREEN.calories}
            unit="kcal"
            value={kcal}
            helper={TARGET_KCAL_HELPER}
            error={kcalError}
            onBlur={() => {
              setIsKcalTouched(true);
            }}
            onChange={(event) => {
              setKcal(event.target.value);
              setIsKcalTouched(true);
            }}
          />
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {MACRO_FIELDS.map((field) => (
                <NumericInput
                  key={field.name}
                  label={field.label}
                  aria-label={describeMacroTargetField(field.label)}
                  unit="g"
                  value={macroValue[field.name]}
                  onChange={(event) => {
                    setMacro[field.name](event.target.value);
                  }}
                />
              ))}
            </div>
            <p className="text-caption tabular-nums text-text-muted">{macroNote}</p>
          </div>
          <p className="text-caption text-text-muted">
            {endsProgramme ? PROGRAM_TARGETS_SCREEN.switchNote : TARGETS_NOTE}
          </p>
          {hasSaveFailed && <Banner tone="error">{SAVE_FAILED_BANNER}</Banner>}
          <div className="flex items-center justify-end gap-4">
            <Link href={MORE_HREF} className={cancelLinkClassName}>
              {TARGETS_PAGE.cancel}
            </Link>
            <Button
              type="submit"
              disabled={!result.ok}
              loading={updateTargets.isPending}
              loadingLabel={TARGETS_PAGE.saving}
            >
              {TARGETS_SCREEN.save}
            </Button>
          </div>
        </form>
      </Card>
      <SwitchToManualDialog
        open={isConfirming}
        isSaving={updateTargets.isPending}
        onKeepProgramme={() => {
          setIsConfirming(false);
        }}
        onSaveMyTargets={() => {
          void save();
        }}
      />
    </>
  );
}
