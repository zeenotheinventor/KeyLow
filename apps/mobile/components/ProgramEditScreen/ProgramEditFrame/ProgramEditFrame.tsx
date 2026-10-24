import { PROGRAM_EDIT, SETUP_SHELL } from "@keylow/core/copy";
import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SheetHeader } from "../../ui";

import type { ProgramEditFrameProps } from "./types";

/** The top of Edit programme, as the setup recalculation has it: the title with Close on the right, under the top inset. */
export function ProgramEditFrame({
  onClose,
  isCloseInert = false,
  children,
}: ProgramEditFrameProps) {
  const insets = useSafeAreaInsets();

  return (
    // The top inset is a runtime value no class can name, so it goes through a variable, as the Programme screen's does.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        title={PROGRAM_EDIT.title}
        trailing={{
          icon: "X",
          label: SETUP_SHELL.closeName,
          disabled: isCloseInert,
          onPress: onClose,
        }}
      />
      {children}
    </View>
  );
}
