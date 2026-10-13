import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { signInWithGoogle } from "../../lib/googleSignIn";
import { validateCredentials } from "../../lib/validateCredentials";

import type { AuthFormOutcome, AuthFormProps } from "./types";
import type { GoogleSignInResult } from "../../lib/googleSignIn";
import type { CredentialErrors } from "../../lib/validateCredentials";

// A cancelled sheet is not an error, and the AuthGate navigates on the new session.
function toOutcome(result: GoogleSignInResult): AuthFormOutcome {
  return result.status === "error"
    ? { status: "error", message: result.message }
    : { status: "done" };
}

export function AuthForm({ heading, submitLabel, passwordRule, onSubmit, footer }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CredentialErrors>({});
  const [outcome, setOutcome] = useState<AuthFormOutcome>({ status: "done" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function runSubmission(submit: () => Promise<AuthFormOutcome>) {
    setIsSubmitting(true);
    setOutcome({ status: "done" });
    try {
      setOutcome(await submit());
    } catch {
      setOutcome({ status: "error", message: "Something went wrong. Try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit() {
    const errors = validateCredentials({ email, password }, passwordRule);
    setFieldErrors(errors);
    if (errors.email !== undefined || errors.password !== undefined) {
      return;
    }

    await runSubmission(() => onSubmit({ email: email.trim(), password }));
  }

  async function handleGoogleSignIn() {
    await runSubmission(async () => toOutcome(await signInWithGoogle()));
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-legacy-neutral-50"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="flex-grow justify-center gap-4 px-6 py-16"
      >
        <Text accessibilityRole="header" className="text-3xl font-semibold text-legacy-neutral-900">
          {heading}
        </Text>

        <View className="gap-1">
          <TextInput
            accessibilityLabel="Email"
            placeholder="Email"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            className="h-12 rounded-lg border border-legacy-neutral-300 bg-legacy-neutral-50 px-4 text-base text-legacy-neutral-900"
          />
          {fieldErrors.email === undefined ? null : (
            <Text accessibilityRole="alert" className="text-sm text-legacy-danger-600">
              {fieldErrors.email}
            </Text>
          )}
        </View>

        <View className="gap-1">
          <TextInput
            accessibilityLabel="Password"
            placeholder="Password"
            autoCapitalize="none"
            autoComplete="password"
            autoCorrect={false}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            className="h-12 rounded-lg border border-legacy-neutral-300 bg-legacy-neutral-50 px-4 text-base text-legacy-neutral-900"
          />
          {fieldErrors.password === undefined ? null : (
            <Text accessibilityRole="alert" className="text-sm text-legacy-danger-600">
              {fieldErrors.password}
            </Text>
          )}
        </View>

        {outcome.status === "error" ? (
          <Text accessibilityRole="alert" className="text-sm text-legacy-danger-600">
            {outcome.message}
          </Text>
        ) : null}
        {outcome.status === "notice" ? (
          <Text accessibilityLiveRegion="polite" className="text-sm text-legacy-success-700">
            {outcome.message}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={() => void handleSubmit()}
          className="h-12 items-center justify-center rounded-lg bg-legacy-brand-600 disabled:opacity-50"
        >
          <Text className="text-base font-semibold text-legacy-neutral-50">{submitLabel}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={() => void handleGoogleSignIn()}
          className="h-12 items-center justify-center rounded-lg border border-legacy-neutral-300 disabled:opacity-50"
        >
          <Text className="text-base font-semibold text-legacy-neutral-900">
            Continue with Google
          </Text>
        </Pressable>

        <View className="items-center gap-1">{footer}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
