import type { EdgeErrorCode } from "@keylow/core/schemas";

/** An Edge Function refused the request because a rate limit was reached (HTTP 429). */
export class RateLimitedError extends Error {
  readonly retryAfterSeconds: number | undefined;

  constructor(message: string, retryAfterSeconds: number | undefined, cause: unknown) {
    super(message, { cause });
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** An Edge Function answered with a typed error body (see `edgeErrorSchema` in core). */
export class EdgeFunctionError extends Error {
  readonly code: EdgeErrorCode;
  readonly status: number;

  constructor(message: string, code: EdgeErrorCode, status: number, cause: unknown) {
    super(message, { cause });
    this.name = "EdgeFunctionError";
    this.code = code;
    this.status = status;
  }
}

/** Open Food Facts has no product with this barcode, so there is nothing to turn into a food. */
export class OffProductNotFoundError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`Open Food Facts has no product with the barcode ${code}`);
    this.name = "OffProductNotFoundError";
    this.code = code;
  }
}
