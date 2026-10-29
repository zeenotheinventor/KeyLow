import { TERMS_VERSION } from "@keylow/core/copy";
import { expect, test, type Page } from "@playwright/test";

// The checkbox is visually hidden and the box beside it is drawn, so a click lands on its label.
const acceptTerms = (page: Page) =>
  page.getByRole("checkbox", { name: /I accept the Terms and the Privacy Policy/ }).check({
    force: true,
  });

const email = `key24-${String(Date.now())}@keylow.local`;
const password = `throwaway-${String(Date.now())}`;

test.describe.configure({ mode: "serial" });

test("sends a signed-out visitor from the home page to the login page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
});

test("redirects a signed-out visitor from the dashboard to the login page", async ({ page }) => {
  await page.goto("/diary");

  await expect(page).toHaveURL(/\/login$/);
});

test("offers sign-in only on the login page, with a link to the sign-up page", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("button", { name: "Create account" })).toHaveCount(0);
  await page.getByRole("link", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
});

test("keeps Create account and Google disabled until the Terms are accepted", async ({ page }) => {
  await page.goto("/sign-up");

  await expect(page.getByRole("button", { name: "Create account" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();

  await acceptTerms(page);

  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
});

test("creates an account and lands on the dashboard", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await acceptTerms(page);

  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Diary" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Recipes" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "More" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Weight" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
});

test("signs out and protects the dashboard again", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: "More" }).click();
  await expect(page).toHaveURL(/\/more$/);
  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/diary");
  await expect(page).toHaveURL(/\/login$/);
});

test("signs in with the account that was created", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);

  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: "Diary" })).toBeVisible();
});

test("sends the browser to the Supabase Google authorize endpoint with the callback as the redirect", async ({
  page,
}) => {
  await page.goto("/sign-up");
  await acceptTerms(page);

  await page.getByRole("button", { name: "Continue with Google" }).click();

  // The local stack has Google disabled, so the authorize endpoint answers with a JSON error.
  // Reaching it with the right query is the observable proof of the redirect.
  await page.waitForURL(/\/auth\/v1\/authorize\?/);
  const authorizeUrl = new URL(page.url());
  expect(authorizeUrl.searchParams.get("provider")).toBe("google");
  expect(authorizeUrl.searchParams.get("redirect_to")).toBe("http://localhost:3000/auth/callback");
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === "kl-terms-pending")?.value).toBe(TERMS_VERSION);
});
