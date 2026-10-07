import { edgeErrorSchema } from "@keylow/core/schemas";
import { FunctionsHttpError } from "@supabase/supabase-js";

import { EdgeFunctionError, RateLimitedError } from "./errors";

import type { Database } from "./database.types";
import type { FunctionInvokeOptions, SupabaseClient } from "@supabase/supabase-js";

const RATE_LIMITED_STATUS = 429;

/** The body of an error response as a typed edge error, or undefined when it is anything else. */
async function readEdgeError(response: Response) {
  try {
    // A clone, so the original response stays readable for whoever inspects the cause.
    const parsed = edgeErrorSchema.safeParse(await response.clone().json());
    return parsed.success ? parsed.data.error : undefined;
  } catch {
    return undefined;
  }
}

const parseRetryAfterHeader = (response: Response) => {
  const seconds = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
  return Number.isInteger(seconds) && seconds > 0 ? seconds : undefined;
};

/**
 * Turns a failed invocation into the most specific error available: a `RateLimitedError` for a 429,
 * an `EdgeFunctionError` when the body is a typed edge error, and a plain error otherwise.
 * supabase-js puts the `Response` of a non-2xx answer in `error.context`.
 */
async function toInvocationError(name: string, failure: unknown): Promise<Error> {
  if (failure instanceof FunctionsHttpError && failure.context instanceof Response) {
    const response = failure.context;
    const edgeError = await readEdgeError(response);

    if (response.status === RATE_LIMITED_STATUS) {
      return new RateLimitedError(
        edgeError?.message ?? `Edge function "${name}" was rate limited`,
        edgeError?.retryAfterSeconds ?? parseRetryAfterHeader(response),
        failure,
      );
    }

    if (edgeError) {
      return new EdgeFunctionError(edgeError.message, edgeError.code, response.status, failure);
    }
  }

  return new Error(`Edge function "${name}" failed`, { cause: failure });
}

export async function invokeEdgeFunction<TResponse>(
  client: SupabaseClient<Database>,
  name: string,
  body?: FunctionInvokeOptions["body"],
): Promise<TResponse> {
  const options = body === undefined ? undefined : { body };
  const response = await client.functions.invoke<TResponse>(name, options);

  if (response.error) {
    throw await toInvocationError(name, response.error);
  }

  // A 204 or a text response yields "" rather than null, so this only fires on a JSON body of literal null.
  if (response.data === null) {
    throw new Error(`Edge function "${name}" returned no data`);
  }

  return response.data;
}
