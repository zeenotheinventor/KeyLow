// Supabase's edge runtime provides `EdgeRuntime` as a global. Deno's own types do not know it.
declare global {
  var EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
}

// Keeps the runtime alive until the task settles, after the response has been sent. The task must
// catch its own errors, because nothing is left to answer for them.
export function runInBackground(task: Promise<unknown>): void {
  EdgeRuntime.waitUntil(task);
}
