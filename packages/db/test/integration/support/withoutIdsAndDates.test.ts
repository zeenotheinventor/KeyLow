import { describe, expect, it } from "vitest";

import { withoutIdsAndDates } from "./withoutIdsAndDates";

const idWithTheDigits = "beff9bb8-2140-4550-8210-2000a1b2c3d4";
const timestampWithTheDigits = "2026-11-06T10:21:40.550210+00:00";

describe("withoutIdsAndDates", () => {
  it("drops an id, a list of ids, a date and a timestamp, so their digits cannot match a figure", () => {
    const row = {
      id: idWithTheDigits,
      target_id: idWithTheDigits,
      target_ids: [idWithTheDigits, idWithTheDigits],
      target_local_date: "2026-11-06",
      created_at: timestampWithTheDigits,
      turn_seq: 1,
      tool: "update_targets",
    };

    const written = withoutIdsAndDates([row]);

    for (const figure of ["550", "210", "2140", "2000", "8210"]) {
      expect(written).not.toContain(figure);
    }
    expect(written).toContain("update_targets");
  });

  it("keeps a figure that is stored as a plain value, so a real one still shows", () => {
    expect(withoutIdsAndDates([{ id: idWithTheDigits, kcal: 2140 }])).toContain("2140");
    expect(withoutIdsAndDates([{ id: idWithTheDigits, tool: "550 kcal" }])).toContain("550");
  });

  it("keeps a figure that sits in a string that is not an id or a date", () => {
    expect(withoutIdsAndDates([{ note: "2140" }])).toContain("2140");
    expect(withoutIdsAndDates([{ note: "on 2026-11-06 you ate 550 kcal" }])).toContain("550");
    expect(withoutIdsAndDates([{ note: "you ate 550 kcal on 2026-11-06" }])).toContain("550");
    expect(withoutIdsAndDates([{ note: `${idWithTheDigits} and 2140` }])).toContain("2140");
  });
});
