import { describe, expect, it } from "vitest";

import { openLocalHttpSession } from "../../src/httpSession.ts";

describe("openLocalHttpSession against the local stack", () => {
  it("should give the eval user the assistant consent, so the first turn is not refused", async () => {
    const session = await openLocalHttpSession();
    try {
      const profiles = await session.database.countRows({ table: "profiles", where: {} });
      const withoutConsent = await session.database.countRows({
        table: "profiles",
        where: { assistant_consent_at: null },
      });

      expect(profiles).toBe(1);
      expect(withoutConsent).toBe(0);
    } finally {
      await session.close();
    }
  });
});
