import { FormMediaLoading } from "./FormMediaLoading";
import { FormMediaUnavailable } from "./FormMediaUnavailable";
import { FormPhotos } from "./FormPhotos";
import { FormVideoCard } from "./FormVideoCard";

import type { FormMediaCardProps } from "./types";

/**
 * How an exercise is done, as the `web-assistant-card · exercise-form` board draws it: a curated video that
 * opens on YouTube in a new tab, or the exercise's start and end photos when there is no video, with the
 * loading and unavailable states. No player and no third-party frame is ever loaded here. The assistant
 * thread, the session page and the routine editor place this one card.
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
