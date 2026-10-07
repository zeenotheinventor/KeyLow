import type { ScanOutcome } from "./types";
import type { UseFoodByBarcodeReturn } from "@keylow/api-client";

/** Reads what the lookup of the accepted scan has reported into what the screen should show. */
export function toScanOutcome({ result, error }: UseFoodByBarcodeReturn): ScanOutcome {
  if (error !== null) {
    return error.kind === "rate_limited"
      ? {
          status: "rate_limited",
          ...(error.retryAfterSeconds === undefined
            ? {}
            : { retryAfterSeconds: error.retryAfterSeconds }),
        }
      : { status: "failed" };
  }

  switch (result?.status) {
    case "found":
      return { status: "opening_food" };
    case "not_found":
      return { status: "not_found", code: result.code };
    case "invalid":
      return { status: "invalid", reason: result.reason };
    case undefined:
      return { status: "looking_up" };
  }
}
