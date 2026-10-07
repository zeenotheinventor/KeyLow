// Fixed-window rate limiting over the consume_rate_limit Postgres function. That function is added
// by a later migration. This module only types the call against its contract, so nothing here may
// run against a database until the migration exists. Deferred to the functions: choosing buckets
// (per user from the verified caller, never from the request body) and limits (from env vars).
import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "./clients.ts";
import { error } from "./http.ts";

// One row of the function's `returns table (allowed, retry_after_seconds)`.
type ConsumeRateLimitRow = { allowed: boolean; retry_after_seconds: number };

function isConsumeRateLimitRow(value: unknown): value is ConsumeRateLimitRow {
  return (
    typeof value === "object" &&
    value !== null &&
    "allowed" in value &&
    typeof value.allowed === "boolean" &&
    "retry_after_seconds" in value &&
    typeof value.retry_after_seconds === "number"
  );
}

// Counts one hit against the bucket. Returns null when the hit is allowed, or the 429 response to
// send back when the bucket is full. A failing call throws, so the function answers 500 and a
// broken limiter is never mistaken for an allowance.
export async function consume(
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<Response | null> {
  // The generated database types do not know the function until its migration lands. Widening the
  // client to the untyped form lets the call compile against the contract above. Once the types
  // are regenerated, drop this line and the type guard, and call the typed client directly.
  const client: SupabaseClient = createServiceClient();
  const { data, error: rpcError } = await client
    .rpc("consume_rate_limit", { p_bucket: bucket, p_max: max, p_window_seconds: windowSeconds })
    .single();
  if (rpcError !== null) {
    throw new Error(`consume_rate_limit failed: ${rpcError.message}`);
  }
  if (!isConsumeRateLimitRow(data)) {
    throw new Error("consume_rate_limit returned an unexpected shape");
  }
  if (data.allowed) {
    return null;
  }
  return error("rate_limited", "Too many requests. Try again shortly.", {
    retryAfterSeconds: data.retry_after_seconds,
  });
}
