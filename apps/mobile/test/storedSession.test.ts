import { authStorageKey, createStoredUserIdReader } from "../lib/storedSession";

describe("authStorageKey", () => {
  it("should be the key supabase-js uses for a hosted project", () => {
    expect(authStorageKey("https://abcdefgh.supabase.co")).toBe("sb-abcdefgh-auth-token");
  });

  it("should be the key supabase-js uses for a local address", () => {
    expect(authStorageKey("http://192.168.1.10:54321")).toBe("sb-192-auth-token");
  });
});

describe("the reader of the stored user id", () => {
  const readFrom = (stored: string | null) =>
    createStoredUserIdReader({ getItem: () => Promise.resolve(stored) }, "any-key");

  it("should read the user id of the stored session", async () => {
    const stored = JSON.stringify({ access_token: "token", user: { id: "user-id" } });

    await expect(readFrom(stored)()).resolves.toBe("user-id");
  });

  it("should ask the storage for the key it was given", async () => {
    const getItem = jest.fn(() => Promise.resolve(null));

    await createStoredUserIdReader({ getItem }, "the-key")();

    expect(getItem).toHaveBeenCalledWith("the-key");
  });

  it.each([
    ["nothing is stored", null],
    ["the stored text is not JSON", "{broken"],
    ["the stored value is not an object", "42"],
    ["the stored session has no user", JSON.stringify({ access_token: "token" })],
    ["the user has no id", JSON.stringify({ user: {} })],
    ["the user id is not text", JSON.stringify({ user: { id: 7 } })],
  ])("should find no one when %s", async (_name, stored) => {
    await expect(readFrom(stored)()).resolves.toBeNull();
  });
});
