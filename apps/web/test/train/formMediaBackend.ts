import { trainBackend } from "./support";

type Row = Record<string, unknown>;

/** The `exercise_form_media` row of a curated video, as the database function answers it. */
export const videoRow: Row = {
  video_id: "abcdefghijk",
  video_title: "How to do a barbell bench press",
  video_channel: "Strength Basics",
  image_paths: null,
};

/** The row of an exercise with its two photos and no video. */
export const photosRow: Row = {
  video_id: null,
  video_title: null,
  video_channel: null,
  image_paths: ["Leg_Press/0.jpg", "Leg_Press/1.jpg"],
};

/** The row of an exercise with neither, which the database answers as no row at all. */
export const noRows: Row[] = [];

/** What the fake `exercise_form_media` function answers, and how many times it was asked. */
export const formMediaBackend: {
  rows: Row[];
  /** Answers the call with a server error. */
  isFailing: boolean;
  /** Never answers the call, as a slow connection does. */
  isHanging: boolean;
  /** The exercise ids the function was asked for, in order. */
  asked: string[];
} = { rows: noRows, isFailing: false, isHanging: false, asked: [] };

export function resetFormMediaBackend(): void {
  formMediaBackend.rows = noRows;
  formMediaBackend.isFailing = false;
  formMediaBackend.isHanging = false;
  formMediaBackend.asked = [];
}

/** Puts the form media function behind the train fake's network. Call it from `beforeEach`. */
export function serveFormMedia(): void {
  trainBackend.extraRoute = (request, url) => {
    if (!url.pathname.endsWith("/rpc/exercise_form_media")) {
      return null;
    }
    return answerFormMedia(request);
  };
}

async function answerFormMedia(request: Request): Promise<Response> {
  const body: unknown = await request.json();
  formMediaBackend.asked.push(
    typeof body === "object" && body !== null && "p_exercise_id" in body
      ? String(body.p_exercise_id)
      : "",
  );
  if (formMediaBackend.isHanging) {
    return new Promise<Response>(() => undefined);
  }
  if (formMediaBackend.isFailing) {
    return new Response(JSON.stringify({ message: "down" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify(formMediaBackend.rows), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
