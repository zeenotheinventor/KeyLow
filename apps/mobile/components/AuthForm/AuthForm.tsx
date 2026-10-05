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

import { validateCredentials } from "../../lib/validateCredentials";

import type { AuthFormOutcome, AuthFormProps } from "./types";
import type { CredentialErrors } from "../../lib/validateCredentials";

export function AuthForm({ heading, submitLabel, passwordRule, onSubmit, footer }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CredentialErrors>({});
  const [outcome, setOutcome] = useState<AuthFormOutcome>({ status: "done" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const errors = validateCredentials({ email, password }, passwordRule);
    setFieldErrors(errors);
    if (errors.email !== undefined || errors.password !== undefined) {
      return;
    }

    setIsSubmitting(true);
    setOutcome({ status: "done" });
    try {
      setOutcome(await onSubmit({ email: email.trim(), password }));
    } catch {
      setOutcome({ status: "error", message: "Something went wrong. Try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-neutral-50"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="flex-grow justify-center gap-4 px-6 py-16"
      >
        <Text accessibilityRole="header" className="text-3xl font-semibold text-neutral-900">
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
            className="h-12 rounded-lg border border-neutral-300 bg-neutral-50 px-4 text-base text-neutral-900"
          />
          {fieldErrors.email === undefined ? null : (
            <Text accessibilityRole="alert" className="text-sm text-danger-600">
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
            className="h-12 rounded-lg border border-neutral-300 bg-neutral-50 px-4 text-base text-neutral-900"
          />
          {fieldErrors.password === undefined ? null : (
            <Text accessibilityRole="alert" className="text-sm text-danger-600">
              {fieldErrors.password}
            </Text>
          )}
        </View>

        {outcome.status === "error" ? (
          <Text accessibilityRole="alert" className="text-sm text-danger-600">
            {outcome.message}
          </Text>
        ) : null}
        {outcome.status === "notice" ? (
          <Text accessibilityLiveRegion="polite" className="text-sm text-success-700">
            {outcome.message}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={() => void handleSubmit()}
          className="h-12 items-center justify-center rounded-lg bg-brand-600 disabled:opacity-50"
        >
          <Text className="text-base font-semibold text-neutral-50">{submitLabel}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          disabled
          className="h-12 items-center justify-center rounded-lg border border-neutral-300 opacity-50"
        >
          <Text className="text-base font-semibold text-neutral-900">Continue with Google</Text>
        </Pressable>
        <Text className="text-center text-sm text-neutral-500">Google sign-in is coming soon</Text>

        <View className="items-center gap-1">{footer}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
