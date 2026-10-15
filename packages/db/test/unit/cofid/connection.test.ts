import { describe, expect, it, vi } from "vitest";

import { resolveConnection } from "../../../scripts/cofid/connection";

const localStatus = {
  apiUrl: "http://127.0.0.1:54321",
  anonKey: "local-anon-key",
  serviceRoleKey: "local-key",
};

describe("resolveConnection", () => {
  it("should use SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY when both are set", async () => {
    const readLocalStatus = vi.fn(() => Promise.resolve(localStatus));

    const connection = await resolveConnection(
      { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "remote-key" },
      readLocalStatus,
    );

    expect(connection).toEqual({
      url: "https://example.supabase.co",
      serviceRoleKey: "remote-key",
    });
    expect(readLocalStatus).not.toHaveBeenCalled();
  });

  it("should default to the local stack that `supabase status` reports when neither is set", async () => {
    const connection = await resolveConnection({}, () => Promise.resolve(localStatus));

    expect(connection).toEqual({ url: "http://127.0.0.1:54321", serviceRoleKey: "local-key" });
  });

  it("should treat empty variables as not set", async () => {
    const connection = await resolveConnection(
      { SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" },
      () => Promise.resolve(localStatus),
    );

    expect(connection.url).toBe("http://127.0.0.1:54321");
  });

  it.each([
    [{ SUPABASE_URL: "https://example.supabase.co" }, "SUPABASE_SERVICE_ROLE_KEY"],
    [{ SUPABASE_SERVICE_ROLE_KEY: "remote-key" }, "SUPABASE_URL"],
  ])("should refuse when only one of the two is set (%j)", async (env, missing) => {
    await expect(resolveConnection(env, () => Promise.resolve(localStatus))).rejects.toThrow(
      missing,
    );
  });
});
