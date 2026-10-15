import { useAcceptTerms } from "@keylow/api-client";
import { ACCEPT_TERMS_SCREEN, GENERIC_ERROR, TERMS_VERSION } from "@keylow/core/copy";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { AcceptanceCheckbox } from "../AcceptanceCheckbox";
import { KiLoMark } from "../KiLoMark";
import { SignOutButton } from "../SignOutButton";
import { Banner, Button, Text } from "../ui";

/**
 * What a signed in account with no current acceptance of the Terms sees instead of the app, built from
 * the sign up board: the centred mark, heading and caption, the acceptance checkbox and the large primary
 * button, which stays disabled until the box is ticked. Continue records the current version, and once
 * the acceptance has been read again the gate lets the app in. A failure says the core generic sentence,
 * never the server's, and leaves the screen as it was. Sign out is the way out for someone who declines.
 */
export function AcceptTermsScreen() {
  const [isAccepted, setIsAccepted] = useState(false);
  const acceptTerms = useAcceptTerms();

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="flex-grow justify-center gap-[14px] px-6 pb-[34px] pt-[56px]"
      keyboardShouldPersistTaps="handled"
    >
      <View className="items-center gap-1.5">
        <KiLoMark label="Ki-Lo" size={56} />
        <Text className="text-center" role="heading" variant="h1">
          {ACCEPT_TERMS_SCREEN.heading}
        </Text>
        <Text className="text-center" tone="secondary" variant="caption">
          {ACCEPT_TERMS_SCREEN.caption}
        </Text>
      </View>

      <AcceptanceCheckbox checked={isAccepted} onChange={setIsAccepted} />

      {acceptTerms.isError ? <Banner sentence title={GENERIC_ERROR} variant="error" /> : null}

      <View className="mt-2 gap-2">
        <Button
          disabled={!isAccepted}
          loading={acceptTerms.isPending}
          size="lg"
          fullWidth
          onPress={() => {
            acceptTerms.mutate(TERMS_VERSION);
          }}
        >
          {ACCEPT_TERMS_SCREEN.continueLabel}
        </Button>
        <SignOutButton />
      </View>
    </ScrollView>
  );
}
