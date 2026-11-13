import { FORM_MEDIA_SWITCH } from "@keylow/core/copy";
import { View } from "react-native";

import { FormMediaLoading } from "./FormMediaLoading";
import { FormMediaUnavailable } from "./FormMediaUnavailable";
import { FormPhotos } from "./FormPhotos";
import { FormVideoCard } from "./FormVideoCard";
import { SegmentedControl } from "../SegmentedControl";

import type { FormMediaCardProps, FormMediaChoice, FormMediaPreferenceSwitch } from "./types";
import type { SegmentedControlOption } from "../SegmentedControl";
import type { ReactElement } from "react";

const switchOptions: SegmentedControlOption<FormMediaChoice>[] = [
  { value: "video", label: FORM_MEDIA_SWITCH.options.video },
  { value: "photos", label: FORM_MEDIA_SWITCH.options.photos },
  { value: "both", label: FORM_MEDIA_SWITCH.options.both },
];

/**
 * How an exercise is done, as the `exercise-form · form-media-card` boards draw it: a curated YouTube video
 * that opens in YouTube, the exercise's start and end photos, or both, the video card first and the photos
 * card under it, with the loading, unavailable and image failed states. The exercise sheet may add the
 * small quick switch under the media (`form-media-card · switch`). The live workout's exercise sheet, the
 * routine editor and the assistant chat all place this one card.
 */
export function FormMediaCard(props: FormMediaCardProps) {
  switch (props.kind) {
    case "video": {
      const { preferenceSwitch, ...video } = props;
      return withSwitch(<FormVideoCard {...video} />, preferenceSwitch);
    }
    case "photos": {
      const { preferenceSwitch, ...photos } = props;
      return withSwitch(<FormPhotos {...photos} />, preferenceSwitch);
    }
    case "both":
      return withSwitch(
        <View className="gap-2">
          <FormVideoCard
            channel={props.channel}
            kind="video"
            thumbnailUrl={props.thumbnailUrl}
            title={props.title}
            watchUrl={props.watchUrl}
          />
          <FormPhotos
            endUrl={props.endUrl}
            exerciseName={props.exerciseName}
            kind="photos"
            startUrl={props.startUrl}
          />
        </View>,
        props.preferenceSwitch,
      );
    case "loading":
      return <FormMediaLoading />;
    case "unavailable":
      return <FormMediaUnavailable />;
  }
}

// The switch is not part of any one card, so it sits under the media, 8 points down, outside them.
function withSwitch(media: ReactElement, preferenceSwitch: FormMediaPreferenceSwitch | undefined) {
  if (preferenceSwitch === undefined) {
    return media;
  }
  return (
    <View className="gap-2">
      {media}
      <SegmentedControl
        label={FORM_MEDIA_SWITCH.label}
        options={switchOptions}
        size="sm"
        value={preferenceSwitch.value}
        onChange={preferenceSwitch.onChange}
      />
    </View>
  );
}
