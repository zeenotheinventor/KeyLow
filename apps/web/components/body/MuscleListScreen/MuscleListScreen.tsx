"use client";

import { useBodyMap, useMuscleList, useProfileTimeZone } from "@keylow/api-client";
import {
  BODY_MAP,
  MUSCLE_GROUP_NAMES,
  SEARCH_CLEAR_LABEL,
  TRAIN_ERROR,
  TRAIN_OFFLINE_TITLE,
  describeBodyMapHeader,
  describeMuscleCount,
} from "@keylow/core/copy";
import { addCalendarDays, daysSinceMonday, toLocalDate } from "@keylow/core/dates";
import {
  actualReadDateOf,
  bodyMapViewOf,
  filterMuscleListGroups,
  heatDateOf,
  plannedSessionsOf,
  selectedDateOf,
} from "@keylow/core/training";
import { iconStroke } from "@keylow/tokens";
import { ArrowRightLeft, SearchX, WifiOff } from "lucide-react";
import { useRef, useState } from "react";

import { BodyMapBackLink } from "../BodyMapBackLink";
import { MuscleRow } from "../MuscleRow";
import { MuscleSheet } from "../MuscleSheet";
import { ViewLabel } from "../ViewLabel";

import type { MuscleListScreenProps } from "./types";
import type { MuscleId } from "@keylow/core/training";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { GroupedList } from "@/components/ui/GroupedList";
import { SearchField } from "@/components/ui/SearchField";
import { Skeleton } from "@/components/ui/Skeleton";
import { bodyMapPath } from "@/lib/bodyMapRoutes";
import { useBodyMapView } from "@/lib/bodyMapView";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";
import { useSettledValue } from "@/lib/useSettledValue";

// How long typing must stand still before the number of muscles found is read out.
const ANNOUNCE_AFTER_TYPING_MS = 500;

/**
 * The muscle list page, opened from the body map's Muscle list row: all 22 muscles in 7 groups, each a row
 * with its heat as a swatch, in words and as a percent, filtered by the search field. A row opens the
 * muscle's sheet, the one the figures open, and closing it returns focus to the row. The list shows the view
 * last chosen on this device (Actual until one is), for the day the map had chosen (`?at=`), and the button
 * beside the view's name switches the same remembered view the map shows. With no routine Projected is off
 * and the list shows Actual, keeping the view chosen for when there is one. A day that the view shown
 * cannot choose falls back to today, as it does on the map. Offline with nothing already read there is no
 * saved list to show, and it says so.
 */
