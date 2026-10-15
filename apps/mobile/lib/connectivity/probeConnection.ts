import { PROBE_TIMEOUT_MS } from "./constants";

type ProbeFetch = (url: string, init: { method: "HEAD"; signal: AbortSignal }) => Promise<unknown>;

/**
 * Asks the server's public health address whether it can be reached. Any answer, even an error status,
 * means the phone is online, because the request got there and back. A request that fails to connect, or
 * that gets no answer within `PROBE_TIMEOUT_MS`, means it is not.
 */
export async function probeConnection(
  serverUrl: string,
  fetchFunction: ProbeFetch = fetch,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, PROBE_TIMEOUT_MS);

  try {
    await fetchFunction(`${serverUrl}/auth/v1/health`, {
      method: "HEAD",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
