import { MORE_SCREEN } from "@keylow/core/copy";
import { View } from "react-native";

import { useFormMediaPreference } from "../../lib/formMediaPreference";
import { ListRow, SegmentedControl, Text } from "../ui";

import type { SegmentedControlOption } from "../ui";
import type { FormMediaPreference } from "@keylow/core/training";

const { exerciseDemos } = MORE_SCREEN.settings;

const options: SegmentedControlOption<FormMediaPreference>[] = [
  { value: "video", label: exerciseDemos.options.video },
  { value: "photos", label: exerciseDemos.options.photos },
  { value: "both", label: exerciseDemos.options.both },
];

/**
 * The Exercise demos setting of More, as the `tab-shell.more · form-media-setting` board draws it inside
 * the Settings card: a row with the Play icon and the name, over a segmented control of Video, Photos and
 * Both, and a caption that says what the chosen one shows. The choice applies at once and is kept per
 * device, it is the same one the switch on the exercise sheet changes, and the control always shows what
 * was chosen.
 */
export function FormMediaSetting() {
  const { preference, setPreference } = useFormMediaPreference();

  return (
    <ListRow icon="Play" title={exerciseDemos.title}>
      <View className="gap-2">
        <SegmentedControl
          label={exerciseDemos.title}
          options={options}
          value={preference}
          onChange={setPreference}
        />
        <Text className="px-1" tone="secondary" variant="caption">
          {exerciseDemos.captions[preference]}
        </Text>
      </View>
    </ListRow>
  );
}
