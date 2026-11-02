import { describe, expect, it } from "vitest";

import { assertLocalStack, createFixtureUser } from "../src/fixtureUser.ts";

const stackAt = (apiUrl: string) => ({
  apiUrl,
  anonKey: "anon-key-for-tests",
  serviceRoleKey: "service-role-key-for-tests",
});

describe("assertLocalStack", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321", "http://[::1]:54321"])(
    "should accept %s",
    (apiUrl) => {
      expect(() => {
        assertLocalStack(stackAt(apiUrl));
      }).not.toThrow();
    },
  );

  it.each([
    "https://abcdefghijklmnop.supabase.co",
    "http://localhost.example.com:54321",
    "http://127.0.0.1.example.com",
    "http://10.0.0.5:54321",
    "http://192.168.1.20:54321",
    "not a url",
    "",
  ])("should refuse %j", (apiUrl) => {
    expect(() => {
      assertLocalStack(stackAt(apiUrl));
    }).toThrow("The eval user is only created on a local stack (localhost, 127.0.0.1 or ::1)");
  });

  it("should not put the address or a key in its message", () => {
    const stack = stackAt("https://abcdefghijklmnop.supabase.co");

    expect(() => {
      assertLocalStack(stack);
    }).toThrow(/^(?!.*(abcdefghijklmnop|for-tests))/s);
  });
});

describe("createFixtureUser", () => {
  it("should refuse a stack that is not local before it makes any request", async () => {
    await expect(
      createFixtureUser(stackAt("https://abcdefghijklmnop.supabase.co")),
    ).rejects.toThrow("only created on a local stack");
  });
});
