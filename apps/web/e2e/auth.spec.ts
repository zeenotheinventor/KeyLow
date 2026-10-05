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
