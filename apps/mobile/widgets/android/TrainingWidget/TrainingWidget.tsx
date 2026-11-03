import { FlexWidget } from "react-native-android-widget";

import { ActionButton, Icon, LoggedRow, WidgetCard, WidgetText } from "../components";

import type { TrainingWidgetProps } from "./types";

/**
 * Board B, "Start training" and "Log a set" (medium): one widget that switches by state. With a day planned it
 * offers the two start buttons. With a session running it shows the next set, inside an accent border, and logs
 * it with one tap, then shows Logged with Undo while the window is open.
 */
export function TrainingWidget({ viewModel, theme }: TrainingWidgetProps) {
  if (viewModel.phase === "start") {
    return (
      <WidgetCard
        theme={theme}
        tap={viewModel.tap}
        accessibleName={viewModel.accessibleName}
        justifyContent="space-between"
      >
        <FlexWidget
          style={{
            width: "match_parent",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <WidgetText
            text={viewModel.eyebrow}
            theme={theme}
            size={12}
            weight="semiBold"
            role="textSubtle"
          />
          <Icon name="training" colour={theme.palette.textSubtle} size={16} />
        </FlexWidget>
        <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
          <WidgetText text={viewModel.title} theme={theme} size={22} weight="semiBold" />
          <WidgetText text={viewModel.subtitle} theme={theme} role="textMuted" />
        </FlexWidget>
        <FlexWidget style={{ width: "match_parent", flexDirection: "row" }}>
          {viewModel.buttons.map((button, position) => (
            <FlexWidget
              key={button.label}
              style={{
                ...(button.emphasis === "primary" ? { flex: 1 } : {}),
                ...(position === 0 ? {} : { marginLeft: 8 }),
              }}
            >
              <ActionButton
                button={button}
                theme={theme}
                height={40}
                fill={button.emphasis === "primary" ? "width" : undefined}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      </WidgetCard>
    );
  }

  const { load, reps, undo } = viewModel;

  return (
    <WidgetCard
      theme={theme}
      tap={viewModel.tap}
      accessibleName={viewModel.accessibleName}
      borderColour={theme.palette.accent}
      justifyContent="space-between"
    >
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <WidgetText
          text={viewModel.eyebrow}
          theme={theme}
          size={12}
          weight="semiBold"
          role="accent"
        />
        {viewModel.progress !== null && (
          <WidgetText text={viewModel.progress} theme={theme} size={12} role="textMuted" />
        )}
      </FlexWidget>
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <WidgetText text={viewModel.title} theme={theme} size={20} weight="semiBold" />
        {viewModel.setLabel !== null && (
          <WidgetText text={viewModel.setLabel} theme={theme} role="textMuted" />
        )}
      </FlexWidget>
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          {load !== null && (
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <WidgetText text={load.value} theme={theme} size={26} weight="semiBold" />
              <FlexWidget style={{ marginLeft: 6 }}>
                <WidgetText text={load.unit} theme={theme} role="textMuted" />
              </FlexWidget>
            </FlexWidget>
          )}
          {load !== null && reps !== null && (
            <FlexWidget style={{ marginHorizontal: 8 }}>
              <WidgetText text="×" theme={theme} role="textSubtle" />
            </FlexWidget>
          )}
          {reps !== null && (
            <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
              <WidgetText text={reps.value} theme={theme} size={26} weight="semiBold" />
              <FlexWidget style={{ marginLeft: 6 }}>
                <WidgetText text={reps.unit} theme={theme} role="textMuted" />
              </FlexWidget>
            </FlexWidget>
          )}
        </FlexWidget>
        {viewModel.lastTime !== null && (
          <WidgetText text={viewModel.lastTime} theme={theme} size={11} role="textMuted" />
        )}
      </FlexWidget>
      {undo === null ? (
        <ActionButton button={viewModel.button} theme={theme} fill="width" />
      ) : (
        <LoggedRow
          text={undo.text}
          undoLabel={undo.undoLabel}
          action={undo.action}
          theme={theme}
          height={36}
        />
      )}
    </WidgetCard>
  );
}
