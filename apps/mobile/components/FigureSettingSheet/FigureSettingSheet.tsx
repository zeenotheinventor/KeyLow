import { BODY_MAP } from "@keylow/core/copy";
import { View } from "react-native";

import { BodyFigure, BottomSheet, Button, SegmentedControl, Text } from "../ui";

import type { FigureSettingSheetProps } from "./types";
import type { BodyArtworkFigure } from "@keylow/core/training";

const PREVIEW_WIDTH = 84;

const options = [
  { value: "male", label: BODY_MAP.figureSetting.options.male },
  { value: "female", label: BODY_MAP.figureSetting.options.female },
] as const satisfies readonly { value: BodyArtworkFigure; label: string }[];

/**
 * The sheet that asks for the figure the body is drawn as, on the first visit to the body map and from the
 * button in its header: a preview of the figure at 84 points, Male and Female, the line saying that only
 * the drawing changes, and Done. A choice applies at once and the sheet stays open, so the preview shows it.
 * No board draws it (KEY-430), so it is built from the kit. The preview is decoration beside the choice,
 * which the buttons name, so a screen reader skips it.
 */
export function FigureSettingSheet({ open, onClose, figure, onChange }: FigureSettingSheetProps) {
  return (
    <BottomSheet
      isTitleCentred
      open={open}
      title={BODY_MAP.figureSetting.sheetTitle}
      onClose={onClose}
    >
      <View className="gap-4">
        <View aria-hidden className="items-center">
          <BodyFigure
            body={figure}
            label={BODY_MAP.figureSetting.options[figure]}
            scale="heat"
            side="front"
            values={{}}
            w={PREVIEW_WIDTH}
          />
        </View>
        <SegmentedControl
          label={BODY_MAP.figureSetting.label}
          options={options}
          value={figure}
          onChange={onChange}
        />
        <Text className="text-center" tone="secondary" variant="caption">
          {BODY_MAP.figureSetting.description}
        </Text>
        <Button fullWidth onPress={onClose}>
          Done
        </Button>
      </View>
    </BottomSheet>
  );
}
