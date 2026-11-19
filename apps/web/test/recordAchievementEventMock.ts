import { vi } from "vitest";

import type { AchievementEventKind } from "@keylow/api-client";

/**
 * Stands in for `useRecordAchievementEvent`, whose real one needs the app's Supabase provider. A test reads
 * what was recorded from `mockRecordAchievementEvent`.
 */
export const mockRecordAchievementEvent =
  vi.fn<(kind: AchievementEventKind, ref?: string) => void>();

export const mockUseRecordAchievementEvent = () => mockRecordAchievementEvent;
