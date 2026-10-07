import { inject } from "vitest";

export type FunctionResponse = {
  status: number;
  headers: Headers;
  body: unknown;
};

/**
 * Calls a served Edge Function the way a client does. Pass the user's JWT as `accessToken`, or
 * leave it out for an anonymous call. The body is sent as JSON.
 */
export async function callFunction(
  name: string,
  options: { accessToken?: string; body?: unknown },
): Promise<FunctionResponse> {
  const { apiUrl, anonKey } = inject("stack");
  const response = await fetch(`${apiUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
      ...(options.accessToken === undefined
        ? {}
        : { Authorization: `Bearer ${options.accessToken}` }),
    },
    body: JSON.stringify(options.body ?? {}),
    signal: AbortSignal.timeout(20_000),
  });
  const body: unknown = await response.json();
  return { status: response.status, headers: response.headers, body };
}
