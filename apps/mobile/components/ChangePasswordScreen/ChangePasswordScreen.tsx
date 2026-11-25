import {
  ACCOUNT_EXPORT_COPY,
  CHANGE_PASSWORD_SCREEN,
  describePasswordFor,
} from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSessionUser } from "../../lib/useSessionUser";
import { NewPasswordForm } from "../NewPasswordForm";
import { IconButton, Text } from "../ui";

/**
 * The change password boards, pushed from the Change password row in More: a back chevron beside the heading,
 * the caption naming the signed in account, and the shared form. Done and the chevron both go back to More.
 */
export function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useSessionUser();

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to More instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more");
    }
  }

  return (
    // The insets are runtime values no class can name, so they go through variables, as the Export my data screen's do.
    <View
      className="flex-1 bg-background pb-[var(--inset-bottom)] pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top, "--inset-bottom": insets.bottom })}
    >
      <View className="flex-row items-center gap-3 pb-3 pl-2 pr-4 pt-3">
        <View className="-mr-2">
          <IconButton
            icon="ChevronLeft"
            iconSize="lg"
            label={ACCOUNT_EXPORT_COPY.back}
            variant="ghost"
            onPress={goBack}
          />
        </View>
        <Text className="flex-1" role="heading" variant="h1">
          {CHANGE_PASSWORD_SCREEN.heading}
        </Text>
      </View>
      <NewPasswordForm context="change" onDone={goBack}>
        {user?.email === undefined ? null : (
          <Text tone="secondary">{describePasswordFor(user.email)}</Text>
        )}
      </NewPasswordForm>
    </View>
  );
}
