import { SetPasswordScreen } from "../../components/SetPasswordScreen";

// Where a reset link lands once it has signed the person in. It sits under `app/auth/` and not `(auth)`
// because the root gate sends a signed in person out of `(auth)` and leaves the `auth` segment alone.
export default function SetPasswordRoute() {
  return <SetPasswordScreen />;
}
