import { MORE_SCREEN } from "@keylow/core/copy";
import { figureHas3dBody } from "@keylow/core/training";
import { View } from "react-native";

import { useBodyFigure } from "../../lib/bodyFigure";
import { useBodyMapRenderer } from "../../lib/bodyMapRenderer";
import { ListRow, SegmentedControl, Text } from "../ui";

import type { SegmentedControlOption } from "../ui";
import type { BodyMapRenderer } from "@keylow/core/training";

const { bodyMap } = MORE_SCREEN.settings;

const options: SegmentedControlOption<BodyMapRenderer>[] = [
  { value: "2d", label: bodyMap.options.twoD },
  { value: "3d", label: bodyMap.options.threeD },
];

/**
 * The Body map setting of More, as the `tab-shell.more · body-map-setting` board draws it inside the Settings
 * card: a row with an icon and the name, over a segmented control of 2D and 3D. The choice applies at once and
 * is kept per device, and the control always shows what was chosen. A figure with no 3D body keeps the 2D map
 * whatever is chosen, and the row says so under the control once the figure has been read.
 */
export function BodyMapRendererSetting() {
  const { renderer, setRenderer } = useBodyMapRenderer();
  const { figure, isReady } = useBodyFigure();
  const hasNoBodyIn3d = isReady && !figureHas3dBody(figure);

  return (
    <ListRow icon="PersonStanding" title={bodyMap.title}>
      <View className="gap-2">
        <SegmentedControl
          label={bodyMap.title}
          options={options}
          value={renderer}
          onChange={setRenderer}
        />
        {hasNoBodyIn3d ? (
          <Text className="px-1" tone="secondary" variant="caption">
            {bodyMap.femaleNote}
          </Text>
        ) : null}
      </View>
    </ListRow>
  );
}
