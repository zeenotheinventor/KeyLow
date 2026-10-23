import { useSaveRoutine } from "@keylow/api-client";
import {
  ARCHIVE_ACTIVE_REFUSAL,
  ROUTINE_ARCHIVE_UNSAVED,
  ROUTINE_DAY_CONTROLS,
  ROUTINE_DISCARD,
  ROUTINE_EDITOR,
  ROUTINE_MOVE,
  ROUTINE_SAVE_FAILED,
  ROUTINE_WEEKDAY_CHOICES,
  describeDaysSummary,
  describeProblemsBanner,
  describeRemoveExercise,
  describeWeekdayPickerTitle,
} from "@keylow/core/copy";
import { MAX_DAYS_PER_ROUTINE, MAX_EXERCISES_PER_ROUTINE_DAY } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { vars } from "nativewind";
import { useEffect, useReducer, useRef, useState } from "react";
import { Keyboard, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  draftOfState,
  routineDraftReducer,
  startingStateOf,
  summaryOf,
} from "./routineDraftReducer";
import { routineMarksOf } from "./routineMarks";
import { useArchiveRoutineWithUndo } from "./useArchiveRoutineWithUndo";
import { leaveRoutineEditor, leaveRoutineEditorSaved } from "../../lib/leaveRoutineEditor";
import { useKeyboardLift } from "../../lib/useKeyboardLift";
import { useScrollFocusedInputIntoView } from "../../lib/useScrollFocusedInputIntoView";
import { AddExerciseSheet } from "../AddExerciseSheet";
import { RoutineDayCard } from "../RoutineDayCard";
import { RoutineDayExercises } from "../RoutineDayExercises";
import {
  ActionMenu,
  Banner,
  BottomSheet,
  Button,
  ChipGroup,
  ConfirmDialog,
  FieldError,
  Input,
  SheetHeader,
  Text,
  useToast,
} from "../ui";

import type { RoutineMarks } from "./routineMarks";
import type { EditorState, MoveDirection, OpenSheet, RoutineEditorProps } from "./types";
import type { RoutineDraft } from "@keylow/core/training";

const emptyDraft: RoutineDraft = { name: "", days: [] };

// How long a save may hold the screen. A link that stalls never settles the save, and Android has no network
// timeout, so after this the person can leave and is asked about the changes as usual.
const SAVE_HOLD_CEILING_MILLISECONDS = 12000;

// How far under the top of the scroll view the first problem is scrolled to.
const ROOM_ABOVE_PROBLEM = 12;

// A weekday sheet's chips carry a text value, which a null weekday (any day) has no number for.
const ANY_WEEKDAY_VALUE = "any";
const weekdayOptions = ROUTINE_WEEKDAY_CHOICES.map(({ weekday, label }) => ({
  value: weekday === null ? ANY_WEEKDAY_VALUE : String(weekday),
  label,
}));

/** Whether a day holds a problem a closed day would hide: its name, or one of its exercises. */
const dayHasMarks = (marks: RoutineMarks, position: number): boolean => {
  const day = marks.days[position];
  return (
    day !== undefined &&
    (day.name !== undefined || day.exercises.some((mark) => mark !== undefined))
  );
};

/** The mark the first problem is in, in the order the editor draws them: the name, then each day and its exercises. */
function firstMarkId(state: EditorState, marks: RoutineMarks): string | undefined {
  if (marks.name !== undefined) {
    return "name";
  }
  for (const [position, dayMarks] of marks.days.entries()) {
    const day = state.days[position];
    if (day === undefined) {
      continue;
    }
    if (dayMarks.header !== undefined || dayMarks.name !== undefined) {
      return `day:${day.key}`;
    }
    const exercisePosition = dayMarks.exercises.findIndex((mark) => mark !== undefined);
    const exercise = day.exercises[exercisePosition];
    if (exercise !== undefined) {
      return `exercise:${day.key}:${exercise.key}`;
    }
  }
  return undefined;
}

