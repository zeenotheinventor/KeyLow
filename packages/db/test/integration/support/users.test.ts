import { createServer } from "node:http";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./users";

import type { Server } from "node:http";

// A stand-in for the auth service, so this file asks the helpers how they treat each answer of the
// admin API without creating or deleting a real user. The clients are real, only the address differs.
const fakeAuth = vi.hoisted(() => ({ url: "", deleteStatus: 404, deleteCode: "user_not_found" }));

vi.mock("./stack", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const client = () =>
    createClient(fakeAuth.url, "unused-key", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  return { adminClient: client, anonClient: client };
});

const createdUserId = "00000000-0000-4000-8000-000000000001";
let server: Server;

beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.method === "DELETE") {
      response.statusCode = fakeAuth.deleteStatus;
      response.end(
        JSON.stringify({ code: fakeAuth.deleteStatus, error_code: fakeAuth.deleteCode }),
      );
    } else if (request.url?.endsWith("/admin/users")) {
      response.end(JSON.stringify({ id: createdUserId }));
    } else {
      response.end(
        JSON.stringify({
          access_token: "token",
          refresh_token: "refresh",
          token_type: "bearer",
          expires_in: 3600,
          user: { id: createdUserId },
        }),
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  fakeAuth.url = `http://127.0.0.1:${typeof address === "object" && address !== null ? address.port : 0}`;
});

afterAll(() => {
  server.close();
});

describe("deleteCreatedTestUsers", () => {
  it("should treat a user the auth service no longer knows as already deleted", async () => {
    Object.assign(fakeAuth, { deleteStatus: 404, deleteCode: "user_not_found" });
    const user = await createTestUser("users-helper");

    await expect(deleteCreatedTestUsers()).resolves.toEqual([user.id]);
  });

  it("should still throw on any other error", async () => {
    Object.assign(fakeAuth, { deleteStatus: 500, deleteCode: "unexpected_failure" });
    await createTestUser("users-helper");

    await expect(deleteCreatedTestUsers()).rejects.toThrow("Could not delete a test user");
  });
});
