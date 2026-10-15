import { describe, expect, it } from "vitest";

import { parseSupabaseStatus } from "../../scripts/supabaseStatus";

// The shape of `supabase status --output json`, with placeholder secrets.
const recordedStatus = {
  ANON_KEY: "anon-key-value",
  API_URL: "http://127.0.0.1:54321",
  DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  FUNCTIONS_URL: "http://127.0.0.1:54321/functions/v1",
  JWT_SECRET: "jwt-secret-value",
  SERVICE_ROLE_KEY: "service-role-key-value",
  STUDIO_URL: "http://127.0.0.1:54323",
};

describe("parseSupabaseStatus", () => {
  it("should read the API URL and both keys from the status JSON", () => {
    expect(parseSupabaseStatus(JSON.stringify(recordedStatus, null, 2))).toEqual({
      apiUrl: "http://127.0.0.1:54321",
      anonKey: "anon-key-value",
      serviceRoleKey: "service-role-key-value",
    });
  });

  it("should skip notices that the CLI prints before the JSON document", () => {
    const output = `Stopped services: [supabase_imgproxy_keylow]\n${JSON.stringify(recordedStatus, null, 2)}\n`;

    expect(parseSupabaseStatus(output).apiUrl).toBe("http://127.0.0.1:54321");
  });

  it.each(["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY"])(
    "should refuse a status without %s",
    (missingKey) => {
      const incomplete = Object.fromEntries(
        Object.entries(recordedStatus).filter(([key]) => key !== missingKey),
      );

      expect(() => parseSupabaseStatus(JSON.stringify(incomplete))).toThrow(
        "API_URL, ANON_KEY or SERVICE_ROLE_KEY is missing from the `supabase status` output",
      );
    },
  );

  it("should refuse a key that is not a string", () => {
    expect(() => parseSupabaseStatus(JSON.stringify({ ...recordedStatus, ANON_KEY: 42 }))).toThrow(
      "is missing from the `supabase status` output",
    );
  });

  it("should refuse output without a JSON document", () => {
    expect(() => parseSupabaseStatus("The stack is not running")).toThrow("has no JSON document");
  });

  it("should refuse malformed JSON", () => {
    expect(() => parseSupabaseStatus('{ "API_URL": ')).toThrow("is not valid JSON");
  });
});
