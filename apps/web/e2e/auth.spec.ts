import { expect, test } from "@playwright/test";

const email = `key24-${String(Date.now())}@keylow.local`;
const password = `throwaway-${String(Date.now())}`;

test.describe.configure({ mode: "serial" });

test("redirects a signed-out visitor from the dashboard to the login page", async ({ page }) => {
  await page.goto("/diary");

  await expect(page).toHaveURL(/\/login$/);
});

test("creates an account and lands on the diary", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);

  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/diary$/);
  await expect(page.getByRole("link", { name: "Diary" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Recipes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Weight" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
});

test("signs out and protects the dashboard again", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/diary$/);

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

  await expect(page).toHaveURL(/\/diary$/);
  await expect(page.getByRole("link", { name: "Diary" })).toBeVisible();
});

test("sends the browser to the Supabase Google authorize endpoint with the callback as the redirect", async ({
  page,
}) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Continue with Google" }).click();

  // The local stack has Google disabled, so the authorize endpoint answers with a JSON error.
  // Reaching it with the right query is the observable proof of the redirect.
  await page.waitForURL(/\/auth\/v1\/authorize\?/);
  const authorizeUrl = new URL(page.url());
  expect(authorizeUrl.searchParams.get("provider")).toBe("google");
  expect(authorizeUrl.searchParams.get("redirect_to")).toBe("http://localhost:3000/auth/callback");
});
