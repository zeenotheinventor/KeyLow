const STORAGE_KEY = "kl-forgot-password-email";

/**
 * Hands the email typed on the sign in page to the forgot password page. It lives in `sessionStorage`
 * for one page change and never in a query string, because an address in a URL reaches the history and
 * the server logs. A browser that refuses storage just gets an empty field.
 */
export function setForgotPasswordEmail(email: string): void {
  const trimmedEmail = email.trim();
  if (trimmedEmail === "") {
    return;
  }

  try {
    sessionStorage.setItem(STORAGE_KEY, trimmedEmail);
  } catch {
    // The field starts empty and the person types the address again.
  }
}

/** The email left by the sign in page, or null. Reading it removes it. */
export function takeForgotPasswordEmail(): string | null {
  try {
    const email = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);

    return email;
  } catch {
    return null;
  }
}
