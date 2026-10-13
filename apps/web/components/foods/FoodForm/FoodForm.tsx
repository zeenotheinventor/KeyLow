"use client";

import { FoodsPartialWriteError, useCreateFood, useUpdateFood } from "@keylow/api-client";
import { normaliseBarcode } from "@keylow/core/foods";
import { customFoodInputSchema, nutrientBasisSchema } from "@keylow/core/schemas";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type SubmitEvent } from "react";

import { fieldErrorsFrom } from "./fieldErrors";
import { amountUnit, foodFormValuesFrom, foodInputFrom } from "./formValues";
import { PortionRow } from "./PortionRow";
import { TextField } from "./TextField";

import type { FieldErrors, FoodFormProps, FoodFormValues, PortionFormValues } from "./types";
import type { NutrientBasis } from "@keylow/core/schemas";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type SaveStatus = "idle" | "saving" | "saved";
type SaveFailure = { message: string; editFoodId?: string };

const BASIS_LABELS: Record<NutrientBasis, string> = {
  per_100g: "Per 100 g",
  per_100ml: "Per 100 ml",
};

type NutrientField = {
  field: "kcal" | "protein" | "fat" | "carbs" | "fibre";
  label: string;
  errorKey: string;
};

const NUTRIENT_FIELDS: NutrientField[] = [
  { field: "kcal", label: "Energy (kcal)", errorKey: "kcal" },
  { field: "protein", label: "Protein (g)", errorKey: "protein_g" },
  { field: "fat", label: "Fat (g)", errorKey: "fat_g" },
  { field: "carbs", label: "Carbohydrate (g)", errorKey: "carbs_g" },
  { field: "fibre", label: "Fibre (g, optional)", errorKey: "fibre_g" },
];

const SELECT_CLASS_NAME =
  "flex h-11 w-full rounded-md border border-border bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring md:h-9 md:text-sm";

const SECTION_HEADING_CLASS_NAME = "font-semibold leading-none tracking-tight";

const FIELD_ERRORS_SUMMARY = "Check the fields marked below and try again.";

function describeSaveFailure(error: unknown, isEditing: boolean): SaveFailure {
  if (error instanceof FoodsPartialWriteError) {
    return isEditing
      ? {
          message:
            "Your changes to the food were saved, but its portions were not. Try saving again.",
        }
      : {
          message:
            "Your food was saved, but its portions were not. Open the food to add them again.",
          editFoodId: error.foodId,
        };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: "The food could not be saved. Please try again." };
}

