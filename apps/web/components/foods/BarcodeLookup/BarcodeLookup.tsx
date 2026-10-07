"use client";

import { normaliseBarcode } from "@keylow/core/foods";
import { useId, useState, type SubmitEvent } from "react";

import { BarcodeResult } from "./BarcodeResult";
import { BARCODE_MESSAGES } from "../barcodeMessages";

import type { BarcodeLookupRequest } from "./types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function BarcodeLookup() {
  const idPrefix = useId();
  const inputId = `${idPrefix}-digits`;
  const errorId = `${idPrefix}-error`;

  const [digits, setDigits] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [request, setRequest] = useState<BarcodeLookupRequest | null>(null);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalised = normaliseBarcode(digits);
    if (!normalised.ok) {
      setErrorMessage(BARCODE_MESSAGES[normalised.reason]);
      setRequest(null);
      return;
    }

    setErrorMessage(null);
    // Each submit is its own request, so looking the same code up again opens its food again.
    setRequest((current) => ({ code: normalised.code, attempt: (current?.attempt ?? 0) + 1 }));
  }

  return (
    <Card className="flex flex-col gap-4 p-4 md:p-6">
      <h2 className="font-semibold leading-none tracking-tight">Barcode</h2>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-sm font-medium">
            Barcode number
          </label>
          <Input
            id={inputId}
            className="h-11 md:h-9"
            inputMode="numeric"
            autoComplete="off"
            value={digits}
            onChange={(event) => {
              setDigits(event.target.value);
            }}
            aria-invalid={errorMessage !== null}
            aria-describedby={errorMessage === null ? undefined : errorId}
          />
          {errorMessage !== null && (
            <p id={errorId} className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}
        </div>
        <Button type="submit" className="h-11 self-start md:h-9">
          Look up
        </Button>
      </form>
      {request !== null && <BarcodeResult key={request.attempt} code={request.code} />}
    </Card>
  );
}
