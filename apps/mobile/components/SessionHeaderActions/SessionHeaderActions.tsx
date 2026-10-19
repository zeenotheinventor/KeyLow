import { DIARY_MORE_LABEL, SESSION_ACTIVE } from "@keylow/core/copy";
import { View } from "react-native";

import { Button, IconButton } from "../ui";

import type { SessionHeaderActionsProps } from "./types";

/**
 * What stands at the right of the session's header, as the boards draw it: the More control and, to its
 * right, Finish. Each is drawn only when its action is given, so none is a dead control.
 */
export function SessionHeaderActions({
  onMore,
  onFinish,
  isFinishDisabled = false,
}: SessionHeaderActionsProps) {
  return (
    <View className="shrink-0 flex-row items-center gap-2">
      {onMore === undefined ? null : (
        <IconButton icon="Ellipsis" label={DIARY_MORE_LABEL} onPress={onMore} />
      )}
      {onFinish === undefined ? null : (
        <Button disabled={isFinishDisabled} size="sm" onPress={onFinish}>
          {SESSION_ACTIVE.finishAction}
        </Button>
      )}
    </View>
  );
}
