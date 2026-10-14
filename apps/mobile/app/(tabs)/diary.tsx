import { PLACEHOLDER_BODIES, TAB_TITLES } from "@keylow/core/copy";

import { PlaceholderScreen } from "../../components/PlaceholderScreen";

export default function DiaryRoute() {
  return (
    <PlaceholderScreen body={PLACEHOLDER_BODIES.diary} icon="BookOpen" title={TAB_TITLES.diary} />
  );
}