export function FoodForm({ scannedBarcode, existing, copyOf }: FoodFormProps) {
  const router = useRouter();
  const createFood = useCreateFood();
  const updateFood = useUpdateFood();
  const idPrefix = useId();
  const nextPortionKey = useRef(0);

  const startingFood = existing ?? copyOf;
  // A US total carbohydrate includes fibre, so it is never copied. The user enters it without fibre.
  const isCarbsIncludingFibre = copyOf?.food.quality.carbs_convention === "us_total";
  const [values, setValues] = useState<FoodFormValues>(() => {
    const startingValues = foodFormValuesFrom(startingFood, scannedBarcode);
    return isCarbsIncludingFibre ? { ...startingValues, carbs: "" } : startingValues;
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const isEditing = existing !== undefined;
  const givenBarcode = copyOf === undefined ? scannedBarcode : (copyOf.food.barcode ?? undefined);
  // A barcode that is not a valid code stays editable, or the user could not fix the error.
  const isBarcodeLocked =
    !isEditing && givenBarcode !== undefined && normaliseBarcode(givenBarcode).ok;
  // A create that wrote the food but not its portions must not be repeated, or the food is duplicated.
  const isLocked = status !== "idle" || saveFailure?.editFoodId !== undefined;
  const lockedBarcodeHint =
    copyOf === undefined
      ? "This barcode came from the scan and cannot be changed here"
      : "This barcode belongs to the food you are copying and cannot be changed here";
  const unit = amountUnit(values.basis);
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  const fieldId = (name: string) => `${idPrefix}-${name}`;

  function setField(field: Exclude<keyof FoodFormValues, "portions" | "basis">, value: string) {
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
      foodInputFrom(values, startingFood?.food.density_g_per_ml ?? null),
    );

    setSaveFailure(null);
    if (!result.success) {
      setFieldErrors(fieldErrorsFrom(result.error.issues, values.basis));
      return;
    }
    setFieldErrors({});

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
      setSaveFailure(describeSaveFailure(error, isEditing));
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
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 p-4 md:p-6">
        <h2 className={SECTION_HEADING_CLASS_NAME}>Details</h2>
        <TextField
          id={fieldId("name")}
          label="Name"
          autoComplete="off"
          value={values.name}
          onChange={(event) => {
            setField("name", event.target.value);
          }}
          error={fieldErrors["name"]}
        />
        <TextField
          id={fieldId("brand")}
          label="Brand (optional)"
          autoComplete="off"
          value={values.brand}
          onChange={(event) => {
            setField("brand", event.target.value);
          }}
          error={fieldErrors["brand"]}
        />
        <TextField
          id={fieldId("barcode")}
          label="Barcode (optional)"
          inputMode="numeric"
          autoComplete="off"
          value={values.barcode}
          readOnly={isBarcodeLocked}
          hint={isBarcodeLocked ? lockedBarcodeHint : undefined}
          onChange={(event) => {
            setField("barcode", event.target.value);
          }}
          error={fieldErrors["barcode"]}
        />
      </Card>

      <Card className="flex flex-col gap-4 p-4 md:p-6">
        <h2 className={SECTION_HEADING_CLASS_NAME}>Nutrition</h2>
        {isCarbsIncludingFibre && (
          <p className="text-sm text-text-muted">
            This product&apos;s carbohydrate included fibre. Enter the carbohydrate without fibre.
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fieldId("basis")} className="text-sm font-medium">
            Basis
          </label>
          <select
            id={fieldId("basis")}
            className={SELECT_CLASS_NAME}
            value={values.basis}
            onChange={(event) => {
              const basis = nutrientBasisSchema.safeParse(event.target.value);
              if (basis.success) {
                setValues((current) => ({ ...current, basis: basis.data }));
              }
            }}
          >
            {nutrientBasisSchema.options.map((basis) => (
              <option key={basis} value={basis}>
                {BASIS_LABELS[basis]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {NUTRIENT_FIELDS.map(({ field, label, errorKey }) => (
            <TextField
              key={field}
              id={fieldId(field)}
              label={label}
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={values[field]}
              onChange={(event) => {
                setField(field, event.target.value);
              }}
              error={fieldErrors[errorKey]}
            />
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-4 md:p-6">
        <h2 className={SECTION_HEADING_CLASS_NAME}>Portions</h2>
        {values.portions.length > 0 && (
          <ul className="flex flex-col gap-3">
            {values.portions.map((portion, index) => (
              <PortionRow
                key={portion.key}
                idPrefix={fieldId(portion.key)}
                index={index}
                portion={portion}
                basis={values.basis}
                labelError={fieldErrors[`portions.${String(index)}.label`]}
                amountError={fieldErrors[`portions.${String(index)}.amount`]}
                onLabelChange={(label) => {
                  changePortion(portion.key, { label });
                }}
                onAmountChange={(amount) => {
                  changePortion(portion.key, { amount });
                }}
                onDefaultChange={(isDefault) => {
                  setDefaultPortion(portion.key, isDefault);
                }}
                onRemove={() => {
                  removePortion(portion.key);
                }}
              />
            ))}
          </ul>
        )}
        {fieldErrors["portions"] !== undefined && (
          <p className="text-sm text-danger">{fieldErrors["portions"]}</p>
        )}
        <p className="text-sm text-text-muted">{`Each amount is in ${unit}, to match the basis.`}</p>
        <Button
          type="button"
          variant="outline"
          className="h-11 self-start md:h-9"
          onClick={addPortion}
        >
          Add portion
        </Button>
      </Card>

      {(hasFieldErrors || saveFailure !== null) && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-md border border-danger p-3 text-sm text-danger"
        >
          {hasFieldErrors && <p>{FIELD_ERRORS_SUMMARY}</p>}
          {saveFailure !== null && <p>{saveFailure.message}</p>}
          {saveFailure?.editFoodId !== undefined && (
            <Link href={`/foods/${saveFailure.editFoodId}/edit`} className="font-medium underline">
              Edit the food
            </Link>
          )}
        </div>
      )}

      <Button type="submit" disabled={isLocked} className="h-11 md:h-9">
        {status === "idle" ? "Save food" : "Saving"}
      </Button>
    </form>
  );
}
