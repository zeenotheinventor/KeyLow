import { PALATE_WORDS, describeNotTrue, describeShowAll, describeUndo } from "@keylow/core/copy";
import { useState } from "react";

import { GroupedList, ListRow } from "../../ui";

import type { PalateItemListProps } from "./types";

/**
 * A titled card of palate rows, each a `ListRow` with a Not true button, or with Undo once the item is
 * corrected, when it is muted and says so. With a `limit` it draws that many and a "Show all {n}" row, which
 * opens the rest in place and is then gone, as `RoutineDayRow` opens its days.
 */
export function PalateItemList({ title, rows, limit, onNotTrue, onUndo }: PalateItemListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isCut = !isOpen && limit !== undefined && rows.length > limit;

  return (
    <GroupedList title={title}>
      {(isCut ? rows.slice(0, limit) : rows).map((row) => {
        const isCorrected = row.correctionId !== null;
        return (
          <ListRow
            key={row.key}
            density="snug"
            subtitle={row.detail}
            title={row.title}
            titleTone={isCorrected ? "secondary" : "primary"}
            trailing={{
              kind: "action",
              label: isCorrected ? PALATE_WORDS.undo : PALATE_WORDS.notTrue,
              accessibleName: isCorrected ? describeUndo(row.title) : describeNotTrue(row.title),
              onPress: () => {
                if (isCorrected) {
                  onUndo(row);
                } else {
                  onNotTrue(row);
                }
              },
            }}
          />
        );
      })}
      {isCut ? (
        <ListRow
          key="show-all"
          chevron={false}
          title={describeShowAll(rows.length)}
          titleTone="accent"
          trailingIcon="ChevronDown"
          onPress={() => {
            setIsOpen(true);
          }}
        />
      ) : null}
    </GroupedList>
  );
}
