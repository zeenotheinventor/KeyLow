import type { WidgetKind } from "./constants";
import type { WidgetAction } from "./links";
import type { PendingUndo } from "./snapshot";
import type { BodyArtworkFigure } from "../training/bodyArtwork";
import type { BodyFigureTone } from "../training/bodyFigureReading";
import type { MuscleId } from "../training/muscles";

/**
 * A colour by its job, never by its value. The widget layer maps each role to a token (ADR 0007, "The
 * source guard exception"), so core holds no colour and light and dark follow the phone.
 */
export type WidgetColourRole =
  | "text"
  | "textMuted"
  | "textSubtle"
  | "accent"
  | "onAccent"
  | "track"
  | "silhouette"
  | "success"
  | "warning"
  | "danger"
  | BodyFigureTone;

/** A colour for every role. The widget layer builds it from the tokens of the phone's light or dark mode. */
export type WidgetPalette = Readonly<Record<WidgetColourRole, string>>;

export type WidgetIcon =
  "search" | "scan" | "add" | "weight" | "recipe" | "play" | "check" | "chevron" | "training";

/** What the app did last for a one-tap action, when it did not work. The handler passes it on the redraw. */
export type WidgetFailure = "couldnt_log" | "session_moved_on";

/** What a redraw knows besides the snapshot. */
export type WidgetContext = Readonly<{
  /** The record kept beside the snapshot after a one-tap write, or null. */
  pendingUndo?: PendingUndo | null;
  /** Set for the redraw that follows a one-tap action that did not write. */
  failure?: WidgetFailure | null;
  /** True when the handler could not reach the network. */
  isOffline?: boolean;
}>;

export type WidgetButton = Readonly<{
  label: string;
  /** The name a screen reader reads, when it says more than the label. */
  accessibleName: string;
  icon: WidgetIcon | null;
  emphasis: "primary" | "secondary";
  action: WidgetAction;
}>;

export type WidgetStatus = Readonly<{ text: string; role: "warning" }>;

export type MessageState =
  | "signed_out"
  | "no_data"
  | "no_target"
  | "rest_day"
  | "no_recent_foods"
  | "couldnt_log"
  | "session_moved_on";

/** A widget with nothing normal to show: board D. Every size words it the same and lays it out to fit. */
export type MessageViewModel = Readonly<{
  kind: WidgetKind;
  state: MessageState;
  eyebrow: string;
  /** The corner text, such as "1,460 kcal eaten". */
  trailing: string | null;
  headline: string;
  headlineRole: "text" | "danger";
  body: string | null;
  actions: readonly WidgetButton[];
  accessibleName: string;
}>;

export type RingView = Readonly<{
  /** How much of the ring is filled, from 0 to 1. */
  fraction: number;
  hasTarget: boolean;
  /** The number in the middle: what is left, what is over, or what was eaten with no target. */
  value: string;
  caption: string;
  /** "1,460 of 2,200", null with no target. */
  eatenOfTarget: string | null;
  /** "1,460 of 2,200 kcal", null with no target. */
  eatenOfTargetWithUnit: string | null;
  accessibleName: string;
  fillRole: WidgetColourRole;
  trackRole: WidgetColourRole;
}>;

export type MacroRowView = Readonly<{
  label: string;
  /** "112 / 160 g". */
  value: string;
  fraction: number;
  fillRole: WidgetColourRole;
  trackRole: WidgetColourRole;
}>;

export type WeekDotView = Readonly<{
  /** "M". */
  letter: string;
  fill: "filled" | "outline";
  role: WidgetColourRole;
  isToday: boolean;
}>;

export type HeatRowView = Readonly<{
  muscle: MuscleId;
  name: string;
  stepName: string;
  dotRole: WidgetColourRole;
}>;

export type FigureView = Readonly<{
  figure: BodyArtworkFigure;
  scale: "heat" | "volume";
  /** The fill of every muscle, by its tone. `buildBodyFigureSvg` draws them. */
  tones: Readonly<Record<MuscleId, BodyFigureTone>>;
}>;

type ReadyBase<Kind extends WidgetKind> = Readonly<{
  kind: Kind;
  state: "ready";
  accessibleName: string;
  /** What a tap on the widget outside a button does. */
  tap: WidgetAction;
  /** The offline note, null when online. */
  status: WidgetStatus | null;
}>;