export function MuscleListScreen({ at: dayParameter }: MuscleListScreenProps) {
  const isOnline = useIsOnline();
  const now = useNow();
  const timeZone = useProfileTimeZone();
  // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
  const zone = timeZone.data ?? "UTC";
  const today = toLocalDate(now, zone);
  const weekStart = addCalendarDays(today, -daysSinceMonday(today));
  const weekEnd = addCalendarDays(weekStart, 6);
  const { view: chosenView, isRead: isViewRead, setView } = useBodyMapView();
  const [sheetMuscle, setSheetMuscle] = useState<MuscleId | null>(null);
  // The row that opened the sheet, which gets focus back when it closes. It is set with the muscle.
  const [sheetRow, setSheetRow] = useState<Element | undefined>(undefined);
  const [query, setQuery] = useState("");
  const searchField = useRef<HTMLInputElement>(null);
  const announcedQuery = useSettledValue(query.trim(), ANNOUNCE_AFTER_TYPING_MS);
  const moment = { weekStart, now: now.toISOString() };

  // The address carries any text, so only a day of this week is taken, and today is read as no day at all.
  const heatDate = heatDateOf(dayParameter, today, weekStart);
  // The map's own two reads at the same days, from the same cache. They hold the days of the week, the
  // moment shown and whether there is a routine, which the list's rows do not.
  const actual = useBodyMap({
    ...moment,
    scale: "heat",
    view: "actual",
    at: actualReadDateOf(heatDate, today, false),
  });
  const projected = useBodyMap({ ...moment, scale: "heat", view: "projected", at: heatDate });
  const view = bodyMapViewOf(chosenView, projected.data?.projectedAvailable);
  const shown = view === "projected" ? projected : actual;
  const shownDays = shown.data?.days ?? [];
  const selectedDate = selectedDateOf(heatDate, shownDays, today);
  const isSelectedToday = selectedDate === today;
  // Today is the current moment, so it is read with no day.
  const readDay = isSelectedToday ? undefined : selectedDate;
  const list = useMuscleList({ view, at: readDay, ...moment });

  function renderBody() {
    const { data: actualData } = actual;
    const { data: projectedData } = projected;
    const { data: groups } = list;
    if (
      isViewRead &&
      actualData !== undefined &&
      projectedData !== undefined &&
      groups !== undefined
    ) {
      const shownData = view === "projected" ? projectedData : actualData;
      // A planned session counts from the day after today up to the day shown.
      const plannedSessions = plannedSessionsOf(shownData.days, today, selectedDate);
      const { viewLabel, subLine, toggleLabel } = describeBodyMapHeader({
        scale: "heat",
        view,
        at: shownData.computedAt,
        tz: zone,
        isToday: isSelectedToday,
        weekEnd,
        plannedSessions,
      });
      const { projectedAvailable } = projectedData;
      const visibleGroups = filterMuscleListGroups(groups, query);
      // Nothing is read out for an empty search, and the count follows the typing once it has stopped.
      const announcement =
        announcedQuery === ""
          ? ""
          : describeMuscleCount(
              filterMuscleListGroups(groups, announcedQuery).reduce(
                (total, { rows }) => total + rows.length,
                0,
              ),
            );

      return (
        <>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <ViewLabel isProjected={view === "projected"} label={viewLabel} subLine={subLine} />
              <Button
                variant="secondary"
                size="sm"
                disabled={!projectedAvailable}
                onClick={() => {
                  setView(view === "projected" ? "actual" : "projected");
                }}
              >
                <ArrowRightLeft aria-hidden strokeWidth={iconStroke} />
                {toggleLabel}
              </Button>
            </div>
            {projectedAvailable ? null : (
              <p className="text-caption text-text-secondary">
                {BODY_MAP.toggle.projectedNeedsRoutine}
              </p>
            )}
          </div>
          <SearchField
            ref={searchField}
            label={BODY_MAP.muscleSearch.label}
            placeholder={BODY_MAP.muscleSearch.label}
            size="sm"
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            clear={{
              label: SEARCH_CLEAR_LABEL,
              onClick: () => {
                setQuery("");
                searchField.current?.focus();
              },
            }}
          />
          <p role="status" className="sr-only">
            {announcement}
          </p>
          {visibleGroups.length === 0 ? (
            <EmptyState icon={SearchX} title={BODY_MAP.muscleSearch.noResults} size="list" />
          ) : (
            visibleGroups.map(({ group, rows }) => (
              <GroupedList key={group} title={MUSCLE_GROUP_NAMES[group]} headerSize="compact">
                {rows.map((row) => (
                  <MuscleRow
                    key={row.muscle}
                    row={row}
                    onOpen={(rowElement) => {
                      setSheetRow(rowElement);
                      setSheetMuscle(row.muscle);
                    }}
                  />
                ))}
              </GroupedList>
            ))
          )}
        </>
      );
    }
    if (actual.isError || projected.isError || list.isError) {
      return (
        <ErrorState
          title={TRAIN_ERROR.title}
          body={TRAIN_ERROR.body}
          retryLabel={TRAIN_ERROR.action}
          onRetry={() => {
            // Try again reads every one of them that failed, and nothing else on screen.
            void Promise.all([actual.refetch(), projected.refetch(), list.refetch()]);
          }}
        />
      );
    }
    // Offline, a read that has not arrived will not: there is no saved list to show. Rows that are there are
    // only waiting for the saved view, which is read from the device at once.
    const isWaitingForView =
      actual.data !== undefined && projected.data !== undefined && list.data !== undefined;
    return isOnline || isWaitingForView ? (
      <Skeleton variant="rows" count={6} label={BODY_MAP.dashboardCard.loadingLabel} />
    ) : (
      <EmptyState
        icon={WifiOff}
        title={TRAIN_OFFLINE_TITLE}
        body={BODY_MAP.dashboardCard.offlineUnavailable}
        size="section"
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="-my-2 self-start">
          <BodyMapBackLink fallbackHref={bodyMapPath()} />
        </div>
        <h1 className="text-h1">{BODY_MAP.listTitle}</h1>
      </div>
      {renderBody()}
      <MuscleSheet
        muscle={sheetMuscle}
        returnFocusTo={sheetRow}
        view={view}
        at={readDay}
        weekStart={weekStart}
        now={moment.now}
        days={shownDays}
        onClose={() => {
          setSheetMuscle(null);
        }}
      />
    </div>
  );
}
