import { describe, expect, it } from "vitest";

import { confirmationIdIn } from "../fixtures/redTeamEdits.ts";

const ID = "b3000000-0000-4000-8000-000000000001";

describe("confirmationIdIn", () => {
  it("should read the id from the text the model reads, where the quotes are escaped", () => {
    const body = `{"result":{"content":[{"type":"text","text":"{\\"confirmation_id\\":\\"${ID}\\"}"}]}}`;

    expect(confirmationIdIn(body)).toBe(ID);
  });

  it("should read the id from the structured content", () => {
    expect(confirmationIdIn(`{"structuredContent":{"confirmationId":"${ID}"}}`)).toBe(ID);
  });

  it("should throw when the answer carries no id, so a changed format cannot turn the copied-id call into the first one", () => {
    expect(() => confirmationIdIn('{"structuredContent":{"status":"ok"}}')).toThrow(/no id/);
  });
});
