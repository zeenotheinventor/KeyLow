import type { TrendSetRows } from "../repos/trainingSchemas";
import type { QueryClient } from "@tanstack/react-query";

/** The rows of a cached trend read, and when that read was made, in milliseconds. */
export type CachedTrendRead = { rows: TrendSetRows; dataUpdatedAt: number };

/**
 * The newest read held in the cache for this id in a trend family (`exerciseTrendAll` or `routineTrendAll`)
 * that started on a Monday on or before `fromWeek`, with the time it was read, or undefined when there is
 * none. A trend key ends in the Monday its range starts on, so a phone that was last online in an earlier
 * week finds the rows it read then, and shows them until a connection brings this week's. Rows from a
 * later start are not used: they cover fewer of the weeks asked for. Rows only; the trend is worked out
 * from them at read time.
 */
export function newestCachedTrendRead(
  queryClient: QueryClient,
  family: readonly string[],
  id: string,
  fromWeek: string,
): CachedTrendRead | undefined {
  const [newest] = queryClient
    .getQueriesData<TrendSetRows>({ queryKey: [...family, id] })
    .flatMap(([queryKey, rows]) => {
      const startsOn = String(queryKey[3]);
      return rows === undefined || startsOn > fromWeek
        ? []
        : [
            {
              rows,
              startsOn,
              dataUpdatedAt: queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0,
            },
          ];
    })
    .sort((first, second) => (first.startsOn < second.startsOn ? 1 : -1));
  return newest === undefined
    ? undefined
    : { rows: newest.rows, dataUpdatedAt: newest.dataUpdatedAt };
}

/** The rows of `newestCachedTrendRead`, for a read that has no use for the time. */
export function newestCachedTrendRows(
  queryClient: QueryClient,
  family: readonly string[],
  id: string,
  fromWeek: string,
): TrendSetRows | undefined {
  return newestCachedTrendRead(queryClient, family, id, fromWeek)?.rows;
}
