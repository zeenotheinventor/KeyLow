// The address Sign in hands to the forgot password screen. It is held in memory and never in a route or a
// deep link, so an email address cannot reach a URL, a log or a report.
let handedOverEmail = "";

/** Keeps the address the person typed on Sign in, for the forgot password screen to start with. */
export function setForgotPasswordEmail(email: string): void {
  handedOverEmail = email;
}

/** Gives the handed over address once, and forgets it, so the next visit starts with an empty field. */
export function takeForgotPasswordEmail(): string {
  const email = handedOverEmail;
  handedOverEmail = "";

  return email;
}
