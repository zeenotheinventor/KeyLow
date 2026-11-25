import { PASSWORD_SAVED, SET_PASSWORD_SCREEN, describePasswordFor } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AccessibilityInfo, View } from "react-native";

import { signOut } from "../../lib/signOut";
import { useSessionUser } from "../../lib/useSessionUser";
import { AuthMessage } from "../AuthMessage";
import { NewPasswordForm } from "../NewPasswordForm";
import { Text } from "../ui";

/**
 * The set a new password boards, where a reset link lands. The caption names the account the link signed in,
 * read from the session and never from the link. Leaving without saving keeps the person signed in with the
 * old password, so there is no way back drawn. Once the password is saved the screen says so, and Continue
 * opens the dashboard. A reset that has timed out signs the dead session out before it asks for a new link.
 */
export function SetPasswordScreen() {
  const router = useRouter();
  const user = useSessionUser();
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isSaved) {
      AccessibilityInfo.announceForAccessibility(PASSWORD_SAVED.title);
    }
  }, [isSaved]);

  if (isSaved) {
    return (
      <View className="flex-1 bg-background">
        <AuthMessage
          body={PASSWORD_SAVED.body}
          icon="CircleCheck"
          primary={{
            label: PASSWORD_SAVED.continueLabel,
            onPress: () => {
              router.replace("/(tabs)/dashboard");
            },
          }}
          title={PASSWORD_SAVED.title}
          tone="success"
        />
      </View>
    );
  }

  return (
    <NewPasswordForm
      context="recovery"
      onSaved={() => {
        setIsSaved(true);
      }}
      onSendNewLink={() => {
        // Forgot password is in the signed out group, so with the session still there the gate would send the
        // person to the dashboard. A failed sign out therefore stays on this screen, with its notice.
        signOut().then(
          () => {
            router.replace("/(auth)/forgot-password");
          },
          () => undefined,
        );
      }}
    >
      <View className="mb-2 items-start gap-2">
        <Text role="heading" variant="h1">
          {SET_PASSWORD_SCREEN.heading}
        </Text>
        {user?.email === undefined ? null : (
          <Text tone="secondary">{describePasswordFor(user.email)}</Text>
        )}
      </View>
    </NewPasswordForm>
  );
}
