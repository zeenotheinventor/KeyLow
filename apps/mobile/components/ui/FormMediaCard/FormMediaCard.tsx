import { FormMediaLoading } from "./FormMediaLoading";
import { FormMediaUnavailable } from "./FormMediaUnavailable";
import { FormPhotos } from "./FormPhotos";
import { FormVideoCard } from "./FormVideoCard";

import type { FormMediaCardProps } from "./types";

/**
 * How an exercise is done, as the `exercise-form · form-media-card` board draws it: a curated YouTube video
 * that opens in YouTube, or the exercise's start and end photos when there is no video, with the loading,
 * unavailable and image failed states. The live workout's exercise sheet, the routine editor and the
 * assistant chat all place this one card.
 */
export function FormMediaCard(props: FormMediaCardProps) {
  switch (props.kind) {
    case "video":
      return <FormVideoCard {...props} />;
    case "photos":
      return <FormPhotos {...props} />;
    case "loading":
      return <FormMediaLoading />;
    case "unavailable":
      return <FormMediaUnavailable />;
  }
}