/** Move up and Move down, the first dimmed at the top of its list and the second at the bottom. */
const moveItems = (isFirst: boolean, isLast: boolean, move: (by: MoveDirection) => void) =>
  [
    {
      label: ROUTINE_MOVE.upAction,
      icon: "ChevronUp",
      disabled: isFirst,
      onPress: () => {
        move("up");
      },
    },
    {
      label: ROUTINE_MOVE.downAction,
      icon: "ChevronDown",
      disabled: isLast,
      onPress: () => {
        move("down");
      },
    },
  ] as const;

/**
 * The routine editor's shell, as the `routines · editor` board draws it: Cancel editing, the title and a
 * Save, the routine's name, and a card for each day under a Days heading that sums them up as core words it.
 * The draft is a reducer. Save checks the draft with core's rules: with problems it marks each one next to
 * its field, counts them in the banner and scrolls to the first (the marks then follow the draft as it is
 * fixed), and with none it saves, which needs a connection. A save that works returns to the routines list,
 * and one that fails keeps the draft and says so in a toast. A day's and an exercise's menus move them up
 * and down. Closing with changes asks first, by the header's Cancel, the Android back button and the iOS
 * swipe back alike, but never after a save.
 */
export function RoutineEditor({
  initialDraft,
  exerciseNames,
  routineId,
  isActive = false,
  isArchived = false,
}: RoutineEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const saveRoutine = useSaveRoutine();
  const archiveRoutine = useArchiveRoutineWithUndo();
  const insets = useSafeAreaInsets();
  const [startingState] = useState(() =>
    startingStateOf(initialDraft ?? emptyDraft, exerciseNames),
  );
  const [state, dispatch] = useReducer(routineDraftReducer, startingState);
  const [openSheet, setOpenSheet] = useState<OpenSheet | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [exit, setExit] = useState<"discarded" | "saved" | "archived" | null>(null);
  const isLeaving = exit !== null;
  // Marks show from the first press of Save with problems, and follow the draft after.
  const [areMarksShown, setAreMarksShown] = useState(false);
  const [scrollRequest, setScrollRequest] = useState(0);
  const [markNodes] = useState(() => new Map<string, View>());
  const markToScrollTo = useRef<string | undefined>(undefined);
  const [isSaveSlow, setIsSaveSlow] = useState(false);
  const slowSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrollOffset = useRef(0);
  const frameRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  // Android 15 draws edge to edge, so the window does not resize for the keyboard. iOS adjusts the scroll view's insets.
  const keyboardLift = useKeyboardLift(frameRef, Platform.OS === "android");
  const trackScrollOffset = useScrollFocusedInputIntoView(scrollViewRef, keyboardLift);

  const draft = draftOfState(state);
  const isChanged = JSON.stringify(draft) !== JSON.stringify(draftOfState(startingState));
  const summary = summaryOf(state);
  const marks = areMarksShown ? routineMarksOf(draft) : undefined;
  // The sheet keeps its day while it slides away, so its title holds. A removed day has no weekday to show.
  const sheetDay =
    openSheet === null ? undefined : state.days.find((day) => day.key === openSheet.dayKey);
  const sheetDayPosition = state.days.findIndex((day) => day.key === sheetDay?.key);
  const sheetExercises = sheetDay?.exercises ?? [];
  const sheetExercisePosition = sheetExercises.findIndex(
    (exercise) => exercise.key === openSheet?.exerciseKey,
  );

  // The Android back button and the iOS swipe back end here when changes would be lost. Discarding lifts the
  // hold first, and the way out runs once, after the render that lifted it, or the navigator would still
  // refuse it. While a save is on its way the screen is held whether or not it changed, and asks nothing: the
  // save cannot be taken back, so the person waits for it.
  const isSaveHolding = saveRoutine.isPending && !isSaveSlow;
  usePreventRemove((isChanged || isSaveHolding) && !isLeaving, () => {
    if (!isSaveHolding) {
      setIsDiscardOpen(true);
    }
  });

  useEffect(() => {
    if (exit === "discarded") {
      leaveRoutineEditor(router);
    } else if (exit === "saved" || exit === "archived") {
      leaveRoutineEditorSaved(router);
    }
  }, [exit, router]);

  useEffect(
    () => () => {
      clearTimeout(slowSaveTimer.current);
    },
    [],
  );

  // The scroll waits for the render that opened the days with problems, because a row in a closed day is not drawn.
  useEffect(() => {
    const node =
      markToScrollTo.current === undefined ? undefined : markNodes.get(markToScrollTo.current);
    const scrollView = scrollViewRef.current;
    const scrollViewHost = scrollView?.getNativeScrollRef();
    if (scrollRequest === 0 || node === undefined || scrollView === null || !scrollViewHost) {
      return;
    }
    node.measureInWindow((_left, top) => {
      scrollViewHost.measureInWindow((_scrollViewLeft, scrollViewTop) => {
        scrollView.scrollTo({
          y: Math.max(0, scrollOffset.current + top - scrollViewTop - ROOM_ABOVE_PROBLEM),
          animated: true,
        });
      });
    });
  }, [scrollRequest, markNodes]);

  function markNode(id: string) {
    return (node: View | null) => {
      if (node === null) {
        markNodes.delete(id);
      } else {
        markNodes.set(id, node);
      }
    };
  }

  async function save() {
    const found = routineMarksOf(draft);
    if (found.count > 0) {
      setAreMarksShown(true);
      dispatch({
        type: "openDays",
        keys: state.days
          .filter((_, position) => dayHasMarks(found, position))
          .map((day) => day.key),
      });
      markToScrollTo.current = firstMarkId(state, found);
      setScrollRequest((request) => request + 1);
      return;
    }
    // Nothing is queued, so with no connection the press goes straight to the failure.
    if (!onlineManager.isOnline()) {
      showSaveFailed();
      return;
    }
    setIsSaveSlow(false);
    clearTimeout(slowSaveTimer.current);
    slowSaveTimer.current = setTimeout(() => {
      setIsSaveSlow(true);
    }, SAVE_HOLD_CEILING_MILLISECONDS);
    try {
      await saveRoutine.mutateAsync({ id: routineId ?? null, draft });
    } catch {
      clearTimeout(slowSaveTimer.current);
      setIsSaveSlow(false);
      showSaveFailed();
      return;
    }
    clearTimeout(slowSaveTimer.current);
    // The hold on leaving lifts first, and the way out runs after the render that lifted it.
    setExit("saved");
  }

  function showSaveFailed() {
    toast.show({ message: ROUTINE_SAVE_FAILED, tone: "danger", icon: "CircleAlert" });
  }

  // Why Archive routine is dimmed, if it is. The active routine is told first, since saving does not change it.
  // A save on its way counts as unsaved changes even when the draft is unchanged, or the save and the archive
  // would each leave the screen.
  const archiveDimmedReason = isActive
    ? ARCHIVE_ACTIVE_REFUSAL
    : isChanged || saveRoutine.isPending
      ? ROUTINE_ARCHIVE_UNSAVED
      : undefined;

  async function archive() {
    if (routineId === undefined || archiveDimmedReason !== undefined) {
      return;
    }
    const isArchivedNow = await archiveRoutine(routineId);
    setIsMoreOpen(false);
    if (isArchivedNow) {
      // The hold on leaving lifts first, and the way out runs after the render that lifted it.
      setExit("archived");
    }
  }

  function openMore() {
    // A focused field would keep the keyboard up over the sheet.
    Keyboard.dismiss();
    setIsMoreOpen(true);
  }

  function close() {
    // The save is on its way and cannot be taken back, so leaving would only look like a discard.
    if (isSaveHolding) {
      return;
    }
    if (isChanged) {
      setIsDiscardOpen(true);
    } else {
      leaveRoutineEditor(router);
    }
  }

  function openSheetFor(
    kind: OpenSheet["kind"],
    day: { key: number; name: string },
    exercise?: { key: number; name: string },
  ) {
    // A focused field would keep the keyboard up over the sheet.
    Keyboard.dismiss();
    setOpenSheet({
      kind,
      dayKey: day.key,
      dayName: day.name,
      exerciseKey: exercise?.key,
      exerciseName: exercise?.name,
    });
    setIsSheetOpen(true);
  }

  function closeSheet() {
    setIsSheetOpen(false);
  }

  return (
    // The insets and the keyboard's cover are runtime values no class can name, so they go through variables.
    <View
      ref={frameRef}
      className="flex-1 bg-background pb-[var(--keyboard-lift)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--keyboard-lift": keyboardLift })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: ROUTINE_EDITOR.cancelLabel, onPress: close }}
        title={initialDraft === undefined ? ROUTINE_EDITOR.newTitle : ROUTINE_EDITOR.title}
        trailing={
          routineId === undefined || isArchived
            ? undefined
            : { icon: "Ellipsis", label: ROUTINE_EDITOR.moreLabel, onPress: openMore }
        }
        trailingSlot={
          <Button
            loading={saveRoutine.isPending}
            size="sm"
            onPress={() => {
              void save();
            }}
          >
            {ROUTINE_EDITOR.saveAction}
          </Button>
        }
      />
      <ScrollView
        ref={scrollViewRef}
        automaticallyAdjustKeyboardInsets
        className="flex-1"
        contentContainerClassName="grow gap-3 px-4 pb-4 pt-1"
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(event) => {
          scrollOffset.current = event.nativeEvent.contentOffset.y;
          trackScrollOffset(event);
        }}
      >
        {marks === undefined || marks.count === 0 ? null : (
          <Banner sentence title={describeProblemsBanner(marks.count)} variant="error" />
        )}
        <View ref={markNode("name")}>
          <Input
            density="compact"
            error={marks?.name}
            label={ROUTINE_EDITOR.nameLabel}
            value={state.name}
            onChangeText={(name) => {
              dispatch({ type: "renameRoutine", name });
            }}
          />
        </View>
        <View className="gap-2">
          <View className="flex-row items-baseline justify-between">
            <Text role="heading" variant="body-strong">
              {ROUTINE_EDITOR.daysHeading}
            </Text>
            <Text tone="muted" variant="caption">
              {describeDaysSummary({
                dayCount: summary.dayCount,
                setsPerWeek: summary.setsPerWeek,
              })}
            </Text>
          </View>
          {marks?.daysMessage === undefined ? null : <FieldError>{marks.daysMessage}</FieldError>}
          {state.days.map((day, position) => (
            <View key={day.key} ref={markNode(`day:${day.key}`)}>
              <RoutineDayCard
                exerciseCount={summary.days[position]?.exerciseCount ?? 0}
                isOpen={day.isOpen}
                name={day.name}
                nameError={marks?.days[position]?.name}
                setCount={summary.days[position]?.setCount ?? 0}
                weekday={day.weekday}
                weekdayError={marks?.days[position]?.header}
                onOpenMenu={() => {
                  openSheetFor("menu", day);
                }}
                onOpenWeekday={() => {
                  openSheetFor("weekday", day);
                }}
                onRename={(name) => {
                  dispatch({ type: "renameDay", key: day.key, name });
                }}
                onToggle={() => {
                  dispatch({ type: "toggleDay", key: day.key });
                }}
              >
                <RoutineDayExercises
                  exercises={day.exercises}
                  isFull={day.exercises.length >= MAX_EXERCISES_PER_ROUTINE_DAY}
                  marks={marks?.days[position]?.exercises}
                  registerRow={(key) => markNode(`exercise:${day.key}:${key}`)}
                  onAdd={() => {
                    openSheetFor("exercise", day);
                  }}
                  onChangeField={(key, field, text) => {
                    dispatch({ type: "editExercise", dayKey: day.key, key, field, text });
                  }}
                  onOpenMenu={(key) => {
                    const exercise = day.exercises.find((candidate) => candidate.key === key);
                    openSheetFor("exerciseMenu", day, exercise);
                  }}
                />
              </RoutineDayCard>
            </View>
          ))}
          <Button
            disabled={state.days.length >= MAX_DAYS_PER_ROUTINE}
            fullWidth
            icon="Plus"
            variant="secondary"
            onPress={() => {
              dispatch({ type: "addDay" });
            }}
          >
            {ROUTINE_DAY_CONTROLS.addDayAction}
          </Button>
        </View>
      </ScrollView>
      <BottomSheet
        open={isSheetOpen && openSheet?.kind === "weekday"}
        title={describeWeekdayPickerTitle(openSheet?.dayName ?? "")}
        onClose={closeSheet}
      >
        <ChipGroup
          allowDeselect
          label={ROUTINE_DAY_CONTROLS.weekdayGroupLabel}
          options={weekdayOptions}
          value={
            sheetDay === undefined
              ? null
              : sheetDay.weekday === null
                ? ANY_WEEKDAY_VALUE
                : String(sheetDay.weekday)
          }
          onChange={(value: string | null) => {
            // Pressing the chosen weekday again changes nothing and closes the sheet.
            const choice = ROUTINE_WEEKDAY_CHOICES.find(
              ({ weekday }) => (weekday === null ? ANY_WEEKDAY_VALUE : String(weekday)) === value,
            );
            if (sheetDay !== undefined && choice !== undefined) {
              dispatch({ type: "setWeekday", key: sheetDay.key, weekday: choice.weekday });
            }
            closeSheet();
          }}
        />
      </BottomSheet>
      <BottomSheet
        label={openSheet?.dayName ?? ""}
        open={isSheetOpen && openSheet?.kind === "menu"}
        onClose={closeSheet}
      >
        <ActionMenu
          items={[
            ...moveItems(
              sheetDayPosition === 0,
              sheetDayPosition === state.days.length - 1,
              (by) => {
                if (sheetDay !== undefined) {
                  dispatch({ type: "moveDay", key: sheetDay.key, by });
                }
              },
            ),
            {
              label: ROUTINE_DAY_CONTROLS.removeDayAction,
              icon: "Trash2",
              destructive: true,
              onPress: () => {
                if (sheetDay !== undefined) {
                  dispatch({ type: "removeDay", key: sheetDay.key });
                }
                closeSheet();
              },
            },
          ]}
        />
      </BottomSheet>
      <BottomSheet
        label={openSheet?.exerciseName ?? ""}
        open={isSheetOpen && openSheet?.kind === "exerciseMenu"}
        onClose={closeSheet}
      >
        <ActionMenu
          items={[
            ...moveItems(
              sheetExercisePosition === 0,
              sheetExercisePosition === sheetExercises.length - 1,
              (by) => {
                if (sheetDay !== undefined && openSheet?.exerciseKey !== undefined) {
                  dispatch({
                    type: "moveExercise",
                    dayKey: sheetDay.key,
                    key: openSheet.exerciseKey,
                    by,
                  });
                }
              },
            ),
            {
              label: describeRemoveExercise(openSheet?.exerciseName ?? ""),
              icon: "Trash2",
              destructive: true,
              onPress: () => {
                if (sheetDay !== undefined && openSheet?.exerciseKey !== undefined) {
                  dispatch({
                    type: "removeExercise",
                    dayKey: sheetDay.key,
                    key: openSheet.exerciseKey,
                  });
                }
                closeSheet();
              },
            },
          ]}
        />
      </BottomSheet>
      <BottomSheet
        label={ROUTINE_EDITOR.moreLabel}
        open={isMoreOpen}
        onClose={() => {
          setIsMoreOpen(false);
        }}
      >
        <ActionMenu
          items={[
            {
              label: ROUTINE_EDITOR.archiveAction,
              icon: "Archive",
              caption: archiveDimmedReason,
              disabled: archiveDimmedReason !== undefined,
              onPress: () => {
                void archive();
              },
            },
          ]}
        />
      </BottomSheet>
      <AddExerciseSheet
        mode="routine"
        open={isSheetOpen && openSheet?.kind === "exercise"}
        onChoose={({ id, name }) => {
          if (openSheet?.kind === "exercise") {
            dispatch({ type: "addExercise", dayKey: openSheet.dayKey, exercise: { id, name } });
          }
        }}
        onClose={closeSheet}
      />
      <ConfirmDialog
        body={ROUTINE_DISCARD.body}
        cancelLabel={ROUTINE_DISCARD.keepEditingAction}
        confirmLabel={ROUTINE_DISCARD.discardAction}
        open={isDiscardOpen}
        title={ROUTINE_DISCARD.title}
        tone="destructive"
        onCancel={() => {
          setIsDiscardOpen(false);
        }}
        onConfirm={() => {
          setIsDiscardOpen(false);
          setExit("discarded");
        }}
      />
    </View>
  );
}
