import { createClient } from "@supabase/supabase-js";

import type { Database } from "@keylow/api-client";

/** What the fake database holds for feature requests, and how it answers the next insert. */
export const featureRequestBackend: {
  /** The bodies of the inserts, in order. */
  inserts: unknown[];
  /** The code of the database error the next inserts answer with, or undefined to accept them. */
  failWithCode: string | undefined;
  /** The message that goes with the failing code. */
  failWithMessage: string;
  /** Holds each insert until a test lets it go. */
  isHolding: boolean;
  held: (() => void)[];
} = { inserts: [], failWithCode: undefined, failWithMessage: "", isHolding: false, held: [] };

export function resetFeatureRequestBackend(): void {
  featureRequestBackend.inserts = [];
  featureRequestBackend.failWithCode = undefined;
  featureRequestBackend.failWithMessage = "";
  featureRequestBackend.isHolding = false;
  featureRequestBackend.held = [];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function answerInsert(request: Request): Promise<Response> {
  featureRequestBackend.inserts.push(await request.json());
  if (featureRequestBackend.isHolding) {
    await new Promise<void>((release) => featureRequestBackend.held.push(release));
  }
  if (featureRequestBackend.failWithCode !== undefined) {
    return json(
      {
        code: featureRequestBackend.failWithCode,
        message: featureRequestBackend.failWithMessage,
        details: null,
        hint: null,
      },
      400,
    );
  }
  return json({ id: "77777777-7777-4777-8777-777777777777" }, 201);
}

function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  if (new URL(request.url).pathname.endsWith("/feature_requests") && request.method === "POST") {
    return answerInsert(request);
  }
  return Promise.resolve(json({ message: "unexpected request" }, 404));
}

/** A real Supabase client whose network is the fake database above. */
export const featureRequestClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});
