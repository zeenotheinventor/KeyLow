"use client";

import { FoodsPartialWriteError, useCreateFood, useUpdateFood } from "@keylow/api-client";
import { FOOD_FORM, FOOD_FORM_BUTTONS } from "@keylow/core/copy";
import { customFoodInputFrom, normaliseBarcode } from "@keylow/core/foods";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type SubmitEvent } from "react";

import { DetailsCard } from "./DetailsCard";
import { FormActions } from "./FormActions";
import { formErrorsFrom } from "./formErrors";
import { formStartFrom } from "./formValues";
import { NutritionCard } from "./NutritionCard";
import { PortionsCard } from "./PortionsCard";

import type { DetailsField } from "./DetailsCard";
import type { NutrientField } from "./NutritionCard";
import type { FoodFormProps, FoodFormValues, FormErrors, PortionFormValues } from "./types";
import type { BannerProps } from "@/components/ui/Banner";

import { Banner } from "@/components/ui/Banner";

type SaveStatus = "idle" | "saving" | "saved";

/** What happened to the last save that did not finish. A partial create carries the id of the food it wrote. */
type SaveFailure = { kind: "failed" } | { kind: "partial"; foodId: string };

function describeSaveFailure(error: unknown): SaveFailure {
  return error instanceof FoodsPartialWriteError
    ? { kind: "partial", foodId: error.foodId }
    : { kind: "failed" };
}

function describeBanner(
  errors: FormErrors | null,
  failure: SaveFailure | null,
  isEditing: boolean,
): BannerProps | null {
  if (errors !== null) {
    return { tone: "error", role: "alert", children: FOOD_FORM.validationSummary };
  }
  if (failure === null) {
    return null;
  }
  if (failure.kind === "failed") {
    return { tone: "error", role: "alert", children: FOOD_FORM.saveFailed };
  }
  // The food is on the page being edited already, so there is nothing to open. Saving again is the way on.
  return isEditing
    ? { tone: "review", role: "alert", children: FOOD_FORM.changesSavedWithoutPortions }
    : {
        tone: "review",
        role: "alert",
        children: FOOD_FORM.savedWithoutPortions,
        action: { label: FOOD_FORM.editTheFood, href: `/foods/${failure.foodId}/edit` },
        actionPlacement: "below",
      };
}

export function FoodForm({ scannedBarcode, existing, copyOf }: FoodFormProps) {
  const router = useRouter();
  const createFood = useCreateFood();
  const updateFood = useUpdateFood();
  const idPrefix = useId();
  const nextPortionKey = useRef(0);

  const startingFood = existing ?? copyOf;
  const [{ values: startingValues, notGiven, isCarbsIncludingFibre }] = useState(() =>
    formStartFrom(existing, copyOf, scannedBarcode),
  );
  const [values, setValues] = useState<FoodFormValues>(startingValues);
  const [errors, setErrors] = useState<FormErrors | null>(null);
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const isEditing = existing !== undefined;
  const givenBarcode = copyOf === undefined ? scannedBarcode : (copyOf.food.barcode ?? undefined);
  // A barcode that is not a valid code stays editable, or the user could not fix the error.
  const isBarcodeLocked =
    !isEditing && givenBarcode !== undefined && normaliseBarcode(givenBarcode).ok;
  // A create that wrote the food but not its portions must not be repeated, or the food is duplicated.
  const isPartialCreate = !isEditing && saveFailure?.kind === "partial";
  const isLocked = status !== "idle" || isPartialCreate;
  const banner = describeBanner(errors, saveFailure, isEditing);

  const submitLabel = isEditing
    ? FOOD_FORM_BUTTONS.edit
    : copyOf === undefined
      ? FOOD_FORM_BUTTONS.create
      : FOOD_FORM_BUTTONS.copy;
  const cancelHref = startingFood === undefined ? "/foods" : `/foods/${startingFood.food.id}`;

  function setField(field: DetailsField | NutrientField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function changePortion(key: string, changes: Partial<PortionFormValues>) {
    setValues((current) => ({
      ...current,
      portions: current.portions.map((portion) =>
        portion.key === key ? { ...portion, ...changes } : portion,
      ),
    }));
  }

  function setDefaultPortion(key: string, isDefault: boolean) {
    setValues((current) => ({
      ...current,
      portions: current.portions.map((portion) => ({
        ...portion,
        isDefault: portion.key === key ? isDefault : false,
      })),
    }));
  }

  function addPortion() {
    nextPortionKey.current += 1;
    const portion: PortionFormValues = {
      key: `new-${String(nextPortionKey.current)}`,
      label: "",
      amount: "",
      isDefault: false,
    };
    setValues((current) => ({ ...current, portions: [...current.portions, portion] }));
  }

  function removePortion(key: string) {
    setValues((current) => ({
      ...current,
      portions: current.portions.filter((portion) => portion.key !== key),
    }));
  }

  async function save() {
    const result = customFoodInputSchema.safeParse(
      customFoodInputFrom(values, startingFood?.food.density_g_per_ml ?? null),
    );

    setSaveFailure(null);
    if (!result.success) {
      setErrors(formErrorsFrom(result.error.issues, values));
      return;
    }
    setErrors(null);

    setStatus("saving");
    try {
      if (existing === undefined) {
        const created = await createFood.mutateAsync(result.data);
        router.replace(`/foods/${created.food.id}`);
      } else {
        await updateFood.mutateAsync({ id: existing.food.id, input: result.data });
        router.replace(`/foods/${existing.food.id}`);
      }
      setStatus("saved");
    } catch (error) {
      setSaveFailure(describeSaveFailure(error));
      setStatus("idle");
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLocked) {
      void save();
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DetailsCard
        values={values}
        errors={errors ?? {}}
        isBarcodeLocked={isBarcodeLocked}
        lockedBarcodeNote={
          copyOf === undefined ? FOOD_FORM.barcodeFromEntry : FOOD_FORM.barcodeFromCopy
        }
        onChange={setField}
      />
      <NutritionCard
        basis={values.basis}
        values={values}
        errors={errors?.nutrients ?? {}}
        notGiven={notGiven}
        hasUsCarbsNote={isCarbsIncludingFibre}
        onBasisChange={(basis) => {
          setValues((current) => ({ ...current, basis }));
        }}
        onChange={setField}
      />
      <PortionsCard
        basis={values.basis}
        portions={values.portions}
        errors={errors?.portions ?? {}}
        idPrefix={idPrefix}
        onAdd={addPortion}
        onChange={changePortion}
        onDefaultChange={setDefaultPortion}
        onRemove={removePortion}
      />
      {banner !== null && <Banner {...banner} />}
      <FormActions
        submitLabel={submitLabel}
        cancelHref={cancelHref}
        isSaving={status !== "idle"}
        isSaveDisabled={isPartialCreate}
      />
    </form>
  );
}
