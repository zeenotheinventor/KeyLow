import { describe, expect, it } from "vitest";

import { deleteAccountRequestSchema, deleteAccountResponseSchema } from "../../src/schemas";

describe("deleteAccountRequestSchema", () => {
  it("should accept an empty body", () => {
    expect(deleteAccountRequestSchema.parse({})).toEqual({});
  });

  it.each([
    { userId: "6f1b5e1c-3c43-4f5b-9a55-0d6f1d8f2f11" },
    { user_id: "6f1b5e1c-3c43-4f5b-9a55-0d6f1d8f2f11" },
    { id: "6f1b5e1c-3c43-4f5b-9a55-0d6f1d8f2f11" },
    { anything: true },
  ])("should reject a body that names a field (%j)", (body) => {
    expect(deleteAccountRequestSchema.safeParse(body).success).toBe(false);
  });

  it.each([null, "delete", 3, []])("should reject a body that is not an object (%j)", (body) => {
    expect(deleteAccountRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe("deleteAccountResponseSchema", () => {
  it("should accept deleted: true", () => {
    expect(deleteAccountResponseSchema.parse({ deleted: true })).toEqual({ deleted: true });
  });

  it("should reject deleted: false", () => {
    expect(deleteAccountResponseSchema.safeParse({ deleted: false }).success).toBe(false);
  });

  it("should reject a body with no deleted flag", () => {
    expect(deleteAccountResponseSchema.safeParse({}).success).toBe(false);
  });

  it("should reject extra keys", () => {
    expect(deleteAccountResponseSchema.safeParse({ deleted: true, userId: "x" }).success).toBe(
      false,
    );
  });
});
