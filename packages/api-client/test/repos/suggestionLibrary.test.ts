import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { listSuggestionLibrary } from "../../src/repos/suggestionLibrary";
import { createTestClient } from "../createTestClient";
import {
  RECOGNISABLE_LIBRARY_NAME,
  RECOGNISABLE_LIBRARY_WEIGHT,
  installLibraryFake,
  libraryRow,
} from "../support/suggestionLibrary";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const rejectionOf = async (call: Promise<unknown>): Promise<Error | null> => {
  try {
    await call;
  } catch (error) {
    return error instanceof Error ? error : new Error("(not an Error)");
  }
  return null;
};

const textOf = (error: Error | null) =>
  JSON.stringify({ message: error?.message, name: error?.name, cause: error?.cause });

/** The pages the library asked for, as `[offset, limit]`. */
const pagesAsked = (reads: URL[]) =>
  reads.map((url) => [url.searchParams.get("offset"), url.searchParams.get("limit")]);

describe("listSuggestionLibrary", () => {
  it("should give each exercise as the suggestion reads it: id, name, equipment, mechanic and its muscle map", async () => {
    const row = libraryRow({
      name: "Cable lateral raise",
      equipment: "cable",
      mechanic: "isolation",
      exercise_muscles: [
        { muscle_id: "delt_side", role: "primary", weight: 1 },
        { muscle_id: "traps_upper", role: "secondary", weight: 0.5 },
      ],
    });
    installLibraryFake(server, [row]);

    const library = await listSuggestionLibrary(createTestClient(), { equipment: ["cable"] });

    expect(library).toEqual([
      {
        id: row.id,
        name: "Cable lateral raise",
        equipment: "cable",
        mechanic: "isolation",
        muscles: [
          { muscle_id: "delt_side", role: "primary", weight: 1 },
          { muscle_id: "traps_upper", role: "secondary", weight: 0.5 },
        ],
      },
    ]);
  });

  it("should select only the columns the suggestion reads, with the muscle map embedded", async () => {
    const fake = installLibraryFake(server);

    await listSuggestionLibrary(createTestClient(), { equipment: ["cable"] });

    expect(fake.reads[0]?.searchParams.get("select")).toBe(
      "id,name,equipment,mechanic,exercise_muscles(muscle_id,role,weight)",
    );
  });

  it("should read live exercises only, whose equipment is in the list asked for", async () => {
    const fake = installLibraryFake(server);

    await listSuggestionLibrary(createTestClient(), { equipment: ["dumbbell", "cable"] });

    const url = fake.reads[0];
    expect(url?.searchParams.get("deleted_at")).toBe("is.null");
    expect(url?.searchParams.get("equipment")).toBe("in.(dumbbell,cable)");
  });

  it("should never give an exercise of equipment that was not asked for", async () => {
    installLibraryFake(server, [
      libraryRow({ equipment: "dumbbell" }),
      libraryRow({ equipment: "barbell" }),
      libraryRow({ equipment: "dumbbell" }),
    ]);

    const library = await listSuggestionLibrary(createTestClient(), { equipment: ["dumbbell"] });

    expect(library).toHaveLength(2);
    expect(library.map((exercise) => exercise.equipment)).toEqual(["dumbbell", "dumbbell"]);
  });

  it("should order by id, so a page boundary never repeats or skips an exercise", async () => {
    const fake = installLibraryFake(server);

    await listSuggestionLibrary(createTestClient(), { equipment: ["cable"] });

    expect(fake.reads[0]?.searchParams.get("order")).toBe("id.asc");
  });

  it("should answer with no exercises and no request when no equipment is asked for", async () => {
    const fake = installLibraryFake(server, [libraryRow()]);

    const library = await listSuggestionLibrary(createTestClient(), { equipment: [] });

    expect(library).toEqual([]);
    expect(fake.reads).toEqual([]);
  });

  describe("paging", () => {
    it("should read three pages of 1,000 rows from offset 0, 1000 and 2000 when the third is short, and join them", async () => {
      const fake = installLibraryFake(
        server,
        Array.from({ length: 2300 }, () => libraryRow()),
      );

      const library = await listSuggestionLibrary(createTestClient(), { equipment: ["dumbbell"] });

      expect(library).toHaveLength(2300);
      expect(pagesAsked(fake.reads)).toEqual([
        ["0", "1000"],
        ["1000", "1000"],
        ["2000", "1000"],
      ]);
    });

    it("should make one request when the first page is short", async () => {
      const fake = installLibraryFake(
        server,
        Array.from({ length: 999 }, () => libraryRow()),
      );

      await listSuggestionLibrary(createTestClient(), { equipment: ["dumbbell"] });

      expect(pagesAsked(fake.reads)).toEqual([["0", "1000"]]);
    });

    it("should ask for one more page when a page is exactly full, and stop at the empty one", async () => {
      const fake = installLibraryFake(
        server,
        Array.from({ length: 1000 }, () => libraryRow()),
      );

      const library = await listSuggestionLibrary(createTestClient(), { equipment: ["dumbbell"] });

      expect(library).toHaveLength(1000);
      expect(pagesAsked(fake.reads)).toEqual([
        ["0", "1000"],
        ["1000", "1000"],
      ]);
    });
  });

  describe("errors", () => {
    it("should name the action and the database code only, with no exercise name or weight in the message, name or cause", async () => {
      const fake = installLibraryFake(server, [libraryRow()]);
      fake.failReadsWith("42501");

      const error = await rejectionOf(
        listSuggestionLibrary(createTestClient(), { equipment: ["dumbbell"] }),
      );

      expect(error?.message).toBe("Could not load the exercise library (42501)");
      expect(error?.cause).toEqual({ code: "42501" });
      expect(textOf(error)).not.toContain(RECOGNISABLE_LIBRARY_NAME);
      expect(textOf(error)).not.toContain(String(RECOGNISABLE_LIBRARY_WEIGHT));
    });

    it("should name the failing row's id and the field paths only when a row does not parse", async () => {
      const bad = libraryRow({ name: RECOGNISABLE_LIBRARY_NAME, equipment: "trampoline" });
      installLibraryFake(server, [{ ...bad, equipment: "dumbbell", mechanic: "unheard-of" }]);

      const error = await rejectionOf(
        listSuggestionLibrary(createTestClient(), { equipment: ["dumbbell"] }),
      );

      expect(error?.message).toContain(bad.id);
      expect(error?.message).toContain("mechanic");
      expect(textOf(error)).not.toContain(RECOGNISABLE_LIBRARY_NAME);
      expect(textOf(error)).not.toContain("unheard-of");
    });
  });
});
