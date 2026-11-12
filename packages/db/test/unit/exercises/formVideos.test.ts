import { describe, expect, it } from "vitest";

import {
  checkFormVideo,
  fillFormVideos,
  formatFormVideos,
  oembedUrl,
  parseFormVideos,
  renderFormVideosMigration,
} from "../../../scripts/exercises/formVideos";

import type { FormVideo } from "../../../scripts/exercises/formVideos";

const squat: FormVideo = {
  sourceRef: "Barbell_Full_Squat",
  youtubeVideoId: "aaaaaaaaaaa",
  title: "How to Squat",
  channel: "Coach One",
  verifiedOn: "2026-11-12",
};
const press: FormVideo = {
  sourceRef: "Barbell_Shoulder_Press",
  youtubeVideoId: "bbbbbbbbbbb",
  title: 'Press, "strict" & clean',
  channel: "Coach Two",
  verifiedOn: "2026-11-12",
};

const csvOf = (rows: string[]): string =>
  `source_ref,youtube_video_id,title,channel,verified_on\n${rows.join("\n")}\n`;

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status });

describe("parseFormVideos and formatFormVideos", () => {
  it("should read rows and write the same text back", () => {
    const csv = csvOf([
      "Barbell_Full_Squat,aaaaaaaaaaa,How to Squat,Coach One,2026-11-12",
      'Barbell_Shoulder_Press,bbbbbbbbbbb,"Press, ""strict"" & clean",Coach Two,2026-11-12',
    ]);

    const rows = parseFormVideos(csv);

    expect(rows).toEqual([squat, press]);
    expect(formatFormVideos(rows)).toBe(csv);
  });

  it("should refuse a header that is not the expected columns", () => {
    expect(() => parseFormVideos("a,b\n")).toThrow(/header/);
  });

  it("should refuse rows that are not sorted by source_ref", () => {
    const csv = csvOf([
      "Barbell_Shoulder_Press,bbbbbbbbbbb,T,C,2026-11-12",
      "Barbell_Full_Squat,aaaaaaaaaaa,T,C,2026-11-12",
    ]);

    expect(() => parseFormVideos(csv)).toThrow(/sorted/);
  });

  it("should refuse a repeated source_ref", () => {
    const csv = csvOf([
      "Barbell_Full_Squat,aaaaaaaaaaa,T,C,2026-11-12",
      "Barbell_Full_Squat,bbbbbbbbbbb,T,C,2026-11-12",
    ]);

    expect(() => parseFormVideos(csv)).toThrow(/more than once/);
  });

  it("should refuse a video id that is not 11 URL-safe characters", () => {
    expect(() => parseFormVideos(csvOf(["Barbell_Full_Squat,short,T,C,2026-11-12"]))).toThrow(
      /video id/,
    );
  });

  it("should refuse a verified_on that is not a date", () => {
    expect(() => parseFormVideos(csvOf(["Barbell_Full_Squat,aaaaaaaaaaa,T,C,12/11/2026"]))).toThrow(
      /verified_on/,
    );
  });

  it("should refuse an empty title or channel", () => {
    expect(() => parseFormVideos(csvOf(["Barbell_Full_Squat,aaaaaaaaaaa,,C,2026-11-12"]))).toThrow(
      /title/,
    );
  });
});

describe("oembedUrl", () => {
  it("should encode the watch URL inside the oEmbed URL", () => {
    expect(oembedUrl("aaaaaaaaaaa")).toBe(
      "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Daaaaaaaaaaa&format=json",
    );
  });
});

