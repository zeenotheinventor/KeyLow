import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native";

import { useExerciseFormMedia } from "../lib/exerciseFormMedia";
import { createDiaryQueryClient } from "./support/diaryBackend";
import {
  formMediaBackend,
  formMediaClient,
  resetFormMediaBackend,
} from "./support/formMediaBackend";

import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const SQUAT_ID = "00000000-0000-4000-8000-000000000b01";
const SQUAT_VIDEO = {
  video_id: "abcdefghijk",
  video_title: "Barbell back squat, step by step",
  video_channel: "Strength Basics",
  image_paths: null,
};

let queryClient: QueryClient;

function renderFormMedia(isOpen: boolean) {
  queryClient = createDiaryQueryClient();

  return renderHook(
    (props: { isOpen: boolean }) => useExerciseFormMedia({ exerciseId: SQUAT_ID, ...props }),
    {
      initialProps: { isOpen },
      wrapper: ({ children }: { children: ReactNode }) => (
        <KeyLowProvider client={formMediaClient} queryClient={queryClient}>
          {children}
        </KeyLowProvider>
      ),
    },
  );
}

describe("useExerciseFormMedia", () => {
  beforeEach(() => {
    resetFormMediaBackend();
    formMediaBackend.rowsByExercise[SQUAT_ID] = SQUAT_VIDEO;
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  it("should make no request while the sheet is closed", async () => {
    const { result } = await renderFormMedia(false);

    await act(() => Promise.resolve());
    expect(result.current).toEqual({ status: "loading" });
    expect(formMediaBackend.reads).toBe(0);
  });

  it("should be ready with the video once the sheet opens online", async () => {
    const { result, rerender } = await renderFormMedia(false);

    await rerender({ isOpen: true });

    await waitFor(() => {
      expect(result.current).toEqual({
        status: "ready",
        media: {
          kind: "video",
          videoId: "abcdefghijk",
          title: "Barbell back squat, step by step",
          channel: "Strength Basics",
        },
      });
    });
    expect(formMediaBackend.reads).toBe(1);
  });

  it("should be offline when the sheet opens with no connection and nothing read", async () => {
    await act(() => {
      onlineManager.setOnline(false);
    });
    const { result } = await renderFormMedia(true);

    await waitFor(() => {
      expect(result.current).toEqual({ status: "offline" });
    });
    expect(formMediaBackend.reads).toBe(0);
  });

  it("should be failed when the read fails", async () => {
    formMediaBackend.read = "fail";
    const { result } = await renderFormMedia(true);

    await waitFor(() => {
      expect(result.current).toEqual({ status: "failed" });
    });
  });
});
