import { useRouter } from "expo-router";

import { ForgotPasswordScreen } from "../../../components/ForgotPasswordScreen";

// Pushed inside the More tab from Forgot password? in the Delete account confirm, because the signed out route
// is in the (auth) group, which AuthGate leaves for the dashboard when someone is signed in. The account's email
// is handed over in memory, as Sign in does. Back, in the form and in the sent message, returns to the Delete
// account screen under it, and to More when there is nothing before it, as a cold link has not.
export default function SignedInForgotPasswordRoute() {
  const router = useRouter();

  return (
    <ForgotPasswordScreen
      from="deleteAccount"
      onBackToSignIn={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)/more");
        }
      }}
    />
  );
}
