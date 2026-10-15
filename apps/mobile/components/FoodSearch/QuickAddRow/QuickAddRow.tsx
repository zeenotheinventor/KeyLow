import { DIARY_ACTIONS } from "@keylow/core/copy";

import { Card, ListRow } from "../../ui";

import type { QuickAddRowProps } from "./types";

/** "Quick add, calories and macros by hand", the row above Recent that opens the quick add form. */
export function QuickAddRow({ onPress }: QuickAddRowProps) {
  return (
    // The row brings its own padding, so the card has none.
    <Card padding={0}>
      <ListRow
        icon="Zap"
        subtitle={DIARY_ACTIONS.quickAddCaption}
        title={DIARY_ACTIONS.quickAdd}
        onPress={onPress}
      />
    </Card>
  );
}
