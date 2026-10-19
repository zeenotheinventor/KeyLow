import {
  ROUTINE_DAY_CONTROLS,
  ROUTINE_DISCARD,
  ROUTINE_EDITOR,
  ROUTINE_WEEKDAY_CHOICES,
  describeDaysSummary,
  describeWeekdayPickerTitle,
} from "@keylow/core/copy";
import { MAX_DAYS_PER_ROUTINE, MAX_EXERCISES_PER_ROUTINE_DAY } from "@keylow/core/training";
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
import { leaveRoutineEditor } from "../../lib/leaveRoutineEditor";
import { useKeyboardLift } from "../../lib/useKeyboardLift";
import { useScrollFocusedInputIntoView } from "../../lib/useScrollFocusedInputIntoView";
import { AddExerciseSheet } from "../AddExerciseSheet";
import { RoutineDayCard } from "../RoutineDayCard";
import { RoutineDayExercises } from "../RoutineDayExercises";
import {
  ActionMenu,
  BottomSheet,
  Button,
  ChipGroup,
  ConfirmDialog,
  Input,
  SheetHeader,
  Text,
} from "../ui";

import type { OpenSheet, RoutineEditorProps } from "./types";
import type { RoutineDraft } from "@keylow/core/training";

const emptyDraft: RoutineDraft = { name: "", days: [] };

// A weekday sheet's chips carry a text value, which a null weekday (any day) has no number for.
const ANY_WEEKDAY_VALUE = "any";
const weekdayOptions = ROUTINE_WEEKDAY_CHOICES.map(({ weekday, label }) => ({
  value: weekday === null ? ANY_WEEKDAY_VALUE : String(weekday),
  label,
}));

/**
 * The routine editor's shell, as the `routines · editor` board draws it: Cancel editing, the title and a
 * Save, the routine's name, and a card for each day under a Days heading that sums them up as core words it.
 * The draft is a reducer; the days' exercises, the checks, reordering and Save are the tickets after this
 * one, so Save is drawn but cannot be pressed. Closing with changes asks first, by the header's Cancel, the
 * Android back button and the iOS swipe back alike.
 */
export function RoutineEditor({ initialDraft, exerciseNames }: RoutineEditorProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [startingState] = useState(() =>
    startingStateOf(initialDraft ?? emptyDraft, exerciseNames),
  );
  const [state, dispatch] = useReducer(routineDraftReducer, startingState);
  const [openSheet, setOpenSheet] = useState<OpenSheet | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const frameRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  // Android 15 draws edge to edge, so the window does not resize for the keyboard. iOS adjusts the scroll view's insets.
  const keyboardLift = useKeyboardLift(frameRef, Platform.OS === "android");
  const trackScrollOffset = useScrollFocusedInputIntoView(scrollViewRef, keyboardLift);

  const draft = draftOfState(state);
  const isChanged = JSON.stringify(draft) !== JSON.stringify(draftOfState(startingState));
  const summary = summaryOf(state);
  // The sheet keeps its day while it slides away, so its title holds. A removed day has no weekday to show.
  const sheetDay =
    openSheet === null ? undefined : state.days.find((day) => day.key === openSheet.dayKey);

  // The Android back button and the iOS swipe back end here when changes would be lost. Discarding lifts the
  // hold first, and the way out runs once, after the render that lifted it, or the navigator would still
  // refuse it.
  usePreventRemove(isChanged && !isLeaving, () => {
    setIsDiscardOpen(true);
  });

  useEffect(() => {
    if (isLeaving) {
      leaveRoutineEditor(router);
    }
  }, [isLeaving, router]);

  function close() {
    if (isChanged) {
      setIsDiscardOpen(true);
    } else {
      leaveRoutineEditor(router);
    }
  }

  function openSheetFor(kind: OpenSheet["kind"], day: { key: number; name: string }) {
    // A focused field would keep the keyboard up over the sheet.
    Keyboard.dismiss();
    setOpenSheet({ kind, dayKey: day.key, dayName: day.name });
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
        trailingSlot={
          <Button disabled size="sm">
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
        onScroll={trackScrollOffset}
      >
        <Input
          density="compact"
          label={ROUTINE_EDITOR.nameLabel}
          value={state.name}
          onChangeText={(name) => {
            dispatch({ type: "renameRoutine", name });
          }}
        />
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
          {state.days.map((day, position) => (
            <RoutineDayCard
              exerciseCount={summary.days[position]?.exerciseCount ?? 0}
              isOpen={day.isOpen}
              key={day.key}
              name={day.name}
              setCount={summary.days[position]?.setCount ?? 0}
              weekday={day.weekday}
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
                onAdd={() => {
                  openSheetFor("exercise", day);
                }}
                onChangeField={(key, field, text) => {
                  dispatch({ type: "editExercise", dayKey: day.key, key, field, text });
                }}
                onRemove={(key) => {
                  dispatch({ type: "removeExercise", dayKey: day.key, key });
                }}
              />
            </RoutineDayCard>
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
          setIsLeaving(true);
        }}
      />
    </View>
  );
}
