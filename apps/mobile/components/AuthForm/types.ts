import type { Credentials, PasswordRule } from "../../lib/validateCredentials";
import type { ReactNode } from "react";

export type AuthFormOutcome =
  { status: "done" } | { status: "error"; message: string } | { status: "notice"; message: string };

export type AuthFormProps = {
  heading: string;
  submitLabel: string;
  passwordRule: PasswordRule;
  onSubmit: (credentials: Credentials) => Promise<AuthFormOutcome>;
  footer: ReactNode;
};