describe("checkFormVideo", () => {
  it("should pass when oEmbed answers 200 with the stored title and channel", async () => {
    const fetchMock = (): Promise<Response> =>
      Promise.resolve(jsonResponse(200, { title: squat.title, author_name: squat.channel }));

    expect(await checkFormVideo(squat, fetchMock)).toEqual({ ok: true });
  });

  it("should send the oEmbed URL with a generic User-Agent and no cookies", async () => {
    const seen: { url: string; init: RequestInit | undefined }[] = [];
    const fetchMock = (url: string, init?: RequestInit): Promise<Response> => {
      seen.push({ url, init });
      return Promise.resolve(jsonResponse(200, { title: squat.title, author_name: squat.channel }));
    };

    await checkFormVideo(squat, fetchMock);

    expect(seen[0]?.url).toBe(oembedUrl(squat.youtubeVideoId));
    expect(seen[0]?.init?.headers).toEqual({ "User-Agent": "form-video-verifier" });
    expect(seen[0]?.init?.credentials).toBe("omit");
  });

  it("should fail when the title differs", async () => {
    const fetchMock = (): Promise<Response> =>
      Promise.resolve(jsonResponse(200, { title: "Something else", author_name: squat.channel }));

    expect(await checkFormVideo(squat, fetchMock)).toEqual({
      ok: false,
      reason: 'title differs: oEmbed says "Something else"',
    });
  });

  it("should fail when the channel differs", async () => {
    const fetchMock = (): Promise<Response> =>
      Promise.resolve(jsonResponse(200, { title: squat.title, author_name: "Other" }));

    expect(await checkFormVideo(squat, fetchMock)).toEqual({
      ok: false,
      reason: 'channel differs: oEmbed says "Other"',
    });
  });

  it("should fail on 401, which means the video is not embeddable", async () => {
    const fetchMock = (): Promise<Response> => Promise.resolve(new Response("", { status: 401 }));

    expect(await checkFormVideo(squat, fetchMock)).toEqual({
      ok: false,
      reason: "oEmbed answered 401",
    });
  });

  it("should fail on 404, which means the video does not exist", async () => {
    const fetchMock = (): Promise<Response> => Promise.resolve(new Response("", { status: 404 }));

    expect(await checkFormVideo(squat, fetchMock)).toEqual({
      ok: false,
      reason: "oEmbed answered 404",
    });
  });

  it("should fail when the network fails, without throwing", async () => {
    const fetchMock = (): Promise<Response> => Promise.reject(new TypeError("fetch failed"));

    expect(await checkFormVideo(squat, fetchMock)).toEqual({
      ok: false,
      reason: "request failed: fetch failed",
    });
  });

  it("should fail when a 200 answer is not the expected JSON", async () => {
    const fetchMock = (): Promise<Response> =>
      Promise.resolve(new Response("<html>", { status: 200 }));

    expect(await checkFormVideo(squat, fetchMock)).toEqual({
      ok: false,
      reason: "oEmbed answer is not the expected JSON",
    });
  });
});

describe("renderFormVideosMigration", () => {
  const sql = renderFormVideosMigration([squat, press]);

  it("should hold exactly one seed tuple per row, joined by source_ref and never by uuid", () => {
    expect(sql).toContain(
      "('Barbell_Full_Squat', 'aaaaaaaaaaa', 'How to Squat', 'Coach One', date '2026-11-12')",
    );
    expect(sql).toContain(
      "('Barbell_Shoulder_Press', 'bbbbbbbbbbb', 'Press, \"strict\" & clean', 'Coach Two', date '2026-11-12')",
    );
    expect(sql.match(/^\s+\('/gm)).toHaveLength(2);
    expect(sql).toContain("e.source = 'free_exercise_db' and e.source_ref = seed.source_ref");
  });

  it("should upsert on exercise_id so a re-run is harmless", () => {
    expect(sql).toContain("on conflict (exercise_id) do update set");
  });

  it("should raise when the written count differs from the row count", () => {
    expect(sql).toContain("if written_count <> 2 then");
    expect(sql).toContain("raise exception");
  });

  it("should double a single quote inside a value", () => {
    const quoted = renderFormVideosMigration([{ ...squat, title: "Coach's squat" }]);

    expect(quoted).toContain("'Coach''s squat'");
  });

  it("should refuse a value that would end the dollar quoted block", () => {
    expect(() => renderFormVideosMigration([{ ...squat, title: "a $form_videos$ b" }])).toThrow(
      /dollar/,
    );
  });
});

describe("fillFormVideos", () => {
  const added = "Barbell_Full_Squat,aaaaaaaaaaa,,,";

  it("should read a row with no title, channel or date when it is being added", () => {
    expect(parseFormVideos(csvOf([added]), { allowUnfilled: true })).toEqual([
      { ...squat, title: "", channel: "", verifiedOn: "" },
    ]);
  });

  it("should still refuse an unfilled row when filling is not allowed", () => {
    expect(() => parseFormVideos(csvOf([added]))).toThrow(/title/);
  });

  it("should fill an unfilled row from oEmbed, and leave a filled row alone", async () => {
    const fetchMock = (): Promise<Response> =>
      Promise.resolve(jsonResponse(200, { title: "oEmbed title", author_name: "oEmbed channel" }));
    const rows = parseFormVideos(
      csvOf([added, "Barbell_Shoulder_Press,bbbbbbbbbbb,Press,Coach Two,2026-01-01"]),
      { allowUnfilled: true },
    );

    const result = await fillFormVideos(rows, fetchMock, "2026-11-12");

    expect(result.failures).toEqual([]);
    expect(result.rows).toEqual([
      { ...squat, title: "oEmbed title", channel: "oEmbed channel", verifiedOn: "2026-11-12" },
      { ...press, title: "Press", channel: "Coach Two", verifiedOn: "2026-01-01" },
    ]);
  });

  it("should report a row oEmbed would not answer, and keep it unfilled", async () => {
    const fetchMock = (): Promise<Response> => Promise.resolve(new Response("", { status: 404 }));
    const rows = parseFormVideos(csvOf([added]), { allowUnfilled: true });

    const result = await fillFormVideos(rows, fetchMock, "2026-11-12");

    expect(result.failures).toEqual([
      { sourceRef: "Barbell_Full_Squat", reason: "oEmbed answered 404" },
    ]);
    expect(result.rows[0]?.title).toBe("");
  });
});
