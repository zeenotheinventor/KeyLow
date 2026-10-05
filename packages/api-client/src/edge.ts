import type { Database } from "./database.types";
import type { FunctionInvokeOptions, SupabaseClient } from "@supabase/supabase-js";

export async function invokeEdgeFunction<TResponse>(
  client: SupabaseClient<Database>,
  name: string,
  body?: FunctionInvokeOptions["body"],
): Promise<TResponse> {
  const options = body === undefined ? undefined : { body };
  const response = await client.functions.invoke<TResponse>(name, options);

  if (response.error) {
    throw new Error(`Edge function "${name}" failed`, { cause: response.error });
  }

  // A 204 or a text response yields "" rather than null, so this only fires on a JSON body of literal null.
  if (response.data === null) {
    throw new Error(`Edge function "${name}" returned no data`);
  }

  return response.data;
}
