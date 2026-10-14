"use client";

import { useFoodByBarcode } from "@keylow/api-client";
import { TYPED_BARCODE_PROBLEMS } from "@keylow/core/copy";
import { normaliseBarcode } from "@keylow/core/foods";
import { iconStroke } from "@keylow/tokens";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type SubmitEvent } from "react";

import { BarcodeResult } from "./BarcodeResult";

import type { BarcodeLookupProps, BarcodeLookupRequest } from "./types";
import type { BarcodeInvalidReason } from "@keylow/core/foods";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * The panel behind the search field's barcode button. There is no camera on the web, so the
 * digits are typed. A code that is not a barcode is explained beside the field and looks nothing
 * up. A food that is found is opened.
 */
export function BarcodeLookup({ onClose }: BarcodeLookupProps) {
  const router = useRouter();
  const idPrefix = useId();
  const inputId = `${idPrefix}-digits`;
  const problemId = `${idPrefix}-problem`;
  const input = useRef<HTMLInputElement>(null);

  const [digits, setDigits] = useState("");
  const [problem, setProblem] = useState<BarcodeInvalidReason | null>(null);
  const [request, setRequest] = useState<BarcodeLookupRequest | null>(null);

  const lookup = useFoodByBarcode(request?.code ?? "", { enabled: request !== null });
  const foundFoodId =
    request !== null && lookup.result?.status === "found" ? lookup.result.food.id : undefined;
  const attempt = request?.attempt;

  useEffect(() => {
    input.current?.focus();
  }, []);

  // Each submit is its own request, so looking the same code up again opens its food again.
  useEffect(() => {
    if (foundFoodId !== undefined) {
      router.push(`/foods/${foundFoodId}`);
    }
  }, [foundFoodId, attempt, router]);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalised = normaliseBarcode(digits);
    if (!normalised.ok) {
      setProblem(normalised.reason);
      setRequest(null);
      return;
    }

    setProblem(null);
    setRequest((current) => ({ code: normalised.code, attempt: (current?.attempt ?? 0) + 1 }));
  }

  return (
    <Card asChild className="flex flex-col gap-3">
      <section aria-label="Barcode lookup">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Close barcode lookup"
          onClick={onClose}
          className="absolute right-2 top-2 min-w-0 rounded-small text-text-secondary [&_svg]:size-[18px]"
        >
          <X aria-hidden strokeWidth={iconStroke} />
        </Button>
        <form
          noValidate
          onSubmit={handleSubmit}
          className="grid grid-cols-1 items-end gap-2 pr-8 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={inputId} className="text-caption text-text-secondary">
              Barcode number
            </label>
            <Input
              ref={input}
              id={inputId}
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 5000159484695"
              className="tracking-[0.02em]"
              value={digits}
              onChange={(event) => {
                setDigits(event.target.value);
              }}
              aria-invalid={problem !== null}
              aria-describedby={problem === null ? undefined : problemId}
            />
          </div>
          <Button
            type="submit"
            className="px-5"
            loading={request !== null && lookup.isLoading}
            loadingLabel="Looking up"
          >
            Look up
          </Button>
        </form>
        {problem !== null && (
          <span id={problemId} role="alert" className="-mt-2 text-caption text-danger">
            {TYPED_BARCODE_PROBLEMS[problem]}
          </span>
        )}
        {request !== null && <BarcodeResult {...lookup} />}
      </section>
    </Card>
  );
}
