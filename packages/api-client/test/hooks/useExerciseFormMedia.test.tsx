import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useExerciseFormMedia } from "../../src/hooks/useExerciseFormMedia";
import { keys } from "../../src/queryKeys";
import { REST_URL, postgrestError } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

const EXERCISE_ID = "77777777-7777-4777-8777-777777777777";

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

const open = { exerciseId: EXERCISE_ID, isOpen: true, isOnline: true, enabled: true };

const answerWith = (rows: readonly unknown[]) => {
  const requests: Request[] = [];
  server.use(
    http.post(`${REST_URL}/rpc/exercise_form_media`, ({ request }) => {
      requests.push(request);
      return HttpResponse.json(rows);
    }),
  );
  return requests;
};

describe("useExerciseFormMedia", () => {
  it("should be loading, then ready with the video and photos of the exercise", async () => {
    answerWith([
      {
        video_id: "aB3_-xYz012",
        video_title: "Barbell squat form",
        video_channel: "Form Channel",
        image_paths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"],
      },
    ]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useExerciseFormMedia(open), { wrapper });

    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => {
      expect(result.current).toEqual({
        status: "ready",
        media: {
          video: { videoId: "aB3_-xYz012", title: "Barbell squat form", channel: "Form Channel" },
          photos: { imagePaths: ["Barbell_Squat/0.jpg", "Barbell_Squat/1.jpg"] },
        },
      });
    });
  });

  it("should be ready with neither for an exercise that has nothing to show", async () => {
    answerWith([]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useExerciseFormMedia(open), { wrapper });

    await waitFor(() => {
      expect(result.current).toEqual({ status: "ready", media: { video: null, photos: null } });
    });
  });

  it("should cache the media under the form media key, for a long time", async () => {
    answerWith([]);
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useExerciseFormMedia(open), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(queryClient.getQueryData(keys.training.exerciseFormMedia(EXERCISE_ID))).toEqual({
      video: null,
      photos: null,
    });
    expect(
      queryClient.getQueryCache().find({ queryKey: keys.training.exerciseFormMedia(EXERCISE_ID) })
        ?.observers[0]?.options.staleTime,
    ).toBeGreaterThanOrEqual(60 * 60 * 1000);
  });

  it("should make no request while closed, and be loading", async () => {
    const requests = answerWith([]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useExerciseFormMedia({ ...open, isOpen: false }), {
      wrapper,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(requests).toHaveLength(0);
    expect(result.current).toEqual({ status: "loading" });
  });

  it("should make no request while reads are not enabled", async () => {
    const requests = answerWith([]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useExerciseFormMedia({ ...open, enabled: false }), {
      wrapper,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(requests).toHaveLength(0);
    expect(result.current).toEqual({ status: "loading" });
  });

  it("should be offline while open and the device is offline, with nothing held", () => {
    answerWith([]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useExerciseFormMedia({ ...open, isOnline: false }), {
      wrapper,
    });

    expect(result.current).toEqual({ status: "offline" });
  });

  it("should be failed when the read fails", async () => {
    server.use(
      http.post(`${REST_URL}/rpc/exercise_form_media`, () =>
        postgrestError(500, "XX000", "unavailable"),
      ),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useExerciseFormMedia(open), { wrapper });

    await waitFor(() => {
      expect(result.current).toEqual({ status: "failed" });
    });
  });
});
