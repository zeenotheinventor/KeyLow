// Fixed-window rate limiting over the consume_rate_limit Postgres function. A function chooses its
// buckets (per user from the verified caller, never from the request body) and its limits (from
// env vars, read with `readLimit`).
import { createServiceClient } from "./clients.ts";
import { error } from "./http.ts";

// A limit comes from an env var so it can be retuned without a migration. A value that is set but
// is not a positive whole number is a configuration error, so it throws instead of silently
// falling back, and the caller answers 500.
export function readLimit(name: string, defaultValue: number): number {
  const raw = Deno.env.get(name);
  if (raw === undefined || raw === "") {
    return defaultValue;
  }
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`${name} must be a positive whole number, got "${raw}"`);
  }
  return limit;
}

// Counts one hit against the bucket. Returns null when the hit is allowed, or the 429 response to
// send back when the bucket is full. A failing call throws, so the function answers 500 and a
// broken limiter is never mistaken for an allowance.
export async function consume(
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<Response | null> {
  const { data, error: rpcError } = await createServiceClient()
    .rpc("consume_rate_limit", { p_bucket: bucket, p_max: max, p_window_seconds: windowSeconds })
    .single();
  if (rpcError !== null) {
    throw new Error(`consume_rate_limit failed: ${rpcError.message}`);
  }
  if (data.allowed) {
    return null;
  }
  return error("rate_limited", "Too many requests. Try again shortly.", {
    retryAfterSeconds: data.retry_after_seconds,
  });
}
