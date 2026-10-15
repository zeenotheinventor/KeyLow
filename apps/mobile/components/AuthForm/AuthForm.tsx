import {
  AUTH_SCREEN,
  CHECK_EMAIL_TITLE,
  SIGN_UP_SCREEN,
  describeAuthError,
  describeCheckEmail,
} from "@keylow/core/copy";
import { vars } from "nativewind";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { signInWithGoogle } from "../../lib/googleSignIn";
import { useKeyboardLift } from "../../lib/useKeyboardLift";
import { useScrollFocusedInputIntoView } from "../../lib/useScrollFocusedInputIntoView";
import { validateCredentials } from "../../lib/validateCredentials";
import { GoogleButton } from "../GoogleButton";
import { KiLoMark } from "../KiLoMark";
import { Banner, Button, Input, Text } from "../ui";
import { AcceptanceCheckbox } from "./AcceptanceCheckbox";
import { AuthFooter } from "./AuthFooter";

import type { AuthFormOutcome, AuthFormProps } from "./types";
import type { GoogleSignInResult } from "../../lib/googleSignIn";
import type { CredentialErrors } from "../../lib/validateCredentials";

type Method = "password" | "google";

// A cancelled sheet is not an error, and the AuthGate navigates on the new session.
function toOutcome(result: GoogleSignInResult): AuthFormOutcome {
  return result.status === "error" ? { status: "error", code: result.code } : { status: "done" };
}

/**
 * The sign in and sign up screens' one layout, as the auth boards draw it: the Ki-Lo mark and a heading,
 * an Email and a Password field, a notice when there is something to say, the primary button and the
 * Google button, and a line that links to the other screen. The words an error says are core's fixed
 * sentences, chosen by Supabase's error code, so no server text can reach the screen.
 *
 * With `requireAcceptance` it is the sign up board instead: a centred mark, heading and caption, the
 * Google button above the fields with an "or" between, and the acceptance checkbox above the primary
 * button. Both buttons stay disabled until the box is ticked, and the box starts unticked.
 */
export function AuthForm({
  heading,
  submitLabel,
  passwordRule,
  onSubmit,
  footer,
  requireAcceptance = false,
  onGoogleSignIn = signInWithGoogle,
}: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CredentialErrors>({});
  const [outcome, setOutcome] = useState<AuthFormOutcome>({ status: "done" });
  const [method, setMethod] = useState<Method | undefined>(undefined);
  const [isAccepted, setIsAccepted] = useState(false);

  const frameRef = useRef<View>(null);
  // Android 15 draws edge to edge, so the window does not resize for the keyboard. iOS has the padding view.
  const keyboardLift = useKeyboardLift(frameRef, Platform.OS === "android");

  const scrollViewRef = useRef<ScrollView>(null);
  const trackScrollOffset = useScrollFocusedInputIntoView(scrollViewRef, keyboardLift);

  const isSubmitting = method !== undefined;
  const isSigningUp = passwordRule === "minLength";
  const isAwaitingAcceptance = requireAcceptance && !isAccepted;

  async function runSubmission(nextMethod: Method, submit: () => Promise<AuthFormOutcome>) {
    setMethod(nextMethod);
    setOutcome({ status: "done" });
    try {
      setOutcome(await submit());
    } catch {
      setOutcome({ status: "error", code: undefined });
    } finally {
      setMethod(undefined);
    }
  }

  async function handleSubmit() {
    const errors = validateCredentials({ email, password }, passwordRule);
    setFieldErrors(errors);
    // An earlier notice is about an earlier attempt, so it never sits under this one's field errors.
    setOutcome({ status: "done" });
    if (errors.email !== undefined || errors.password !== undefined) {
      return;
    }

    await runSubmission("password", () => onSubmit({ email: email.trim(), password }));
  }

  async function handleGoogleSignIn() {
    await runSubmission("google", async () => toOutcome(await onGoogleSignIn()));
  }

  const googleButton = (
    <GoogleButton
      size={requireAcceptance ? "md" : "lg"}
      disabled={isSubmitting || isAwaitingAcceptance}
      onPress={() => void handleGoogleSignIn()}
    />
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      {/* The keyboard's cover is padding at the frame's bottom, so the scroll view is shorter by as much, the
          form scrolls in what is left above the keyboard, and Android scrolls the focused field into it. The
          cover is a runtime value no class can name, so it goes through a variable. */}
      <View
        ref={frameRef}
        className="flex-1 pb-[var(--keyboard-lift)]"
        style={vars({ "--keyboard-lift": keyboardLift })}
      >
        {/* The board's 56 above and 34 below are the status bar and the home indicator it is drawn under. */}
        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={trackScrollOffset}
          contentContainerClassName={`flex-grow justify-center px-6 pb-[34px] pt-[56px] ${requireAcceptance ? "gap-[14px]" : "gap-4"}`}
        >
          {requireAcceptance ? (
            <View className="items-center gap-1.5">
              <KiLoMark label="Ki-Lo" size={56} />
              <Text className="text-center" role="heading" variant="h1">
                {heading}
              </Text>
              <Text className="text-center" tone="secondary" variant="caption">
                {SIGN_UP_SCREEN.caption}
              </Text>
            </View>
          ) : (
            <View className="mb-2 items-start gap-4">
              <KiLoMark label="Ki-Lo" size={64} />
              <Text role="heading" variant="h1">
                {heading}
              </Text>
            </View>
          )}

          {requireAcceptance ? (
            <>
              {googleButton}
              <View className="flex-row items-center gap-[10px]">
                <View className="flex-1 border-t border-border" />
                <Text tone="secondary" variant="caption">
                  {SIGN_UP_SCREEN.divider}
                </Text>
                <View className="flex-1 border-t border-border" />
              </View>
            </>
          ) : null}

          <Input
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            error={fieldErrors.email}
            keyboardType="email-address"
            label={AUTH_SCREEN.emailLabel}
            placeholder={requireAcceptance ? SIGN_UP_SCREEN.emailPlaceholder : undefined}
            value={email}
            onChangeText={setEmail}
          />
          <Input
            autoCapitalize="none"
            autoComplete={isSigningUp ? "new-password" : "current-password"}
            autoCorrect={false}
            error={fieldErrors.password}
            label={AUTH_SCREEN.passwordLabel}
            placeholder={requireAcceptance ? SIGN_UP_SCREEN.passwordPlaceholder : undefined}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {outcome.status === "error" ? (
            <Banner sentence title={describeAuthError(outcome.code)} variant="error" />
          ) : null}
          {outcome.status === "check-email" ? (
            <Banner
              body={describeCheckEmail(outcome.email)}
              icon="Mail"
              title={CHECK_EMAIL_TITLE}
              variant="info"
            />
          ) : null}

          {requireAcceptance ? (
            <AcceptanceCheckbox checked={isAccepted} onChange={setIsAccepted} />
          ) : null}

          <View className="mt-2 gap-2">
            <Button
              disabled={method === "google" || isAwaitingAcceptance}
              loading={method === "password"}
              size="lg"
              fullWidth
              onPress={() => void handleSubmit()}
            >
              {submitLabel}
            </Button>
            {requireAcceptance ? null : googleButton}
          </View>

          <AuthFooter footer={footer} size={requireAcceptance ? "caption" : "body"} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