export type TodayRingViewModel = ReadyBase<"today_ring"> &
  Readonly<{ eyebrow: string; ring: RingView }>;

export type TodayMacrosViewModel = ReadyBase<"today_macros"> &
  Readonly<{ eyebrow: string; ring: RingView; macros: readonly MacroRowView[] }>;

export type ThisWeekViewModel = ReadyBase<"this_week"> &
  Readonly<{
    eyebrow: string;
    /** "4 of 5 days complete". */
    progress: string;
    average: Readonly<{ value: string; caption: string }> | null;
    /** The sentence that stands in for the average when there is none. */
    note: string | null;
    barFraction: number | null;
    dots: readonly WeekDotView[];
  }>;

export type BodyHeatViewModel = ReadyBase<"body_heat"> &
  Readonly<{
    eyebrow: string;
    rows: readonly HeatRowView[];
    emptyLine: string | null;
    /** "Today: Pull day", null when the day's plan is not known. */
    todayLine: string | null;
  }>;

export type TodayGlanceViewModel = ReadyBase<"today_glance"> &
  Readonly<{
    eyebrow: string;
    ring: RingView;
    macros: readonly MacroRowView[];
    week: Readonly<{ eyebrow: string; line: string; dots: readonly WeekDotView[] }>;
    training: Readonly<{
      eyebrow: string;
      line: string;
      heatChip: Readonly<{ text: string; dotRole: WidgetColourRole }> | null;
    }> | null;
  }>;

export type BodyMapViewModel = ReadyBase<"body_map"> &
  Readonly<{
    eyebrow: string;
    figure: FigureView;
    rows: readonly HeatRowView[];
    /** The line in place of the rows: nothing logged on heat, the muscle count on volume. */
    summaryLine: string | null;
    legend: Readonly<{
      swatches: readonly WidgetColourRole[];
      startLabel: string;
      endLabel: string;
    }>;
  }>;

export type LogGridViewModel = ReadyBase<"log_grid"> &
  Readonly<{ buttons: readonly WidgetButton[] }>;

export type TodayLoggingViewModel = ReadyBase<"today_logging"> &
  Readonly<{ ring: RingView; buttons: readonly WidgetButton[] }>;

export type LogAgainRowView =
  | Readonly<{
      type: "food";
      name: string;
      energy: string;
      accessibleName: string;
      action: WidgetAction;
    }>
  | Readonly<{ type: "logged"; text: string; undoLabel: string; action: WidgetAction }>;

export type LogAgainViewModel = ReadyBase<"log_again"> &
  Readonly<{ eyebrow: string; rows: readonly LogAgainRowView[] }>;

export type WeighInViewModel = ReadyBase<"weigh_in"> &
  Readonly<{
    eyebrow: string;
    /** "78.4", or the words for no weigh-in yet. */
    value: string;
    /** "kg", null when there is no weigh-in. */
    unit: string | null;
    /** "Logged yesterday", null when there is no weigh-in. */
    caption: string | null;
    button: WidgetButton;
  }>;

export type TrainingViewModel = ReadyBase<"training"> &
  (
    | Readonly<{
        phase: "start";
        eyebrow: string;
        title: string;
        subtitle: string;
        buttons: readonly WidgetButton[];
      }>
    | Readonly<{
        phase: "session";
        eyebrow: string;
        progress: string | null;
        title: string;
        setLabel: string | null;
        load: Readonly<{ value: string; unit: string }> | null;
        reps: Readonly<{ value: string; unit: string }> | null;
        lastTime: string | null;
        button: WidgetButton;
        /** "Logged" with Undo, in place of the button while the Undo window is open. */
        undo: Readonly<{ text: string; undoLabel: string; action: WidgetAction }> | null;
      }>
  );

export type ReadyViewModel =
  | TodayRingViewModel
  | TodayMacrosViewModel
  | ThisWeekViewModel
  | BodyHeatViewModel
  | TodayGlanceViewModel
  | BodyMapViewModel
  | LogGridViewModel
  | TodayLoggingViewModel
  | LogAgainViewModel
  | WeighInViewModel
  | TrainingViewModel;

export type WidgetViewModel = MessageViewModel | ReadyViewModel;
