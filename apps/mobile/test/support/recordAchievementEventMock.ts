import type { AchievementEventKind } from "@keylow/api-client";

/**
 * Stands in for `useRecordAchievementEvent`, whose real one needs the app's Supabase provider. A test reads
 * what was recorded from `mockRecordAchievementEvent`.
 */
export const mockRecordAchievementEvent = jest.fn<undefined, [AchievementEventKind, string?]>();

export const mockUseRecordAchievementEvent = () => mockRecordAchievementEvent;
