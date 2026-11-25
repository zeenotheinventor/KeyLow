import { useRouter } from "expo-router";

import { ForgotPasswordScreen } from "../../components/ForgotPasswordScreen";

export default function ForgotPasswordRoute() {
  const router = useRouter();

  return (
    <ForgotPasswordScreen
      onBackToSignIn={() => {
        router.dismissTo("/(auth)/sign-in");
      }}
    />
  );
}
