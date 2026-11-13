import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getFunctionsUrl } from "@/lib/supabase/env";

describe("getFunctionsUrl", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should put the Edge Functions under the project's address", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");

    expect(getFunctionsUrl()).toBe("https://project.supabase.co/functions/v1");
  });

  it("should not double the slash when the project's address ends in one, as the phone does", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co///");

    expect(getFunctionsUrl()).toBe("https://project.supabase.co/functions/v1");
  });
});
